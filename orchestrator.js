/**
 * EXTERNAL OPINION â€” ORCHESTRATORE V18.2 (ENTERPRISE HARDENED)
 * Direzione Tecnica: Geometra Simone Azzali
 * Architettura: Distributed Deterministic Risk Processing Infrastructure
 * 
 * ResponsabilitÃ :
 * - API validation & enqueue (NON compute)
 * - Job lifecycle management
 * - Token authentication
 * - Event sourcing
 * - Stripe webhook handling
 */

const { Queue, Worker } = require('bullmq');
const crypto = require('crypto');
const prisma = require('./db');

// ============================================================================
// CONFIGURAZIONE REDIS E QUEUE
// ============================================================================

const { getSharedRedis } = require('./redis-connection');
const redisConnection = getSharedRedis();

const analysisQueue = new Queue('analysisQueue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
    timeout: 600000, // 10 min timeout per job
  },
});

// ============================================================================
// CONFIGURAZIONE TARIFFE
// ============================================================================

const TARIFFE = {
  ENTRY: 89,
  ADVISORY: 150,
  PREMIUM: 690,
};

// ============================================================================
// UTILITY: TOKEN VALIDATION
// ============================================================================

async function validateClientToken(token, service) {
  if (!token) return null;

  const clientToken = await prisma.clientToken.findUnique({
    where: { token },
  });

  if (!clientToken) {
    throw new Error('Token non valido.');
  }

  if (!clientToken.isActive) {
    throw new Error('Token non attivo.');
  }

  if (clientToken.service !== service) {
    throw new Error('Token non valido per questo servizio.');
  }

  if (new Date(clientToken.expiresAt) < new Date()) {
    throw new Error('Token scaduto.');
  }

  return clientToken;
}

// ============================================================================
// UTILITY: EVENT SOURCING
// ============================================================================

async function recordJobEvent(jobId, eventType, metadata = {}, workerId = null, durationMs = null, aiModel = null) {
  try {
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(metadata))
      .digest('hex');

    await prisma.jobEvent.create({
      data: {
        jobId,
        eventType,
        workerId,
        durationMs,
        payloadHash,
        aiModel,
        logicEngineVersion: '18.0',
        metadata: JSON.stringify(metadata),
      },
    });

    // Broadcast real-time a tutti i portali/dispositivi connessi via SSE
    try {
      const { publishJobEvent } = require('./realtime-hub');
      publishJobEvent(jobId, eventType, { workerId, aiModel, ...metadata }).catch(() => {});
    } catch (_) {}
  } catch (err) {
    console.error(`[EVENTO FALLITO] ${eventType} per Job ${jobId}:`, err.message);
  }
}

// ============================================================================
// UTILITY: ACTIVITY LOGGING
// ============================================================================

async function logActivity(event, data) {
  try {
    return await prisma.activityLog.create({
      data: {
        event,
        dataJson: typeof data === 'string' ? data : JSON.stringify(data),
      },
    });
  } catch (err) {
    console.error(`[LOG FALLITO] ${event}:`, err.message);
  }
}

// ============================================================================
// CORE: JOB CREATION (NON-BLOCKING)
// ============================================================================

async function createJob({ url, nome, ragioneSociale, email, telefono, token, service, zonaDati = {}, deferUntilPayment = false, tier = null }) {
  // Validazione input
  if (!url) {
    throw new Error('URL non fornito.');
  }

  try {
    // Transazione atomica: Job + Immobile + Event
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crea Job record
      const jobRecord = await tx.job.create({
        data: {
          url,
          status: 'PENDING',
          payload: JSON.stringify({
            url,
            nome: nome || null,
            ragioneSociale: ragioneSociale || null,
            email: email || null,
            telefono: telefono || zonaDati.telefono || null,
            clientToken: token || null,
            service: service || null,
            tier,
            deferUntilPayment: Boolean(deferUntilPayment),
            zonaDati,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      // 2. Crea Immobile record associato
      const immobileRecord = await tx.immobile.create({
        data: {
          jobId: jobRecord.id,
          urlAsta: url,
          valoreOMI: zonaDati.valoreOMI || 2100,
        },
      });

      // 3. Registra evento JOB_CREATED
      await tx.jobEvent.create({
        data: {
          jobId: jobRecord.id,
          eventType: 'JOB_CREATED',
          metadata: JSON.stringify({
            url,
            nome: nome || null,
            email: email || null,
            telefono: telefono || zonaDati.telefono || null,
            service,
          }),
          logicEngineVersion: '18.0',
        },
      });

      return { jobRecord, immobileRecord };
    });

    const { jobRecord } = result;

        // 4. NON enqueue direttamente su analysisQueue legacy:
    // il DAG pipeline viene creato da server-v18.3.js dopo createJob()
    console.log(`[JOB CREATO] ${jobRecord.id} - Pronto per DAG pipeline`);
    await logActivity('JOB_CREATED', { jobId: jobRecord.id, url });

    return jobRecord;
  } catch (err) {
    console.error(`[ERRORE JOB CREATION] ${err.message}`);
    throw err;
  }
}

// ============================================================================
// JOB RETRIEVAL & STATUS UPDATE
// ============================================================================

async function getJob(jobId) {
  return prisma.job.findUnique({
    where: { id: jobId },
    include: {
      immobile: true,
      jobEvents: {
        orderBy: { timestamp: 'asc' },
      },
    },
  });
}

async function updateJobStatus(jobId, status, extra = {}) {
  try {
    return await prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        ...extra,
      },
    });
  } catch (err) {
    console.error(`[UPDATE JOB] Errore per ${jobId}:`, err.message);
    throw err;
  }
}

// ============================================================================
// UTILITY: TIMEOUT ENGINE (Per worker)
// ============================================================================

function createTimeoutPromise(ms, operationName = 'Operation') {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`${operationName} TIMEOUT after ${ms}ms`)),
      ms
    )
  );
}

// ============================================================================
// UTILITY: STRIPE WEBHOOK HARDENING
// ============================================================================

function constructStripeEvent(rawBody, signature, secret) {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }
}

async function handleStripeCheckoutCompleted(session) {
  const targetReportId = session.metadata?.reportId;
  if (!targetReportId) {
    console.warn('[STRIPE] No reportId in session metadata');
    return;
  }

  const incassoEuro = session.amount_total / 100;

  // Mappatura esatta al modello di business
  let tierSelezionato = 'TIER_4_ENTERPRISE_API'; // Default

  if (incassoEuro === TARIFFE.ENTRY) {
    tierSelezionato = 'TIER_1_ENTRY_89';
  } else if (incassoEuro === TARIFFE.ADVISORY) {
    tierSelezionato = 'TIER_2_ADVISORY_150';
  } else if (incassoEuro === TARIFFE.PREMIUM) {
    tierSelezionato = 'TIER_3_PREMIUM_690';
  }

  try {
    // Transazione atomica: Update + Event
    await prisma.$transaction(async (tx) => {
      await tx.immobile.update({
        where: { jobId: targetReportId },
        data: {
          pagato: true,
          livelloCommerciale: tierSelezionato,
        },
      });

      await tx.jobEvent.create({
        data: {
          jobId: targetReportId,
          eventType: 'JOB_COMPLETED',
          metadata: JSON.stringify({
            paymentMethod: 'stripe',
            amount: incassoEuro,
            tier: tierSelezionato,
          }),
        },
      });
    });

    console.log(
      `[STRIPE] Report ${targetReportId} sbloccato in modalitÃ : ${tierSelezionato}`
    );
    await logActivity('STRIPE_PAYMENT_COMPLETED', {
      reportId: targetReportId,
      tier: tierSelezionato,
      amount: incassoEuro,
    });
  } catch (err) {
    console.error(`[STRIPE HANDLER] Errore per ${targetReportId}:`, err.message);
    throw err;
  }
}

// ============================================================================
// UTILITY: DIVISION-BY-ZERO PROTECTION
// ============================================================================

function safeRoiCalculation(profit, totalInvestment) {
  if (totalInvestment <= 0) {
    return 0;
  }
  return (profit / totalInvestment) * 100;
}

// ============================================================================
// UTILITY: CONFIDENCE GATING
// ============================================================================

function validateConfidenceThreshold(confidence, threshold = 0.80) {
  if (confidence < threshold) {
    throw new Error(
      `LOW_CONFIDENCE_EXTRACTION: ${confidence} < ${threshold} threshold`
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  analysisQueue,
  validateClientToken,
  recordJobEvent,
  logActivity,
  createJob,
  getJob,
  updateJobStatus,
  createTimeoutPromise,
  constructStripeEvent,
  handleStripeCheckoutCompleted,
  safeRoiCalculation,
  validateConfidenceThreshold,
  TARIFFE,
};
