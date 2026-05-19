/**
 * EXTERNAL OPINION — WORKER SCORING V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 * 
 * Responsabilità:
 * - Deterministic Logic Engine ONLY
 * - NO AI
 * - ROI, Valuation, Coherence Index
 * - Explainability
 * - Forensic hashing
 */

const { Worker } = require('bullmq');
const crypto = require('crypto');
const prisma = require('./db');
const { recordJobEvent, safeRoiCalculation } = require('./orchestrator');
const {
  generaRelazioneCompletaSpiegata,
} = require('./explainability-engine');

const WORKER_ID = `scoring-${crypto.randomBytes(4).toString('hex')}`;

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const COEFFICIENTI_DEGRADO = {
  STATO_OTTIMO: 1.0,
  STATO_BUONO: 0.85,
  STATO_MEDIO: 0.6,
  STATO_CRITICO: 0.2,
};

// ============================================================================
// DETERMINISTIC LOGIC ENGINE (NO AI)
// ============================================================================

function eseguiMotoreDeterministico(datiAI, parametriMercato) {
  const { valoreOMI, trendZona, anniProiezione } = parametriMercato;
  const { costiSanatoria, costiRipristino, statoImmobile, difformita } = datiAI;

  // Coherence Index (Sezione 6)
  let penalty = 0;
  if (difformita.strutturale) penalty += 0.5;
  if (difformita.urbanistica) penalty += 0.35;
  if (difformita.catastale) penalty += 0.15;

  const coherenceIndex = Math.max(0, 100 * (1 - penalty));

  // Valuation Engine (Sezione 7)
  const c_degrado = COEFFICIENTI_DEGRADO[statoImmobile] || 0.6;
  const valoreAttuale = valoreOMI * c_degrado;
  const valorePotenziale = valoreOMI;
  const valoreFuturoProiettato =
    valorePotenziale * Math.pow(1 + trendZona, anniProiezione);

  // ROI Engine (Sezione 8) - HARDENED
  const costiTotaliOperativi = (costiSanatoria || 0) + (costiRipristino || 0);
  const margineReale = valorePotenziale - costiTotaliOperativi;
  const profittoFuturoPostRivendita =
    valoreFuturoProiettato - costiTotaliOperativi;

  const roiCalcolato = safeRoiCalculation(margineReale, costiTotaliOperativi);

  return {
    coherenceIndex: parseFloat(coherenceIndex.toFixed(2)),
    semaforo:
      coherenceIndex > 70 ? 'VERDE' : coherenceIndex > 40 ? 'GIALLO' : 'ROSSO',
    valoreAttuale: Math.round(valoreAttuale),
    valorePotenziale: Math.round(valorePotenziale),
    valoreFuturoProiettato: Math.round(valoreFuturoProiettato),
    margineReale: Math.round(margineReale),
    profittoFuturoPostRivendita: Math.round(profittoFuturoPostRivendita),
    roi: parseFloat(roiCalcolato.toFixed(2)),
    roiConveniente: roiCalcolato > 18,
  };
}

const worker = new Worker('deterministicScoringQueue', async (job) => {
  const { jobId, urlOriginale, datiEstrattiEValidati, metadata, aiModel } =
    job.data;
  const startTime = Date.now();

  try {
    console.log(`[SCORING ${WORKER_ID}] Processing Job: ${jobId}`);

    await recordJobEvent(jobId, 'SCORING_COMPLETED', {}, WORKER_ID);

    // Parametri di mercato (da Immobile o configurazione)
    const immobile = await prisma.immobile.findUnique({
      where: { jobId },
    });

    const parametriMercato = {
      valoreOMI: immobile?.valoreOMI || 2100,
      trendZona: 0.02,
      anniProiezione: 2,
    };

    // ESECUZIONE MOTORE DETERMINISTICO
    const calcoliScoring = eseguiMotoreDeterministico(
      datiEstrattiEValidati,
      parametriMercato
    );

    // Genera spiegazione
    const spiegazione = generaRelazioneCompletaSpiegata(
      calcoliScoring,
      datiEstrattiEValidati
    );

    // SHA-256 Canonical JSON
    const canonicalJSON = JSON.stringify(
      {
        jobId,
        timestamp: new Date().toISOString(),
        calcoliScoring,
        datiEstrazione: {
          confidence: datiEstrattiEValidati.confidence,
          source: datiEstrattiEValidati.source,
        },
      },
      null,
      0
    );

    const hashScoring = crypto
      .createHash('sha256')
      .update(canonicalJSON)
      .digest('hex');

    // Salva hash audit
    await prisma.auditHash.create({
      data: {
        jobId,
        stepName: 'SCORING',
        hashValue: hashScoring,
        payload: {
          calcoliScoring,
          parametriMercato,
        },
        workerId: WORKER_ID,
      },
    });

    const durationMs = Date.now() - startTime;

    await recordJobEvent(
      jobId,
      'SCORING_COMPLETED',
      {
        coherenceIndex: calcoliScoring.coherenceIndex,
        roi: calcoliScoring.roi,
        hashScoring,
      },
      WORKER_ID,
      durationMs
    );

    return {
      jobId,
      urlOriginale,
      calcoliScoring,
      spiegazione,
      hashScoring,
      metadata,
    };
  } catch (err) {
    console.error(`[SCORING ${WORKER_ID}] Error for Job ${jobId}:`, err.message);

    await recordJobEvent(
      jobId,
      'JOB_FAILED',
      { error: err.message, stage: 'SCORING' },
      WORKER_ID
    );

    throw err;
  }
}, {
  connection: redisConnection,
  concurrency: 8, // Scoring è leggero
});

worker.on('completed', (job) => {
  console.log(`[SCORING ${WORKER_ID}] ✓ Completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(
    `[SCORING ${WORKER_ID}] ✗ Failed (attempt ${job.attemptsMade}): ${job.id}`,
    err.message
  );
});

console.log(`[SCORING ${WORKER_ID}] Ready to process deterministicScoringQueue`);

module.exports = worker;
