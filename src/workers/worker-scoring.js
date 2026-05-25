/**
 * EXTERNAL OPINION — WORKER SCORING V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 *
 * Responsabilita:
 * - Deterministic Logic Engine ONLY (ZERO AI)
 * - Coherence Index, Valuation Engine, ROI Engine
 * - Aggiornamento Immobile nel DB
 * - Forensic hashing SHA-256
 * - Explainability completa
 */

const { Worker } = require('bullmq');
const crypto = require('crypto');
const prisma = require('../../db');
const { recordJobEvent, safeRoiCalculation } = require('../../orchestrator');
const { generaRelazioneCompletaSpiegata } = require('../../explainability-engine');

const WORKER_ID = `scoring-${crypto.randomBytes(4).toString('hex')}`;

const { getSharedRedis } = require('../../redis-connection');
const redisConnection = getSharedRedis();

const COEFFICIENTI_DEGRADO = {
  STATO_OTTIMO:   1.0,
  STATO_BUONO:    0.85,
  STATO_MEDIO:    0.6,
  STATO_CRITICO:  0.2,
};

// ============================================================================
// DETERMINISTIC LOGIC ENGINE — NO AI ALLOWED
// ============================================================================

function eseguiMotoreDeterministico(datiAI, parametriMercato) {
  const { valoreOMI, trendZona, anniProiezione } = parametriMercato;
  const { costiSanatoria, costiRipristino, statoImmobile, difformita } = datiAI;

  // --- Coherence Index ---
  let penalty = 0;
  if (difformita.strutturale)  penalty += 0.50;
  if (difformita.urbanistica)  penalty += 0.35;
  if (difformita.catastale)    penalty += 0.15;
  const coherenceIndex = Math.max(0, 100 * (1 - penalty));

  // --- Valuation Engine ---
  const c_degrado            = COEFFICIENTI_DEGRADO[statoImmobile] || 0.6;
  const valoreAttuale        = valoreOMI * c_degrado;
  const valorePotenziale     = valoreOMI;
  const valoreFuturoProiettato = valorePotenziale * Math.pow(1 + trendZona, anniProiezione);

  // --- ROI Engine ---
  const costiTotaliOperativi      = (costiSanatoria || 0) + (costiRipristino || 0);
  const margineReale              = valorePotenziale - costiTotaliOperativi;
  const profittoFuturoPostRivendita = valoreFuturoProiettato - costiTotaliOperativi;
  const roiCalcolato              = safeRoiCalculation(margineReale, costiTotaliOperativi);

  return {
    coherenceIndex:            parseFloat(coherenceIndex.toFixed(2)),
    semaforo:                  coherenceIndex > 70 ? 'VERDE' : coherenceIndex > 40 ? 'GIALLO' : 'ROSSO',
    valoreAttuale:             Math.round(valoreAttuale),
    valorePotenziale:          Math.round(valorePotenziale),
    valoreFuturoProiettato:    Math.round(valoreFuturoProiettato),
    margineReale:              Math.round(margineReale),
    profittoFuturoPostRivendita: Math.round(profittoFuturoPostRivendita),
    costiTotaliOperativi:      Math.round(costiTotaliOperativi),
    roi:                       parseFloat(roiCalcolato.toFixed(2)),
    roiConveniente:            roiCalcolato > 18,
  };
}

// ============================================================================
// WORKER
// ============================================================================

const worker = new Worker('deterministicScoringQueue', async (job) => {
  const { jobId, tier } = job.data;
  const startTime = Date.now();

  try {
    console.log(`[SCORING ${WORKER_ID}] Processing Job: ${jobId}`);
    await recordJobEvent(jobId, 'SCORING_STARTED', {}, WORKER_ID);

    // Legge datiAI e parametri dal DB (salvati dal worker-llm)
    const immobile = await prisma.immobile.findUnique({ where: { jobId } });
    const datiAttuali = immobile?.datiComputati ? JSON.parse(immobile.datiComputati) : {};
    const datiEstrattiEValidati = datiAttuali.datiAI;
    const aiModel = datiAttuali.aiModel || 'unknown';
    const urlOriginale = immobile?.urlAsta || '';
    const metadata = datiAttuali.metadata || {};

    if (!datiEstrattiEValidati) throw new Error('datiAI non trovati nel DB — LLM non completato?');

    const parametriMercato = {
      valoreOMI:       immobile?.valoreOMI || 2100,
      trendZona:       0.02,
      anniProiezione:  2,
    };

    // MOTORE DETERMINISTICO
    const calcoliScoring = eseguiMotoreDeterministico(datiEstrattiEValidati, parametriMercato);

    // Explainability
    const spiegazione = generaRelazioneCompletaSpiegata(calcoliScoring, datiEstrattiEValidati);

    // Forensic hash SHA-256
    const canonicalJSON = JSON.stringify({
      jobId,
      timestamp:     new Date().toISOString(),
      calcoliScoring,
      datiEstrazione: {
        confidence: datiEstrattiEValidati.confidence,
        source:     datiEstrattiEValidati.source,
      },
    }, null, 0);
    const hashScoring = crypto.createHash('sha256').update(canonicalJSON).digest('hex');

    // Salva AuditHash (payload come stringa JSON)
    await prisma.auditHash.create({
      data: {
        jobId,
        stepName:  'SCORING',
        hashValue:  hashScoring,
        payload:    JSON.stringify({ calcoliScoring, parametriMercato }),
        workerId:   WORKER_ID,
      },
    });

    // Aggiorna Immobile con tutti i risultati calcolati
    await prisma.immobile.update({
      where: { jobId },
      data: {
        status:                      calcoliScoring.semaforo,
        coherenceIndex:              calcoliScoring.coherenceIndex,
        valoreAttuale:               calcoliScoring.valoreAttuale,
        valorePotenziale:            calcoliScoring.valorePotenziale,
        valoreFuturoProiettato:      calcoliScoring.valoreFuturoProiettato,
        margineReale:                calcoliScoring.margineReale,
        profittoFuturoPostRivendita: calcoliScoring.profittoFuturoPostRivendita,
        roi:                         calcoliScoring.roi,
        roiConveniente:              calcoliScoring.roiConveniente,
        confidenceScore:             datiEstrattiEValidati.confidence,
        datiComputati:               JSON.stringify({ calcoliScoring, spiegazione, hashScoring, aiModel: aiModel || 'unknown', datiAI: datiEstrattiEValidati }),
      },
    });

    // SCREENING termina qui: setta READY_FOR_PAYMENT per sbloccare il pagamento nel frontend
    // Tier superiori proseguono con REPORT → REVIEW → NOTIFY (status SCORED)
    const finalStatus = (tier === 'TIER_1_SCREENING_69') ? 'READY_FOR_PAYMENT' : 'SCORED';
    await prisma.job.update({
      where: { id: jobId },
      data:  { status: finalStatus, riskScore: calcoliScoring.coherenceIndex },
    });

    const durationMs = Date.now() - startTime;
    await recordJobEvent(jobId, 'SCORING_COMPLETED', {
      coherenceIndex: calcoliScoring.coherenceIndex,
      semaforo:       calcoliScoring.semaforo,
      roi:            calcoliScoring.roi,
      roiConveniente: calcoliScoring.roiConveniente,
      hashScoring,
      durationMs,
    }, WORKER_ID, durationMs);

    return { jobId, urlOriginale, calcoliScoring, spiegazione, hashScoring, metadata };

  } catch (err) {
    console.error(`[SCORING ${WORKER_ID}] Error for Job ${jobId}:`, err.message);
    await recordJobEvent(jobId, 'JOB_FAILED', { error: err.message, stage: 'SCORING' }, WORKER_ID);
    throw err;
  }
}, {
  connection:  redisConnection,
  concurrency: 8,
});

worker.on('error', (err) => console.error('[WORKER ERROR] worker-scoring.js:', err.message));
worker.on('completed', (job) => console.log(`[SCORING ${WORKER_ID}] Completed: ${job.id}`));
worker.on('failed',    (job, err) => console.error(`[SCORING ${WORKER_ID}] Failed (${job.attemptsMade}): ${job.id} — ${err.message}`));

console.log(`[SCORING ${WORKER_ID}] Ready to process deterministicScoringQueue`);
module.exports = worker;
