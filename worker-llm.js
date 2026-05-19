/**
 * EXTERNAL OPINION — WORKER LLM V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 * 
 * Responsabilità:
 * - Ollama extraction
 * - Cloud fallback (OpenAI, Claude)
 * - JSON validation
 * - Confidence gating
 * - Circuit breaker protected
 */

const { Worker } = require('bullmq');
const { z } = require('zod');
const crypto = require('crypto');
const prisma = require('./db');
const { recordJobEvent, validateConfidenceThreshold } = require('./orchestrator');
const { estraiDatiConFallback } = require('./ai-fallback-handler');

const WORKER_ID = `llm-${crypto.randomBytes(4).toString('hex')}`;

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

// Schema validazione
const SchemaEstrazioneAI = z.object({
  costiSanatoria: z.number().int().nonnegative(),
  costiRipristino: z.number().int().nonnegative(),
  statoImmobile: z.enum([
    'STATO_OTTIMO',
    'STATO_BUONO',
    'STATO_MEDIO',
    'STATO_CRITICO',
  ]),
  difformita: z.object({
    strutturale: z.boolean(),
    urbanistica: z.boolean(),
    catastale: z.boolean(),
  }),
  confidence: z.number().min(0).max(1),
  source: z.object({
    document: z.string(),
    page: z.number().int(),
    paragraph: z.number().int(),
  }),
});

const worker = new Worker('llmExtractionQueue', async (job) => {
  const { jobId, urlOriginale, testoOCR, metadata } = job.data;
  const startTime = Date.now();

  try {
    console.log(`[LLM ${WORKER_ID}] Processing Job: ${jobId}`);

    await recordJobEvent(jobId, 'LLM_PARSE_STARTED', {}, WORKER_ID);

    // Estrai con fallback (Ollama → OpenAI → Claude)
    const extractionResult = await estraiDatiConFallback(testoOCR);

    if (!extractionResult.success) {
      throw new Error('EXTRACTION_FAILED_ALL_BACKENDS');
    }

    const datiEstrattiEValidati = extractionResult.data;

    // Validazione confidence (>= 0.80)
    validateConfidenceThreshold(datiEstrattiEValidati.confidence, 0.8);

    // Salva versione modello usato
    const modelHash = crypto
      .createHash('sha256')
      .update(extractionResult.model)
      .digest('hex');

    const durationMs = Date.now() - startTime;

    await recordJobEvent(
      jobId,
      'LLM_PARSE_COMPLETED',
      {
        confidence: datiEstrattiEValidati.confidence,
        model: extractionResult.model,
        duration: durationMs,
      },
      WORKER_ID,
      durationMs,
      extractionResult.model
    );

    return {
      jobId,
      urlOriginale,
      datiEstrattiEValidati,
      metadata,
      aiModel: extractionResult.model,
    };
  } catch (err) {
    console.error(`[LLM ${WORKER_ID}] Error for Job ${jobId}:`, err.message);

    await recordJobEvent(
      jobId,
      'JOB_FAILED',
      { error: err.message, stage: 'LLM_EXTRACTION' },
      WORKER_ID
    );

    throw err;
  }
}, {
  connection: redisConnection,
  concurrency: 2, // LLM è pesante
});

worker.on('completed', (job) => {
  console.log(`[LLM ${WORKER_ID}] ✓ Completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(
    `[LLM ${WORKER_ID}] ✗ Failed (attempt ${job.attemptsMade}): ${job.id}`,
    err.message
  );
});

console.log(`[LLM ${WORKER_ID}] Ready to process llmExtractionQueue`);

module.exports = worker;
