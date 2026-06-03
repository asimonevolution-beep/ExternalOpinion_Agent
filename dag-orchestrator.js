/**
 * EXTERNAL OPINION — DAG ORCHESTRATOR V18.3 (REMEDIATION P0)
 * Direzione Tecnica: Geometra Simone Azzali
 * * Pipeline Sincrona e Sequenziale In-Process (Zero Code / Zero Infra)
 */

const crypto = require('crypto');
const prisma = require('./db');
const { recordJobEvent } = require('./orchestrator');

// Importazione dei moduli disaccoppiati
const { processScraperTask } = require('./src/workers/worker-scraper');
const { processOcrTask } = require('./src/workers/worker-ocr');
const { processLlmTask } = require('./src/workers/worker-llm');
const { processScoringTask } = require('./src/workers/worker-scoring');
const { processReportTask } = require('./src/workers/worker-report');
const { processReviewTask } = require('./src/workers/worker-review');
const { processNotifyTask } = require('./src/workers/worker-notify');

const PRIORITY_MAP = {
  TIER_1_CASCADE_79: 1,
  TIER_1_SCREENING_69: 1,
  TIER_1_ENTRY_89: 2,
  TIER_2_ADVISORY_150: 5,
  TIER_3_PREMIUM_690: 10,
  TIER_4_ENTERPRISE_API: 50,
};

// CIRCUIT BREAKER MOCK / LIGHTWEIGHT
class CircuitBreaker {
  constructor(serviceName) { this.serviceName = serviceName; }
  async canExecute() { return true; }
  recordSuccess() {}
  recordFailure() {}
}
const circuitBreakers = { pipeline: new CircuitBreaker('pipeline') };

// MOCK BULLMQ INTERFACES FOR SERVER COMPATIBILITY
const createMockQueue = (name) => ({
  name,
  add: async () => ({ id: crypto.randomBytes(4).toString('hex') }),
  getJob: async () => null,
  clean: async () => [],
  getJobCounts: async () => ({ active: 0, completed: 0, failed: 0, delayed: 0, waiting: 0 }),
});

const scrapeQueue = createMockQueue('scrapeQueue');
const ocrQueue = createMockQueue('ocrQueue');
const llmExtractionQueue = createMockQueue('llmExtractionQueue');
const deterministicScoringQueue = createMockQueue('deterministicScoringQueue');
const reportRenderQueue = createMockQueue('reportRenderQueue');
const notificationQueue = createMockQueue('notificationQueue');
const reviewQueue = createMockQueue('reviewQueue');

const flowProducer = {
  add: async () => ({ job: { id: crypto.randomBytes(4).toString('hex') } })
};
function getFlowProducer() { return flowProducer; }

// IDEMPOTENCY MOCK / FALLBACK NATIVO
async function getOrCreateIdempotencyKey(key) { return { isUnique: true }; }
async function recordIdempotencyResult(key, res) {}

// PIPELINE PRINCIPALE IN-PROCESS (LA MATRICE REALE)
async function createAnalysisPipeline(payload, tier = 'TIER_1_ENTRY_89') {
  const jobId = crypto.randomBytes(8).toString('hex');
  const url = payload.url || payload.urlOriginale;
  const priority = PRIORITY_MAP[tier] || 2;

  await recordJobEvent(jobId, 'DAG_CREATED', { tier, priority, url }, 'orchestrator');

  // Esecuzione sequenziale asincrona in-process (No Redis, No BullMQ workers)
  (async () => {
    try {
      const mockJob = (data) => ({ jobId, data });

      // Step 1: Scraper
      await recordJobEvent(jobId, 'STAGE_STARTED', { stage: 'SCRAPE' }, 'orchestrator');
      const scrapeRes = await processScraperTask(mockJob(payload));

      // Step 2: OCR
      await recordJobEvent(jobId, 'STAGE_STARTED', { stage: 'OCR' }, 'orchestrator');
      const ocrRes = await processOcrTask(mockJob(scrapeRes));

      // Step 3: LLM Extraction
      await recordJobEvent(jobId, 'STAGE_STARTED', { stage: 'LLM_EXTRACTION' }, 'orchestrator');
      const llmRes = await processLlmTask(mockJob(ocrRes));

      // Step 4: Deterministic Scoring
      await recordJobEvent(jobId, 'STAGE_STARTED', { stage: 'SCORING' }, 'orchestrator');
      const scoringRes = await processScoringTask(mockJob(llmRes));

      // Step 5: Report Render
      await recordJobEvent(jobId, 'STAGE_STARTED', { stage: 'REPORT' }, 'orchestrator');
      const reportRes = await processReportTask(mockJob(scoringRes));

      // Step 6: Review
      await recordJobEvent(jobId, 'STAGE_STARTED', { stage: 'REVIEW' }, 'orchestrator');
      const reviewRes = await processReviewTask(mockJob(reportRes));

      // Step 7: Notification
      await recordJobEvent(jobId, 'STAGE_STARTED', { stage: 'NOTIFY' }, 'orchestrator');
      await processNotifyTask(mockJob(reviewRes));

      await recordJobEvent(jobId, 'DAG_COMPLETED', { success: true }, 'orchestrator');
    } catch (pipelineError) {
      console.error(`[PIPELINE CRITICAL ERROR] Job ${jobId} failed:`, pipelineError.message);
      await recordJobEvent(jobId, 'DAG_FAILED', { error: pipelineError.message }, 'orchestrator');
    }
  })();

  // Ritorna immediatamente l'interfaccia di compatibilità attesa dal controller web
  return {
    job: { id: jobId },
    steps: []
  };
}

module.exports = {
  createAnalysisPipeline,
  flowProducer,
  getFlowProducer,
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