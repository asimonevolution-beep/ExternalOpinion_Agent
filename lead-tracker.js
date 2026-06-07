'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * EVENT TYPES
 *   FORM_SUBMITTED   — utente invia URL + email in /api/analyze
 *   JOB_CREATED      — Job Prisma creato con successo (jobId presente)
 *   PAYWALL_HIT      — utente richiede checkout /api/jobs/:id/checkout
 *   CHECKOUT_STARTED — sessione Stripe creata
 *   PAYMENT_SUCCESS  — webhook Stripe payment_intent.succeeded
 */

/**
 * Fire-and-forget: non lancia mai eccezioni al chiamante.
 * @param {{ eventType: string, email?: string, url?: string, tier?: string, jobId?: string, ip?: string, source?: string, metadata?: object }} opts
 */
async function trackLead(opts) {
  try {
    const { eventType, email, url, tier, jobId, ip, source, metadata } = opts;
    await prisma.leadEvent.create({
      data: {
        eventType,
        email:    email   || null,
        url:      url     || null,
        tier:     tier    || null,
        jobId:    jobId   || null,
        ip:       ip      || null,
        source:   source  || null,
        metadata: metadata ? JSON.stringify(metadata) : '{}',
      },
    });
  } catch (err) {
    // silenzioso — il lead tracker non deve mai bloccare il flusso principale
    console.warn('[LeadTracker] write failed (non-critical):', err.message);
  }
}

module.exports = { trackLead };
