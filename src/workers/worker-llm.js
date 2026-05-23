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
const prisma = require('../../db');
const { recordJobEvent, validateConfidenceThreshold } = require('../../orchestrator');
const { estraiDatiConFallback } = require('../../ai-fallback-handler');

const WORKER_ID = `llm-${crypto.randomBytes(4).toString('hex')}`;

const { getRedisConnection } = require('../../redis-connection');
const redisConnection = getRedisConnection();

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
  const { jobId } = job.data;
  const startTime = Date.now();

  try {
    console.log(`[LLM ${WORKER_ID}] Processing Job: ${jobId}`);
    await recordJobEvent(jobId, 'LLM_PARSE_STARTED', {}, WORKER_ID);

    // Legge testoOCR dal DB (salvato dal worker-ocr)
    const immobile = await prisma.immobile.findUnique({ where: { jobId } });
    const datiAttuali = immobile?.datiComputati ? JSON.parse(immobile.datiComputati) : {};
    const testoOCR = datiAttuali.testoOCR || datiAttuali.testoGrezzo || '';
    const metadata = datiAttuali.metadata || {};
    const urlOriginale = immobile?.urlAsta || '';

    if (!testoOCR) throw new Error('testoOCR non trovato nel DB — OCR non completato?');

    // Estrai con fallback (Ollama → OpenAI → Claude)
    const extractionResult = await estraiDatiConFallback(testoOCR);

    if (!extractionResult.success) {
      throw new Error('EXTRACTION_FAILED_ALL_BACKENDS');
    }

    const datiEstrattiEValidati = extractionResult.data;

    // Validazione confidence — soglia produzione 0.30 (perizie reali danno 0.85+)
    const confidenceThreshold = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.30');
    validateConfidenceThreshold(datiEstrattiEValidati.confidence, confidenceThreshold);

    // Salva datiAI nel DB per il worker-scoring
    const immobileAggiornato = await prisma.immobile.findUnique({ where: { jobId } });
    const datiAggiornati = immobileAggiornato?.datiComputati ? JSON.parse(immobileAggiornato.datiComputati) : {};
    await prisma.immobile.update({
      where: { jobId },
      data: {
        datiComputati: JSON.stringify({
          ...datiAggiornati,
          datiAI: datiEstrattiEValidati,
          aiModel: extractionResult.model,
        }),
      },
    });
    await prisma.job.update({ where: { id: jobId }, data: { status: 'LLM_DONE' } });

    const modelHash = crypto.createHash('sha256').update(extractionResult.model).digest('hex');
    const durationMs = Date.now() - startTime;

    await recordJobEvent(jobId, 'LLM_PARSE_COMPLETED', {
      confidence: datiEstrattiEValidati.confidence,
      model: extractionResult.model,
      duration: durationMs,
    }, WORKER_ID, durationMs, extractionResult.model);

    return { jobId, urlOriginale, datiEstrattiEValidati, metadata, aiModel: extractionResult.model };
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

worker.on('error', (err) => console.error('[WORKER ERROR] worker-llm.js:', err.message));
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
