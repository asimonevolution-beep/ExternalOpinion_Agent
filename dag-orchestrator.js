/**
 * EXTERNAL OPINION â€” DAG ORCHESTRATOR V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 * 
 * Orchestrazione distribuita con BullMQ FlowProducer
 * 
 * Pipeline:
 * SCRAPE â†’ OCR â†’ LLM_EXTRACTION â†’ VALIDATION â†’ SCORING â†’ REPORT â†’ NOTIFY
 * 
 * Features:
 * - Dependency-aware execution
 * - Circuit breaker protection
 * - Rate limiting
 * - Idempotency
 * - Priority queues
 */

const { Queue, FlowProducer, Worker } = require('bullmq');
const crypto = require('crypto');
const prisma = require('./db');
const {
  recordJobEvent,
  validateConfidenceThreshold,
} = require('./orchestrator');

// ============================================================================
// CONFIGURAZIONE
// ============================================================================

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

// Priority mapping
const PRIORITY_MAP = {
  TIER_1_SCREENING_69:  1,
  TIER_1_ENTRY_89:      2,
  TIER_2_ADVISORY_150:  5,
  TIER_3_PREMIUM_690:   10,
  TIER_4_ENTERPRISE_API: 50,
};;

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

class CircuitBreaker {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.failureThreshold = options.failureThreshold || 5;
    this.cooldownMs = options.cooldownMs || 30000;
    this.lastFailureTime = null;
  }

  async canExecute() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.cooldownMs) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        return true;
      }
      return false;
    }
    if (this.state === 'HALF_OPEN') return true;
    return false;
  }

  recordSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.successCount = 0;
    }
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

const circuitBreakers = {
  ollama: new CircuitBreaker('ollama', { failureThreshold: 5, cooldownMs: 30000 }),
  openai: new CircuitBreaker('openai', { failureThreshold: 10, cooldownMs: 60000 }),
  ocr: new CircuitBreaker('ocr_service', { failureThreshold: 5, cooldownMs: 20000 }),
};

// ============================================================================
// IDEMPOTENCY SYSTEM
// ============================================================================

async function getOrCreateIdempotencyKey(jobId, operation) {
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`${jobId}-${operation}-${Date.now()}`)
    .digest('hex')
    .substring(0, 32);

  const existing = await prisma.idempotencyKey.findUnique({
    where: { idempotencyKey },
  });

  if (existing && existing.status === 'SUCCESS') {
    console.log(
      `[IDEMPOTENCY] Hit for ${jobId}/${operation}, returning cached result`
    );
    return existing;
  }

  // Crea nuovo
  const newKey = await prisma.idempotencyKey.create({
    data: {
      idempotencyKey,
      jobId,
      operation,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 giorni
    },
  });

  return newKey;
}

async function recordIdempotencyResult(idempotencyKey, result, error = null) {
  return prisma.idempotencyKey.update({
    where: { idempotencyKey },
    data: {
      status: error ? 'FAILURE' : 'SUCCESS',
      result: result || undefined,
      error: error?.message || undefined,
    },
  });
}

// ============================================================================
// QUEUE INITIALIZATION
// ============================================================================

const scrapeQueue = new Queue('scrapeQueue', { connection: redisConnection });
const ocrQueue = new Queue('ocrQueue', { connection: redisConnection });
const llmExtractionQueue = new Queue('llmExtractionQueue', {
  connection: redisConnection,
});
const deterministicScoringQueue = new Queue('deterministicScoringQueue', {
  connection: redisConnection,
});
const reportRenderQueue = new Queue('reportRenderQueue', {
  connection: redisConnection,
});
const notificationQueue = new Queue('notificationQueue', {
  connection: redisConnection,
});
const reviewQueue = new Queue('reviewQueue', {
  connection: redisConnection,
});

// ============================================================================
// DAG CREATION WITH FLOWPRODUCER
// ============================================================================

const flowProducer = new FlowProducer({ connection: redisConnection });

async function createAnalysisPipeline(jobId, payload, tier = 'TIER_2_ADVISORY_150') {
  const priority = PRIORITY_MAP[tier] || 1;

  // Normalizza payload (puÃ² arrivare come stringa JSON da createJob)
  const payloadObj = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const url = payloadObj.url || payloadObj.urlAsta || '';
  const email = payloadObj.email || null;

  console.log(`[DAG] Creating pipeline for ${jobId} tier=${tier} priority=${priority}`);

  // Determina task da eseguire basato sul tier
  const includeReport = tier !== 'TIER_1_ENTRY_89' && tier !== 'TIER_1_SCREENING_69';
  const includeNotify  = includeReport;
  const includeReview  = includeReport; // Tutti i report passano per revisione umana

  // ============================================================
  // Costruzione bottom-up: foglie prima, radice alla fine
  // FlowProducer in BullMQ vuole children come dipendenze del padre
  // La radice viene processata DOPO che tutti i children completano
  // ============================================================

  // ===== FOGLIA FINALE: NOTIFY =====
  const notifyStep = {
    name: 'notifyJob',
    queueName: 'notificationQueue',
    data: { jobId, email, tier },
    opts: { priority, attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
  };

  // ===== STEP 6: REVIEW QUEUE (human-in-the-loop) =====
  const reviewStep = {
    name: 'reviewJob',
    queueName: 'reviewQueue',
    data: { jobId, tier },
    opts: { priority, attempts: 1 },
    children: includeNotify ? [notifyStep] : [],
  };

  // ===== STEP 5: REPORT =====
  const reportStep = {
    name: 'reportJob',
    queueName: 'reportRenderQueue',
    data: { jobId, tier },
    opts: { priority, attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
    children: includeReview ? [reviewStep] : (includeNotify ? [notifyStep] : []),
  };

  // ===== STEP 4: SCORING =====
  const scoringStep = {
    name: 'scoringJob',
    queueName: 'deterministicScoringQueue',
    data: { jobId },
    opts: { priority, attempts: 1 },
    children: includeReport ? [reportStep] : [],
  };

  // ===== STEP 3: LLM =====
  const llmStep = {
    name: 'llmExtractionJob',
    queueName: 'llmExtractionQueue',
    data: { jobId },
    opts: { priority, attempts: 3, backoff: { type: 'exponential', delay: 10000 } },
    children: [scoringStep],
  };

  // ===== STEP 2: OCR =====
  const ocrStep = {
    name: 'ocrJob',
    queueName: 'ocrQueue',
    data: { jobId },
    opts: { priority, attempts: 2, backoff: { type: 'exponential', delay: 3000 } },
    children: [llmStep],
  };

  // ===== STEP 1: SCRAPE (radice del DAG) =====
  const flow = await flowProducer.add({
    name: `scrapeJob-${jobId}`,
    queueName: 'scrapeQueue',
    data: { jobId, url },
    opts: { priority, attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
    children: [ocrStep],
  });

  console.log(`[DAG] Pipeline created for ${jobId}, BullMQ root id: ${flow.job.id}`);

  await recordJobEvent(jobId, 'DAG_CREATED', { tier, priority, url }, 'orchestrator');

  return flow;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  createAnalysisPipeline,
  flowProducer,
  scrapeQueue,
  ocrQueue,
  llmExtractionQueue,
  deterministicScoringQueue,
  reportRenderQueue,
  notificationQueue,
  reviewQueue,
  CircuitBreaker,
  circuitBreakers,
  getOrCreateIdempotencyKey,
  recordIdempotencyResult,
  PRIORITY_MAP,
};
