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

// Import lazy per evitare problemi di init order con Redis/BullMQ
function getFlowProducer() {
  return require('./dag-orchestrator').flowProducer;
}

const router = express.Router();

const TIER_MAPPING = {
  69:  'TIER_1_SCREENING_69',
  89:  'TIER_1_ENTRY_89',
  150: 'TIER_2_ADVISORY_150',
  690: 'TIER_3_PREMIUM_690',
};

// ============================================================================
// WEBHOOK — firma verificata
// ============================================================================
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe non configurato' });

  const sig = req.headers['stripe-signature'];
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
// CHECKOUT COMPLETATO
// ============================================================================
async function handleCheckoutCompleted(session) {
  const reportId    = session.metadata?.reportId;
  const clientEmail = session.customer_email;
  if (!reportId) { console.warn('[STRIPE] reportId mancante'); return; }

  const amountEuro = session.amount_total / 100;
  const tier       = TIER_MAPPING[amountEuro] || 'TIER_4_ENTERPRISE_API';

  // Idempotency: controlla se gia processato
  const existing = await prisma.idempotencyKey.findFirst({
    where: { jobId: reportId, operation: 'stripe_checkout', status: 'SUCCESS' },
  });
  if (existing) { console.log(`[STRIPE] Checkout gia processato per ${reportId}`); return; }

  await prisma.$transaction(async (tx) => {
    await tx.immobile.update({
      where: { jobId: reportId },
      data:  { pagato: true, livelloCommerciale: tier },
    });
    await tx.jobEvent.create({
      data: {
        jobId:     reportId,
        eventType: 'PAYMENT_COMPLETED',
        metadata:  JSON.stringify({ stripeSessionId: session.id, amount: amountEuro, tier, customerEmail: clientEmail }),
      },
    });
    await tx.activityLog.create({
      data: { event: 'STRIPE_CHECKOUT_COMPLETED', dataJson: JSON.stringify({ reportId, sessionId: session.id, tier, amount: amountEuro }) },
    });
    await tx.idempotencyKey.create({
      data: {
        idempotencyKey: `checkout-${session.id}`,
        jobId:     reportId,
        operation: 'stripe_checkout',
        status:    'SUCCESS',
        result:    JSON.stringify({ tier, amount: amountEuro }),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => {});  // ignora se gia esiste
  });

  console.log(`[STRIPE] Report ${reportId} sbloccato: ${tier} (EUR ${amountEuro})`);

  // Recupera email dal record job se non nella sessione Stripe
  const email = clientEmail || await (async () => {
    try {
      const j = await prisma.job.findUnique({ where: { id: reportId } });
      return JSON.parse(j?.payload || '{}').email || null;
    } catch { return null; }
  })();

  // Avvia generazione PDF + notifica email (flow report → notify)
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
    console.error(`[STRIPE] Errore avvio report dopo pagamento per ${reportId}:`, err.message);
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
    customer_email: clientEmail || undefined,
    metadata:      { reportId, tier },
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