/**
 * EXTERNAL OPINION — WORKER REVIEW V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 *
 * Responsabilita:
 * - Riceve il job dopo REPORT_READY
 * - Inserisce il report nella ReviewQueue del DB
 * - Invia email a Simone con link al pannello admin
 * - Il job rimane in stato PENDING_REVIEW finche Simone approva/rifiuta
 * - Solo dopo approvazione viene triggerato notificationQueue
 */

const { Worker, Queue } = require('bullmq');
const crypto            = require('crypto');
const prisma            = require('./db');
const { recordJobEvent } = require('./orchestrator');
const { addToReviewQueue } = require('./review-queue');

const WORKER_ID = `review-${crypto.randomBytes(4).toString('hex')}`;

const { getRedisConnection } = require('./redis-connection');
const redisConnection = getRedisConnection();

const notificationQueue = new Queue('notificationQueue', { connection: redisConnection });

const worker = new Worker('reviewQueue', async (job) => {
  const { jobId, tier } = job.data;
  const startTime = Date.now();

  try {
    console.log(`[REVIEW ${WORKER_ID}] Processing review for Job: ${jobId}`);
    await recordJobEvent(jobId, 'REVIEW_QUEUED', { tier }, WORKER_ID);

    // Leggi dati dal DB
    const immobile  = await prisma.immobile.findUnique({ where: { jobId } });
    const jobRecord = await prisma.job.findUnique({ where: { id: jobId } });
    if (!immobile) throw new Error(`Immobile non trovato: ${jobId}`);

    // Costruisci sommario per il revisore
    const aiReport = {
      jobId,
      url:            jobRecord?.url || 'N/D',
      semaforo:       immobile.status,
      coherenceIndex: immobile.coherenceIndex,
      roi:            immobile.roi,
      roiConveniente: immobile.roiConveniente,
      valoreAttuale:  immobile.valoreAttuale,
      valorePotenziale: immobile.valorePotenziale,
      hashReport:     immobile.hashReport,
      tier,
      generatedAt:    new Date().toISOString(),
    };

    // Inserisci in ReviewQueue + notifica Simone via email
    await addToReviewQueue(jobId, aiReport, jobRecord?.url);

    // Aggiorna Job status
    await prisma.job.update({
      where: { id: jobId },
      data:  { status: 'PENDING_REVIEW' },
    });

    const durationMs = Date.now() - startTime;
    await recordJobEvent(jobId, 'REVIEW_QUEUED', {
      semaforo: immobile.status,
      reviewUrl: `/admin/review/${jobId}`,
      durationMs,
    }, WORKER_ID, durationMs);

    console.log(`[REVIEW ${WORKER_ID}] Job ${jobId} in attesa di revisione — semaforo: ${immobile.status}`);
    return { jobId, status: 'PENDING_REVIEW' };

  } catch (err) {
    console.error(`[REVIEW ${WORKER_ID}] Error for Job ${jobId}:`, err.message);
    await recordJobEvent(jobId, 'JOB_FAILED', { error: err.message, stage: 'REVIEW' }, WORKER_ID);
    throw err;
  }
}, {
  connection:  redisConnection,
  concurrency: 4,
});

worker.on('error', (err) => console.error('[WORKER ERROR] worker-review.js:', err.message));
worker.on('completed', (job) => console.log(`[REVIEW ${WORKER_ID}] Completed: ${job.id}`));
worker.on('failed',    (job, err) => console.error(`[REVIEW ${WORKER_ID}] Failed (${job.attemptsMade}): ${job.id} — ${err.message}`));

console.log(`[REVIEW ${WORKER_ID}] Ready to process reviewQueue`);
module.exports = worker;