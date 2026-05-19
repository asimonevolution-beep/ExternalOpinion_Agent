/**
 * EXTERNAL OPINION — DAG ORCHESTRATOR V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 * 
 * Orchestrazione distribuita con BullMQ FlowProducer
 * 
 * Pipeline:
 * SCRAPE → OCR → LLM_EXTRACTION → VALIDATION → SCORING → REPORT → NOTIFY
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
  TIER_1_ENTRY_89: 1,
  TIER_2_ADVISORY_150: 5,
  TIER_3_PREMIUM_690: 10,
  TIER_4_ENTERPRISE_API: 50,
};

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

// ============================================================================
// DAG CREATION WITH FLOWPRODUCER
// ============================================================================

const flowProducer = new FlowProducer({ connection: redisConnection });

async function createAnalysisPipeline(jobId, payload, tier = 'TIER_2_ADVISORY_150') {
  const priority = PRIORITY_MAP[tier] || 1;

  console.log(
    `[DAG] Creating pipeline for ${jobId} with priority ${priority}`
  );

  // Determina task da eseguire basato sul tier
  const includeReport = tier !== 'TIER_1_ENTRY_89'; // Solo Entry salta report
  const includeNotify = tier !== 'TIER_1_ENTRY_89';

  const children = [];

  // ===== STEP 1: SCRAPE =====
  const scrapeChild = {
    name: 'scrapeJob',
    data: {
      jobId,
      url: payload.url,
    },
    opts: {
      priority,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
    children: [],
  };

  // ===== STEP 2: OCR =====
  const ocrChild = {
    name: 'ocrJob',
    data: { jobId },
    opts: {
      priority,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
    },
    children: [],
  };

  // ===== STEP 3: LLM EXTRACTION =====
  const llmChild = {
    name: 'llmExtractionJob',
    data: { jobId },
    opts: {
      priority,
      attempts: 3, // LLM ha fallback
      backoff: {
        type: 'exponential',
        delay: 10000,
      },
    },
    children: [],
  };

  // ===== STEP 4: DETERMINISTIC SCORING =====
  const scoringChild = {
    name: 'scoringJob',
    data: { jobId },
    opts: {
      priority,
      attempts: 1, // Scoring non fallisce
    },
    children: [],
  };

  // ===== STEP 5: REPORT RENDERING (conditionale) =====
  if (includeReport) {
    const reportChild = {
      name: 'reportJob',
      data: { jobId },
      opts: {
        priority,
        attempts: 2,
      },
      children: [],
    };

    // ===== STEP 6: NOTIFICATION (conditionale) =====
    if (includeNotify) {
      const notifyChild = {
        name: 'notifyJob',
        data: { jobId },
        opts: {
          priority,
          attempts: 2,
        },
      };

      reportChild.children.push(notifyChild);
    }

    scoringChild.children.push(reportChild);
  }

  // Chain: SCRAPE → OCR → LLM → SCORING → [REPORT → NOTIFY]
  scrapeChild.children.push(ocrChild);
  ocrChild.children.push(llmChild);
  llmChild.children.push(scoringChild);

  // Crea flow
  const flow = await flowProducer.add({
    name: `analysis-${jobId}`,
    queueName: 'scrapeQueue',
    data: { jobId, url: payload.url },
    opts: { priority },
    children: [ocrChild, llmChild, scoringChild, ...(includeReport ? [scoringChild] : [])],
  });

  console.log(
    `[DAG] Pipeline created for ${jobId}, root job ID: ${flow.job.id}`
  );

  await recordJobEvent(jobId, 'DAG_CREATED', { tier, priority }, 'orchestrator');

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
  CircuitBreaker,
  circuitBreakers,
  getOrCreateIdempotencyKey,
  recordIdempotencyResult,
  PRIORITY_MAP,
};
