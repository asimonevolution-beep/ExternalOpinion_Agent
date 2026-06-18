/**
 * EXTERNAL OPINION — STRIPE WEBHOOK HANDLER V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 *
 * Fix V18.3:
 * - dataJson sempre stringa JSON (mai oggetto raw)
 * - TIER_1_SCREENING_69 aggiunto
 * - Idempotency check su checkout.session.completed
 * - metadata corretto su JobEvent
 */

const express  = require('express');
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe   = stripeKey && stripeKey.startsWith('sk_') ? require('stripe')(stripeKey) : null;
const prisma   = require('./db');
const { Resend } = require('resend');

// Import lazy per evitare problemi di init order con Redis/BullMQ
function getFlowProducer() {
  return require('./dag-orchestrator').flowProducer;
}

const router = express.Router();

const TIER_MAPPING = {
  69:  'TIER_1_SCREENING_69',
  79:  'TIER_1_CASCADE_79',
  89:  'TIER_1_ENTRY_89',
  150: 'TIER_2_ADVISORY_150',
  690: 'TIER_3_PREMIUM_690',
};

// ============================================================================
// WEBHOOK — firma verificata
// ============================================================================
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe non configurato' });

  const sig = req.headers['stripe-signature'];
  console.log('[STRIPE-DEBUG] body isBuffer:', Buffer.isBuffer(req.body), 'len:', req.body?.length, 'sig:', sig?.substring(0, 40));
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`[STRIPE] Firma non valida: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[STRIPE] Evento: ${event.type} (${event.id})`);

  try {
    if      (event.type === 'checkout.session.completed')    await handleCheckoutCompleted(event.data.object);
    else if (event.type === 'payment_intent.succeeded')      await handlePaymentSucceeded(event.data.object);
    else if (event.type === 'payment_intent.payment_failed') await handlePaymentFailed(event.data.object);
    else if (event.type === 'charge.refunded')               await handleRefunded(event.data.object);
    return res.json({ received: true });
  } catch (err) {
    console.error(`[STRIPE] Handler error: ${err.message}`);
    return res.status(500).json({ received: true, error: err.message });
  }
});

// ============================================================================
// CHECKOUT COMPLETATO (FIX P0: idempotency atomica + consegna manuale)
// ============================================================================
async function handleCheckoutCompleted(session) {
  const reportId    = session.metadata?.reportId || session.client_reference_id;
  const clientEmail = session.customer_email;
  if (!reportId) { console.warn('[STRIPE] reportId mancante — sessione non collegata a nessun caso'); return; }
  const amountEuro = session.amount_total / 100;
  const tier       = TIER_MAPPING[amountEuro] || 'TIER_4_ENTERPRISE_API';

  // G2 — IDEMPOTENCY ATOMICA: la chiave UNIQUE è il gate, creata PRIMA del lavoro
  try {
    await prisma.idempotencyKey.create({
      data: {
        idempotencyKey: `checkout-${session.id}`,
        jobId: reportId, operation: 'stripe_checkout', status: 'SUCCESS',
        result: JSON.stringify({ tier, amount: amountEuro }),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (e) {
    if (e.code === 'P2002') { console.log(`[STRIPE] gia processato ${session.id}`); return; }
    throw e;
  }

  await prisma.$transaction(async (tx) => {
    await tx.immobile.update({ where: { jobId: reportId }, data: { pagato: true, livelloCommerciale: tier } });
    await tx.jobEvent.create({ data: { jobId: reportId, eventType: 'PAYMENT_COMPLETED',
      metadata: JSON.stringify({ stripeSessionId: session.id, amount: amountEuro, tier, customerEmail: clientEmail }) } });
    await tx.activityLog.create({ data: { event: 'STRIPE_CHECKOUT_COMPLETED',
      dataJson: JSON.stringify({ reportId, sessionId: session.id, tier, amount: amountEuro }) } });
  });

  const email = clientEmail || await (async () => {
    try { const j = await prisma.job.findUnique({ where: { id: reportId } });
      return JSON.parse(j?.payload || '{}').email || null; } catch { return null; }
  })();

  // G1 — CONSEGNA: pipeline solo se esplicitamente accesa; altrimenti notifica per consegna manuale
  if (process.env.PIPELINE_ENABLED === 'true') {
    try {
      await getFlowProducer().add({
        name: `notifyJob-paid-${reportId}`,
        queueName: 'notificationQueue',
        data: { jobId: reportId, email, tier },
        opts: { attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
        children: [{
          name: `reportJob-paid-${reportId}`,
          queueName: 'reportRenderQueue',
          data: { jobId: reportId, tier },
          opts: { attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
        }],
      });
      console.log(`[STRIPE] Flow report→notify avviato per ${reportId}`);
    } catch (err) {
      console.error(`[STRIPE] flow KO ${reportId}:`, err.message);
      await notifyManual(reportId, email, tier, amountEuro);
    }
  } else {
    await notifyManual(reportId, email, tier, amountEuro);
  }

  // Invia email di conferma al cliente
  await sendConfirmationEmail(email, reportId, tier, amountEuro);
}

// Notifica garantita sul telefono di Simone (ntfy) col jobId da evadere a mano
async function notifyManual(reportId, email, tier, amountEuro) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) { console.log(`[MANUAL] PAGATO ${reportId} ${tier} EUR${amountEuro} ${email}`); return; }
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: { Title: `PAGATO EUR${amountEuro} — ${tier}`, Priority: 'urgent', Tags: 'moneybag' },
      body: `Job ${reportId}\nEmail: ${email || 'n/d'}\nEvadi il report a mano.`,
    });
  } catch (e) { console.error('[MANUAL] ntfy KO:', e.message); }
}

// ============================================================================
// EMAIL DI CONFERMA AL CLIENTE
// ============================================================================
async function sendConfirmationEmail(email, reportId, tier, amountEuro) {
  if (!email || !process.env.RESEND_API_KEY) {
    console.log(`[EMAIL] Skip conferma ${reportId} — email mancante o API key assente`);
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const tierLabel = {
      'TIER_1_CASCADE_79': 'Perizia Asta — Verdetto CASCADE',
      'TIER_1_SCREENING_69': 'Screening Report',
      'TIER_1_ENTRY_89': 'Entry Report',
      'TIER_2_ADVISORY_150': 'Advisory Report',
      'TIER_3_PREMIUM_690': 'Premium Report',
    }[tier] || tier;

    await resend.emails.send({
      from: 'info@externalopinion.it',
      to: email,
      subject: `✅ Perizia ricevuta — Ordine #${reportId.substring(0, 8)}`,
      html: `
        <h2>Ciao,</h2>
        <p>Grazie per l'ordine! Abbiamo ricevuto il pagamento di <strong>€${amountEuro}</strong> per <strong>${tierLabel}</strong>.</p>

        <p><strong>Codice ordine:</strong> ${reportId.substring(0, 8)}</p>

        <p>Stiamo elaborando la perizia. La riceverai per email entro <strong>2-4 ore</strong>.</p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 2rem 0;">

        <p style="font-size: 0.9rem; color: #666;">
          Domande? Rispondi direttamente a questa email.<br>
          <strong>External Opinion — Analisi immobiliari con AI</strong>
        </p>
      `,
    });

    console.log(`[EMAIL] Conferma inviata a ${email} — jobId ${reportId}`);
  } catch (err) {
    console.error(`[EMAIL] Errore invio conferma ${reportId}:`, err.message);
  }
}

// ============================================================================
// PAYMENT INTENT SUCCEEDED
// ============================================================================
async function handlePaymentSucceeded(pi) {
  await prisma.activityLog.create({
    data: {
      event:    'STRIPE_PAYMENT_INTENT_SUCCEEDED',
      dataJson: JSON.stringify({ paymentIntentId: pi.id, amount: pi.amount / 100, currency: pi.currency }),
    },
  }).catch(() => {});
}

// ============================================================================
// PAYMENT FAILED
// ============================================================================
async function handlePaymentFailed(pi) {
  const reportId = pi.metadata?.reportId;
  const errMsg   = pi.last_payment_error?.message || 'unknown';
  console.error(`[STRIPE] Payment failed: ${pi.id} — ${errMsg}`);
  if (!reportId) return;

  await prisma.$transaction(async (tx) => {
    await tx.jobEvent.create({
      data: {
        jobId:     reportId,
        eventType: 'PAYMENT_FAILED',
        metadata:  JSON.stringify({ paymentIntentId: pi.id, error: errMsg }),
      },
    });
    await tx.activityLog.create({
      data: { event: 'STRIPE_PAYMENT_FAILED', dataJson: JSON.stringify({ reportId, paymentIntentId: pi.id, error: errMsg }) },
    });
  }).catch(() => {});
}

// ============================================================================
// RIMBORSO
// ============================================================================
async function handleRefunded(charge) {
  const reportId = charge.metadata?.reportId;
  if (!reportId) return;

  await prisma.$transaction(async (tx) => {
    await tx.immobile.update({
      where: { jobId: reportId },
      data:  { pagato: false, livelloCommerciale: null },
    });
    await tx.jobEvent.create({
      data: {
        jobId:     reportId,
        eventType: 'PAYMENT_REFUNDED',
        metadata:  JSON.stringify({ chargeId: charge.id, refundAmount: charge.amount_refunded / 100 }),
      },
    });
    await tx.activityLog.create({
      data: { event: 'STRIPE_CHARGE_REFUNDED', dataJson: JSON.stringify({ reportId, chargeId: charge.id, refundAmount: charge.amount_refunded / 100 }) },
    });
  }).catch(() => {});

  console.log(`[STRIPE] Rimborso processato per ${reportId}`);
}

// ============================================================================
// CREATE CHECKOUT SESSION
// ============================================================================
async function createCheckoutSession(reportId, tier, clientEmail = null) {
  if (!stripe) throw new Error('Stripe non configurato — imposta STRIPE_SECRET_KEY');

  const prices = {
    TIER_1_CASCADE_79:    { amount: 7900,  label: 'Analisi Asta — Verdetto CASCADE (EUR 79)' },
    TIER_1_SCREENING_69:  { amount: 6900,  label: 'Screening Report (EUR 69)' },
    TIER_1_ENTRY_89:      { amount: 8900,  label: 'Entry Report (EUR 89)' },
    TIER_2_ADVISORY_150:  { amount: 15000, label: 'Advisory Report (EUR 150)' },
    TIER_3_PREMIUM_690:   { amount: 69000, label: 'Premium Report (EUR 690)' },
  };
  if (!prices[tier]) throw new Error(`Tier non valido: ${tier}`);

  const baseUrl = process.env.BASE_URL || 'https://externalopinionagent-production.up.railway.app';

  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency:     'eur',
        product_data: { name: prices[tier].label, description: `External Opinion — ${tier}` },
        unit_amount:   prices[tier].amount,
      },
      quantity: 1,
    }],
    mode:          'payment',
    success_url:   `${baseUrl}/success?sessionId={CHECKOUT_SESSION_ID}&jobId=${reportId}`,
    cancel_url:    `${baseUrl}/cancel?jobId=${reportId}`,
    customer_email:       clientEmail || undefined,
    client_reference_id: reportId,
    metadata:            { reportId, tier },
  });
}

// ============================================================================
// GET SESSION STATUS
// ============================================================================
async function getSessionStatus(sessionId) {
  if (!stripe) throw new Error('Stripe non configurato');
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return { id: session.id, status: session.payment_status, amount: session.amount_total / 100, metadata: session.metadata };
}

module.exports = { router, createCheckoutSession, getSessionStatus };