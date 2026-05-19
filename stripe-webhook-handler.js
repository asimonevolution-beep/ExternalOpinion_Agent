/**
 * EXTERNAL OPINION — STRIPE WEBHOOK HANDLER V18.2
 * Direzione Tecnica: Geometra Simone Azzali
 * 
 * Gestisce pagamenti Stripe, route transazionali atomiche e integrazione
 * con il modello di business a 4 tier.
 */

const express = require('express');
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey && stripeKey.startsWith('sk_') ? require('stripe')(stripeKey) : null;
const prisma = require('./db');

// ============================================================================
// CONFIGURAZIONE ROUTER
// ============================================================================

const router = express.Router();

// ============================================================================
// CONSTANTS
// ============================================================================

const TARIFFE = {
  ENTRY: 89,
  ADVISORY: 150,
  PREMIUM: 690,
};

const TIER_MAPPING = {
  89: 'TIER_1_ENTRY_89',
  150: 'TIER_2_ADVISORY_150',
  690: 'TIER_3_PREMIUM_690',
};

// ============================================================================
// WEBHOOK HANDLER (Hardened)
// ============================================================================

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    // Validazione CRITICA della firma webhook
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error(`[STRIPE WEBHOOK] Firma non valida: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(
      `[STRIPE WEBHOOK] Evento ricevuto: ${event.type} (id: ${event.id})`
    );

    try {
      // ===== EVENT: CHECKOUT COMPLETATO =====
      if (event.type === 'checkout.session.completed') {
        await handleCheckoutSessionCompleted(event.data.object);
      }

      // ===== EVENT: PAGAMENTO COMPLETATO =====
      else if (event.type === 'payment_intent.succeeded') {
        await handlePaymentIntentSucceeded(event.data.object);
      }

      // ===== EVENT: PAGAMENTO FALLITO =====
      else if (event.type === 'payment_intent.payment_failed') {
        await handlePaymentIntentFailed(event.data.object);
      }

      // ===== EVENT: RICHIESTA RIMBORSO =====
      else if (event.type === 'charge.refunded') {
        await handleChargeRefunded(event.data.object);
      }

      return res.json({ received: true });
    } catch (err) {
      console.error(`[STRIPE WEBHOOK] Errore handler: ${err.message}`);
      return res.status(500).json({
        received: true,
        error: err.message,
      });
    }
  }
);

// ============================================================================
// HANDLER: CHECKOUT SESSION COMPLETED
// ============================================================================

async function handleCheckoutSessionCompleted(session) {
  console.log(
    `[STRIPE] Checkout completato: session=${session.id}, amount=${session.amount_total}`
  );

  const reportId = session.metadata?.reportId;
  const clientEmail = session.customer_email;

  if (!reportId) {
    console.warn('[STRIPE] reportId mancante in metadata');
    return;
  }

  const amountEuro = session.amount_total / 100;
  const tier = TIER_MAPPING[amountEuro] || 'TIER_4_ENTERPRISE_API';

  try {
    // Transazione atomica CRITICA
    const result = await prisma.$transaction(async (tx) => {
      // 1. Aggiorna Immobile
      const immobileUpdated = await tx.immobile.update({
        where: { jobId: reportId },
        data: {
          pagato: true,
          livelloCommerciale: tier,
        },
      });

      // 2. Registra evento
      await tx.jobEvent.create({
        data: {
          jobId: reportId,
          eventType: 'JOB_COMPLETED',
          metadata: {
            stripeSessionId: session.id,
            paymentMethod: 'stripe',
            amount: amountEuro,
            tier,
            customerEmail: clientEmail,
          },
        },
      });

      // 3. Registra nel log
      await tx.activityLog.create({
        data: {
          event: 'STRIPE_CHECKOUT_COMPLETED',
          dataJson: {
            reportId,
            sessionId: session.id,
            tier,
            amount: amountEuro,
          },
        },
      });

      return immobileUpdated;
    });

    console.log(
      `[STRIPE] ✓ Report ${reportId} sbloccato in modalità: ${tier} (€${amountEuro})`
    );
  } catch (err) {
    console.error(
      `[STRIPE] ✗ Errore transazione per ${reportId}: ${err.message}`
    );
    throw err;
  }
}

// ============================================================================
// HANDLER: PAYMENT INTENT SUCCEEDED
// ============================================================================

async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log(
    `[STRIPE] Payment Intent succeeded: ${paymentIntent.id} (status: ${paymentIntent.status})`
  );

  try {
    await prisma.activityLog.create({
      data: {
        event: 'STRIPE_PAYMENT_INTENT_SUCCEEDED',
        dataJson: {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          metadata: paymentIntent.metadata,
        },
      },
    });
  } catch (err) {
    console.error(`[STRIPE] Errore log per payment intent: ${err.message}`);
  }
}

// ============================================================================
// HANDLER: PAYMENT INTENT FAILED
// ============================================================================

async function handlePaymentIntentFailed(paymentIntent) {
  console.error(
    `[STRIPE] Payment Intent FAILED: ${paymentIntent.id} (${paymentIntent.last_payment_error.message})`
  );

  const reportId = paymentIntent.metadata?.reportId;

  if (reportId) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.jobEvent.create({
          data: {
            jobId: reportId,
            eventType: 'JOB_FAILED',
            metadata: {
              reason: 'STRIPE_PAYMENT_FAILED',
              paymentIntentId: paymentIntent.id,
              errorMessage: paymentIntent.last_payment_error.message,
            },
          },
        });

        await tx.activityLog.create({
          data: {
            event: 'STRIPE_PAYMENT_FAILED',
            dataJson: {
              reportId,
              paymentIntentId: paymentIntent.id,
              error: paymentIntent.last_payment_error.message,
            },
          },
        });
      });

      console.log(`[STRIPE] ✓ Failure logged per ${reportId}`);
    } catch (err) {
      console.error(
        `[STRIPE] Errore logging payment failure: ${err.message}`
      );
    }
  }
}

// ============================================================================
// HANDLER: CHARGE REFUNDED
// ============================================================================

async function handleChargeRefunded(charge) {
  console.log(
    `[STRIPE] Charge REFUNDED: ${charge.id} (amount: ${charge.amount_refunded})`
  );

  const reportId = charge.metadata?.reportId;

  if (reportId) {
    try {
      await prisma.$transaction(async (tx) => {
        // Aggiorna Immobile: revoca pagamento
        await tx.immobile.update({
          where: { jobId: reportId },
          data: {
            pagato: false,
            livelloCommerciale: null,
          },
        });

        // Registra evento
        await tx.jobEvent.create({
          data: {
            jobId: reportId,
            eventType: 'JOB_FAILED',
            metadata: {
              reason: 'STRIPE_REFUND',
              chargeId: charge.id,
              refundAmount: charge.amount_refunded / 100,
            },
          },
        });

        // Log attività
        await tx.activityLog.create({
          data: {
            event: 'STRIPE_CHARGE_REFUNDED',
            dataJson: {
              reportId,
              chargeId: charge.id,
              refundAmount: charge.amount_refunded / 100,
            },
          },
        });
      });

      console.log(`[STRIPE] ✓ Refund processed per ${reportId}`);
    } catch (err) {
      console.error(
        `[STRIPE] Errore processing refund per ${reportId}: ${err.message}`
      );
    }
  }
}

// ============================================================================
// UTILITY: CREATE CHECKOUT SESSION
// ============================================================================

async function createCheckoutSession(reportId, tier, clientEmail = null) {
  const prices = {
    TIER_1_ENTRY_89: { amount: 8900, label: 'Entry Report (€89)' },
    TIER_2_ADVISORY_150: { amount: 15000, label: 'Advisory Report (€150)' },
    TIER_3_PREMIUM_690: { amount: 69000, label: 'Premium Report (€690)' },
  };

  if (!prices[tier]) {
    throw new Error(`Tier non valido: ${tier}`);
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: prices[tier].label,
            description: `External Opinion Report - ${tier}`,
          },
          unit_amount: prices[tier].amount,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.BASE_URL}/success?sessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/cancel`,
    customer_email: clientEmail,
    metadata: {
      reportId,
      tier,
    },
  });

  return session;
}

// ============================================================================
// UTILITY: GET SESSION STATUS
// ============================================================================

async function getSessionStatus(sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  return {
    id: session.id,
    status: session.payment_status,
    amount: session.amount_total / 100,
    metadata: session.metadata,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  router,
  createCheckoutSession,
  getSessionStatus,
  handleCheckoutSessionCompleted,
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
  handleChargeRefunded,
};
