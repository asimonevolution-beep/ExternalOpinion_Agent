/**
 * EXTERNAL OPINION — JOB WATCHDOG V1.0
 * Direzione Tecnica: Geometra Simone Azzali
 *
 * Monitora i job bloccati in stati intermedi e li rimette in pipeline.
 *
 * Logica:
 *   - PENDING > 30min      → rinserisce in BullMQ (DAG restart)
 *   - SCRAPE_DONE > 20min  → rinserisce da OCR in poi
 *   - OCR_DONE > 20min     → rinserisce da LLM in poi
 *   - LLM_DONE > 20min     → rinserisce da SCORING in poi
 *   - SCORING_DONE > 20min → rinserisce da REPORT in poi
 *   - REPORT_READY > 60min → rimette in REVIEW se non già fatto
 *
 * Eseguito ogni 10 minuti dal cron in server-v18.3.js.
 * Può anche essere chiamato manualmente via POST /api/admin/watchdog
 */

const prisma = require('./db');
const { publishJobEvent } = require('./realtime-hub');

// ============================================================================
// SOGLIE DI TIMEOUT PER STATO
// ============================================================================

const STUCK_THRESHOLDS = {
  PENDING:      30 * 60 * 1000,   // 30 min
  SCRAPE_DONE:  20 * 60 * 1000,   // 20 min
  OCR_DONE:     20 * 60 * 1000,   // 20 min
  LLM_DONE:     20 * 60 * 1000,   // 20 min
  SCORING_DONE: 20 * 60 * 1000,   // 20 min
  REPORT_READY: 60 * 60 * 1000,   // 60 min (aspetta revisione Simone)
};

// Stato → coda BullMQ di reinserimento
const RESUME_QUEUE = {
  PENDING:      'scrapeQueue',
  SCRAPE_DONE:  'ocrQueue',
  OCR_DONE:     'llmExtractionQueue',
  LLM_DONE:     'deterministicScoringQueue',
  SCORING_DONE: 'reportRenderQueue',
  REPORT_READY: 'reviewQueue',
};

// ============================================================================
// FUNZIONE PRINCIPALE
// ============================================================================

async function runWatchdog(opts = {}) {
  const { dryRun = false, maxRetry = 3 } = opts;
  const now = new Date();
  const report = { checked: 0, stuck: 0, restarted: 0, skipped: 0, errors: [], ts: now.toISOString() };

  console.log(`[WATCHDOG] Avvio scan job bloccati — dryRun=${dryRun}`);

  for (const [status, thresholdMs] of Object.entries(STUCK_THRESHOLDS)) {
    const cutoff = new Date(now.getTime() - thresholdMs);

    const stuckJobs = await prisma.job.findMany({
      where: {
        status,
        updatedAt: { lt: cutoff },
      },
      select: {
        id: true,
        url: true,
        status: true,
        updatedAt: true,
        payload: true,
      },
      take: 20,
    });

    report.checked += stuckJobs.length;

    for (const job of stuckJobs) {
      const ageMin = Math.round((now - new Date(job.updatedAt)) / 60000);
      console.log(`[WATCHDOG] Job bloccato: ${job.id} | status=${status} | età=${ageMin}min`);
      report.stuck++;

      // Controlla tentativi watchdog già fatti
      const pastRetries = await prisma.jobEvent.count({
        where: { jobId: job.id, eventType: 'WATCHDOG_RESTART' },
      });

      if (pastRetries >= maxRetry) {
        console.log(`[WATCHDOG] Job ${job.id} ha già ${pastRetries} restart — marcato WATCHDOG_FAILED`);
        if (!dryRun) {
          await prisma.job.update({
            where: { id: job.id },
            data: { status: 'WATCHDOG_FAILED' },
          });
          await recordWatchdogEvent(job.id, 'WATCHDOG_FAILED', { reason: 'max_retries', pastRetries, status });
        }
        report.skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`[WATCHDOG DRY] Avrei riavviato: ${job.id} → coda ${RESUME_QUEUE[status]}`);
        report.restarted++;
        continue;
      }

      try {
        await restartJob(job, status);
        report.restarted++;
      } catch (err) {
        console.error(`[WATCHDOG] Errore restart ${job.id}:`, err.message);
        report.errors.push({ jobId: job.id, error: err.message });
      }
    }
  }

  console.log(`[WATCHDOG] Completato: ${report.checked} job controllati, ${report.stuck} bloccati, ${report.restarted} riavviati`);
  return report;
}

// ============================================================================
// RESTART SINGOLO JOB
// ============================================================================

async function restartJob(job, fromStatus) {
  const { getSharedRedis } = require('./redis-connection');
  const { Queue } = require('bullmq');
  const redisConnection = getSharedRedis();

  const queueName = RESUME_QUEUE[fromStatus];
  const queue = new Queue(queueName, { connection: redisConnection });

  // Determina tier dal payload
  let tier = 'TIER_1_CASCADE_79';
  let email = null;
  try {
    const payload = JSON.parse(job.payload || '{}');
    tier  = payload.tier  || tier;
    email = payload.email || null;
  } catch (_) {}

  // Reinserisce in coda BullMQ
  await queue.add(`watchdog-restart-${job.id}`, { jobId: job.id, tier, email }, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    priority: 5,
  });

  // Aggiorna stato → PENDING (così il worker lo elabora)
  if (fromStatus === 'PENDING') {
    // Già PENDING — non modifichiamo lo stato, solo reinserisce in coda
  }

  await recordWatchdogEvent(job.id, 'WATCHDOG_RESTART', {
    fromStatus,
    targetQueue: queueName,
    ageMin: Math.round((Date.now() - new Date(job.updatedAt)) / 60000),
  });

  await publishJobEvent(job.id, 'WATCHDOG_RESTART', { fromStatus, targetQueue: queueName }).catch(() => {});

  console.log(`[WATCHDOG] ✓ Riavviato: ${job.id} → ${queueName}`);
}

// ============================================================================
// EVENT SOURCING
// ============================================================================

async function recordWatchdogEvent(jobId, eventType, metadata) {
  try {
    const crypto = require('crypto');
    await prisma.jobEvent.create({
      data: {
        jobId,
        eventType,
        workerId:           'watchdog',
        logicEngineVersion: '18.0',
        payloadHash: crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),
        metadata: JSON.stringify(metadata),
      },
    });
  } catch (_) {}
}

// ============================================================================
// SNAPSHOT STATO (senza modifiche — per la dashboard)
// ============================================================================

async function getStuckJobsSnapshot() {
  const now = new Date();
  const result = {};

  for (const [status, thresholdMs] of Object.entries(STUCK_THRESHOLDS)) {
    const cutoff = new Date(now.getTime() - thresholdMs);
    const jobs = await prisma.job.findMany({
      where: { status, updatedAt: { lt: cutoff } },
      select: { id: true, url: true, updatedAt: true },
      take: 10,
    });
    if (jobs.length > 0) {
      result[status] = jobs.map(j => ({
        id:     j.id,
        url:    j.url?.slice(0, 80),
        ageMin: Math.round((now - new Date(j.updatedAt)) / 60000),
      }));
    }
  }

  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = { runWatchdog, restartJob, getStuckJobsSnapshot, STUCK_THRESHOLDS, RESUME_QUEUE };
