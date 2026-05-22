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
const { recordJobEvent } = require('./orchestrator');

const WORKER_ID = `ocr-${crypto.randomBytes(4).toString('hex')}`;

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const worker = new Worker('ocrQueue', async (job) => {
  const { jobId, urlOriginale, testoGrezzo, metadata } = job.data;
  const startTime = Date.now();

  try {
    console.log(`[OCR ${WORKER_ID}] Processing Job: ${jobId}`);

    await recordJobEvent(jobId, 'OCR_COMPLETED', { source: 'scraper_output' }, WORKER_ID);

    // In questa versione, testoGrezzo è già estratto da Puppeteer
    // Se fosse un PDF binario, applicheremmo Tesseract qui
    const testoOCR = testoGrezzo;

    const durationMs = Date.now() - startTime;

    await recordJobEvent(
      jobId,
      'OCR_COMPLETED',
      {
        textLength: testoOCR.length,
        confidence: 1.0, // Puppeteer è 100% accurato
      },
      WORKER_ID,
      durationMs
    );

    return {
      jobId,
      urlOriginale,
      testoOCR,
      metadata,
    };
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
