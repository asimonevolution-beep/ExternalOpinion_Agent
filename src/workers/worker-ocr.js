/**
 * EXTERNAL OPINION — WORKER OCR V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 * 
 * Responsabilità:
 * - Tesseract OCR
 * - Text extraction from images
 * - Document preprocessing
 * - Image cleanup
 */

const { Worker } = require('bullmq');
const crypto = require('crypto');
const prisma = require('../../db');
const { recordJobEvent } = require('../../orchestrator');

const WORKER_ID = `ocr-${crypto.randomBytes(4).toString('hex')}`;

const { getSharedRedis } = require('../../redis-connection');
const redisConnection = getSharedRedis();

const worker = new Worker('ocrQueue', async (job) => {
  const { jobId } = job.data;
  const startTime = Date.now();

  try {
    console.log(`[OCR ${WORKER_ID}] Processing Job: ${jobId}`);
    await recordJobEvent(jobId, 'OCR_STARTED', { source: 'db_bus' }, WORKER_ID);

    // Legge testoGrezzo dal DB (salvato dal worker-scraper)
    const immobile = await prisma.immobile.findUnique({ where: { jobId } });
    const datiAttuali = immobile?.datiComputati ? JSON.parse(immobile.datiComputati) : {};
    const testoGrezzo = datiAttuali.testoGrezzo || '';
    const metadata = datiAttuali.metadata || {};
    const urlOriginale = immobile?.urlAsta || '';

    if (!testoGrezzo) throw new Error('testoGrezzo non trovato nel DB — scraper non completato?');

    // Passthrough: il testo è già pulito dallo scraper
    const testoOCR = testoGrezzo;

    // Salva testoOCR nel DB
    await prisma.immobile.update({
      where: { jobId },
      data: {
        datiComputati: JSON.stringify({ ...datiAttuali, testoOCR }),
      },
    });
    await prisma.job.update({ where: { id: jobId }, data: { status: 'OCR_DONE' } });

    const durationMs = Date.now() - startTime;
    await recordJobEvent(jobId, 'OCR_COMPLETED', { textLength: testoOCR.length, confidence: 1.0 }, WORKER_ID, durationMs);

    return { jobId, urlOriginale, testoOCR, metadata };
  } catch (err) {
    console.error(`[OCR ${WORKER_ID}] Error for Job ${jobId}:`, err.message);

    await recordJobEvent(
      jobId,
      'JOB_FAILED',
      { error: err.message, stage: 'OCR' },
      WORKER_ID
    );

    throw err;
  }
}, {
  connection: redisConnection,
  concurrency: 4,
});

worker.on('error', (err) => console.error('[WORKER ERROR] worker-ocr.js:', err.message));
worker.on('completed', (job) => {
  console.log(`[OCR ${WORKER_ID}] ✓ Completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(
    `[OCR ${WORKER_ID}] ✗ Failed (attempt ${job.attemptsMade}): ${job.id}`,
    err.message
  );
});

console.log(`[OCR ${WORKER_ID}] Ready to process ocrQueue`);

module.exports = worker;
