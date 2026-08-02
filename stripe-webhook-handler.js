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
  10:  'TIER_1_PROMO_10',
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
  if (!reportId) { console.warn('[STRIPE] reportId mancante — sessione non collegata a nessun caso'); return; }
  const amountEuro = session.amount_total / 100;
  const tier       = TIER_MAPPING[amountEuro] || 'TIER_4_ENTERPRISE_API';

  const jobRecord = await prisma.job.findUnique({ where: { id: reportId } });
  if (!jobRecord) throw new Error(`Ordine ${reportId} non trovato`);
  const payload = (() => { try { return JSON.parse(jobRecord.payload || '{}'); } catch { return {}; } })();
  const stripeEmail = session.customer_details?.email || session.customer_email || null;
  const clientEmail = stripeEmail && stripeEmail.includes('@') ? stripeEmail
    : (payload.email && payload.email.includes('@') ? payload.email : null);
  const clientPhone = payload.telefono || payload.zonaDati?.telefono || session.customer_details?.phone || null;
  const order = {
    id: reportId,
    nome: payload.nome || null,
    ragioneSociale: payload.ragioneSociale || null,
    telefono: clientPhone,
    email: clientEmail,
    tipoRichiesta: payload.service || tier,
    importo: amountEuro,
    valuta: session.currency || 'eur',
    stato: 'PAID',
    stripeSessionId: session.id,
    stripePaymentIntentId: session.payment_intent || null,
    paidAt: new Date().toISOString(),
  };

  // Persistenza atomica: l'ordine pagato non può esistere solo nei log Stripe.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.idempotencyKey.create({ data: {
        idempotencyKey: `checkout-${session.id}`, jobId: reportId,
        operation: 'stripe_checkout', status: 'SUCCESS', result: JSON.stringify(order),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }});
      await tx.job.update({ where: { id: reportId }, data: {
        status: 'PAID', payload: JSON.stringify({ ...payload, email: clientEmail, telefono: clientPhone, order }),
      }});
      await tx.immobile.update({ where: { jobId: reportId }, data: { pagato: true, livelloCommerciale: tier } });
      await tx.jobEvent.create({ data: { jobId: reportId, eventType: 'ORDER_PAID', metadata: JSON.stringify(order) } });
      await tx.activityLog.create({ data: { event: 'STRIPE_CHECKOUT_COMPLETED', dataJson: JSON.stringify(order) } });
    });
  } catch (e) {
    if (e.code === 'P2002') { console.log(`[STRIPE] gia processato ${session.id}`); return; }
    throw e;
  }

  const email = clientEmail;
  await notifyAdminPaid(order);
  await sendConfirmationEmail(email, reportId, tier, amountEuro);

  if (payload.deferUntilPayment) {
    try {
      const { createAnalysisPipeline } = require('./dag-orchestrator');
      await createAnalysisPipeline(reportId, { ...payload, email, telefono: clientPhone }, tier);
      console.log(`[STRIPE] Pipeline post-pagamento avviata per ${reportId}`);
    } catch (err) {
      await markOrderAttention(reportId, order, `Avvio produzione fallito: ${err.message}`);
    }
  } else {
    try {
      await getFlowProducer().add({
        name: `notifyJob-paid-${reportId}`, queueName: 'notificationQueue',
        data: { jobId: reportId, email, tier }, opts: { attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
        children: [{ name: `reportJob-paid-${reportId}`, queueName: 'reportRenderQueue', data: { jobId: reportId, tier }, opts: { attempts: 2 } }],
      });
    } catch (err) { await markOrderAttention(reportId, order, `Flow consegna fallito: ${err.message}`); }
  }
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('Telegram non configurato');
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
}

async function notifyAdminPaid(order) {
  const text = `PAGAMENTO RICEVUTO EUR ${order.importo}\nOrdine: ${order.id}\nCliente: ${order.nome || 'n/d'}\nContatto: ${order.email || order.telefono || 'n/d'}\nTipo: ${order.tipoRichiesta}`;
  try {
    await sendTelegram(text);
    await prisma.jobEvent.create({ data: { jobId: order.id, eventType: 'ADMIN_PAYMENT_NOTIFIED', metadata: JSON.stringify({ channel: 'telegram' }) } });
  } catch (err) {
    console.error(`[TELEGRAM] Notifica pagamento fallita ${order.id}:`, err.message);
    await notifyManual(order.id, order.email || order.telefono, order.tipoRichiesta, order.importo);
    await prisma.jobEvent.create({ data: { jobId: order.id, eventType: 'ADMIN_PAYMENT_NOTIFICATION_FAILED', metadata: JSON.stringify({ error: err.message }) } }).catch(() => {});
  }
}

async function markOrderAttention(reportId, order, reason) {
  await prisma.job.update({ where: { id: reportId }, data: { status: 'PAID_NEEDS_ATTENTION', error: reason } }).catch(() => {});
  await prisma.jobEvent.create({ data: { jobId: reportId, eventType: 'PAID_ORDER_NEEDS_ATTENTION', metadata: JSON.stringify({ reason }) } }).catch(() => {});
  try { await sendTelegram(`ORDINE PAGATO DA GESTIRE\nOrdine: ${reportId}\nMotivo: ${reason}`); }
  catch (_) { await notifyManual(reportId, order.email || order.telefono, order.tipoRichiesta, order.importo); }
}

// Notifica garantita sul telefono di Simone (ntfy) col jobId da evadere a mano
async function notifyManual(reportId, email, tier, amountEuro) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) { console.log(`[MANUAL] PAGATO ${reportId} ${tier} EUR${amountEuro} ${email}`); return; }
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: { Title: `PAGATO EUR${amountEuro} - ${tier}`, Priority: 'urgent', Tags: 'moneybag' },
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

    const { data, error } = await resend.emails.send({
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

    if (error) throw new Error(error.message || JSON.stringify(error));
    await prisma.jobEvent.create({ data: { jobId: reportId, eventType: 'CUSTOMER_CONFIRMATION_SENT', metadata: JSON.stringify({ channel: 'email', providerId: data?.id || null }) } }).catch(() => {});

    console.log(`[EMAIL] Conferma inviata a ${email} — jobId ${reportId}`);
  } catch (err) {
    console.error(`[EMAIL] Errore invio conferma ${reportId}:`, err.message);
    await prisma.jobEvent.create({ data: { jobId: reportId, eventType: 'CUSTOMER_CONFIRMATION_FAILED', metadata: JSON.stringify({ channel: 'email', error: err.message }) } }).catch(() => {});
    try { await sendTelegram(`CONFERMA CLIENTE FALLITA\nOrdine: ${reportId}\nEmail: ${email || 'n/d'}\nErrore: ${err.message}`); } catch (_) {}
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
    TIER_1_PROMO_10:      { amount: 1000,  label: 'Analisi External Opinion - promo lancio (EUR 10)' },
    TIER_1_CASCADE_79:    { amount: 7900,  label: 'Analisi Asta — Verdetto CASCADE (EUR 79)' },
    TIER_1_SCREENING_69:  { amount: 6900,  label: 'Screening Report (EUR 69)' },
    TIER_1_ENTRY_89:      { amount: 8900,  label: 'Entry Report (EUR 89)' },
    TIER_2_ADVISORY_150:  { amount: 15000, label: 'Advisory Report (EUR 150)' },
    TIER_3_PREMIUM_690:   { amount: 69000, label: 'Premium Report (EUR 690)' },
  };
  if (!prices[tier]) throw new Error(`Tier non valido: ${tier}`);

  const baseUrl = process.env.BASE_URL || 'https://externalopinionagent-production.up.railway.app';

  return stripe.checkout.sessions.create({
    line_items: [{
      price_data: {
        currency:     'eur',
        product_data: { name: prices[tier].label, description: `External Opinion — ${tier}` },
        unit_amount:   prices[tier].amount,
      },
      quantity: 1,
    }],
    mode:          'payment',
    integration_identifier: 'externalopinion_checkout_qwertyui',
    success_url:   `${baseUrl}/success.html?sessionId={CHECKOUT_SESSION_ID}&jobId=${reportId}`,
    cancel_url:    `${baseUrl}/cancel.html?jobId=${reportId}`,
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
