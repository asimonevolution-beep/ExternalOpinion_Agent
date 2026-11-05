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

const { calculateDecisionSignal, colorToSemaforo } = require('../engines/decision-signal');

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
// PRESUPPOSTI DEL GIUDIZIO
// ============================================================================
// Il valore di riferimento arriva solo dai documenti (valore di stima della
// perizia, altrimenti prezzo base d'asta). Il vecchio default fisso di 2.100 €
// produceva valori inventati per qualsiasi immobile.
// Senza perizia letta, o con estrazione poco affidabile, il sistema dichiara
// che il giudizio non è possibile invece di mostrare un semaforo e dei numeri.

const VALORE_SEGNAPOSTO_STORICO = 2100;

function determinaValoreRiferimento(datiAI, immobile) {
  if (datiAI.valoreStima > 0) return { valore: datiAI.valoreStima, fonte: 'VALORE_STIMA_PERIZIA' };
  if (datiAI.prezzoBase > 0) return { valore: datiAI.prezzoBase, fonte: 'PREZZO_BASE_ASTA' };
  const omi = immobile?.valoreOMI;
  if (omi > 0 && omi !== VALORE_SEGNAPOSTO_STORICO) return { valore: omi, fonte: 'VALORE_ZONA_FORNITO' };
  return { valore: null, fonte: null };
}

function valutaPresupposti(datiAI, metadata, soglia) {
  const motivi = [];
  if (!metadata?.periziaLetta) {
    motivi.push('Perizia non presente o non leggibile tra i documenti analizzati');
  }
  if (!(datiAI.confidence >= soglia)) {
    motivi.push(`Affidabilità dell'estrazione insufficiente (${Number(datiAI.confidence || 0).toFixed(2)} su soglia ${soglia.toFixed(2)})`);
  }
  return { giudizioPossibile: motivi.length === 0, motivi };
}

function esitoGiudizioNonPossibile(motivi, riferimento) {
  return {
    giudizioNonPossibile:        true,
    motiviGiudizioNonPossibile:  motivi,
    coherenceIndex:              null,
    semaforo:                    'GIALLO',
    decisionSignal: {
      color:          'YELLOW',
      label:          'DOCUMENTAZIONE INSUFFICIENTE — GIUDIZIO NON POSSIBILE',
      riskLevel:      'NON_VALUTABILE',
      reason:         motivi.join('. '),
      customerAction: 'Fornire la perizia completa in PDF: senza documento tecnico il sistema non emette un giudizio.',
    },
    valoreRiferimento:           riferimento.valore,
    fonteValoreRiferimento:      riferimento.fonte,
    valoreAttuale:               null,
    valorePotenziale:            null,
    valoreFuturoProiettato:      null,
    margineReale:                null,
    profittoFuturoPostRivendita: null,
    costiTotaliOperativi:        null,
    roi:                         null,
    roiConveniente:              false,
  };
}

// ============================================================================
// DETERMINISTIC LOGIC ENGINE — NO AI ALLOWED
// ============================================================================

function eseguiMotoreDeterministico(datiAI, parametriMercato) {
  const { valoreRiferimento, trendZona, anniProiezione, documentiVerificati = false } = parametriMercato;
  const { costiSanatoria, costiRipristino, statoImmobile, difformita } = datiAI;

  // --- Coherence Index ---
  let penalty = 0;
  if (difformita.strutturale)  penalty += 0.50;
  if (difformita.urbanistica)  penalty += 0.35;
  if (difformita.catastale)    penalty += 0.15;
  const coherenceIndex = Math.max(0, 100 * (1 - penalty));

  // --- Valuation Engine ---
  // Il valore di riferimento è quello scritto nei documenti (stima della perizia
  // o prezzo base): lo stato dell'immobile è già considerato da chi l'ha stimato,
  // quindi non si applica un secondo coefficiente di degrado.
  const haValore             = valoreRiferimento > 0;
  const valoreAttuale        = haValore ? valoreRiferimento : null;
  const valorePotenziale     = haValore ? valoreRiferimento : null;
  const valoreFuturoProiettato = haValore ? valorePotenziale * Math.pow(1 + trendZona, anniProiezione) : null;

  // --- ROI Engine ---
  const costiTotaliOperativi      = (costiSanatoria || 0) + (costiRipristino || 0);
  const margineReale              = haValore ? valorePotenziale - costiTotaliOperativi : null;
  const profittoFuturoPostRivendita = haValore ? valoreFuturoProiettato - costiTotaliOperativi : null;
  // ROI = (valore di stima − investimento) / investimento, dove l'investimento è
  // il prezzo base più i costi di sanatoria e ripristino. Calcolabile solo se i
  // documenti riportano sia la stima sia il prezzo base: altrimenti null.
  const investimento = datiAI.prezzoBase > 0 ? datiAI.prezzoBase + costiTotaliOperativi : null;
  const roiCalcolato = (datiAI.valoreStima > 0 && investimento > 0)
    ? safeRoiCalculation(datiAI.valoreStima - investimento, investimento)
    : null;
  const signal       = calculateDecisionSignal({
    riskScore:         100 - coherenceIndex,
    coherenceIndex,
    roi:               roiCalcolato !== null ? parseFloat(roiCalcolato.toFixed(2)) : 0,
    // Verificati = perizia letta e estrazione sopra soglia: solo allora il
    // semaforo può essere verde. Prima era sempre false, quindi mai verde.
    documentsVerified: documentiVerificati === true,
  });

  return {
    coherenceIndex:            parseFloat(coherenceIndex.toFixed(2)),
    semaforo:                  colorToSemaforo(signal.color),
    decisionSignal:            signal,
    giudizioNonPossibile:      false,
    valoreRiferimento:         haValore ? Math.round(valoreRiferimento) : null,
    valoreAttuale:             haValore ? Math.round(valoreAttuale) : null,
    valorePotenziale:          haValore ? Math.round(valorePotenziale) : null,
    valoreFuturoProiettato:    haValore ? Math.round(valoreFuturoProiettato) : null,
    margineReale:              haValore ? Math.round(margineReale) : null,
    profittoFuturoPostRivendita: haValore ? Math.round(profittoFuturoPostRivendita) : null,
    costiTotaliOperativi:      Math.round(costiTotaliOperativi),
    roi:                       roiCalcolato !== null ? parseFloat(roiCalcolato.toFixed(2)) : null,
    roiConveniente:            roiCalcolato !== null ? roiCalcolato > 18 : false,
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

    const riferimento = determinaValoreRiferimento(datiEstrattiEValidati, immobile);
    const parametriMercato = {
      valoreRiferimento:      riferimento.valore,
      fonteValoreRiferimento: riferimento.fonte,
      trendZona:              0.02,
      anniProiezione:         2,
    };

    const soglia = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.30');
    const presupposti = valutaPresupposti(datiEstrattiEValidati, metadata, soglia);

    let calcoliScoring;
    let spiegazione;
    if (!presupposti.giudizioPossibile) {
      calcoliScoring = esitoGiudizioNonPossibile(presupposti.motivi, riferimento);
      spiegazione = {
        giudizioNonPossibile: true,
        motivi: presupposti.motivi,
        documentiAnalizzati: metadata.documenti || [],
        datiDichiarati: {
          prezzoBase:    datiEstrattiEValidati.prezzoBase ?? null,
          offertaMinima: datiEstrattiEValidati.offertaMinima ?? null,
          valoreStima:   datiEstrattiEValidati.valoreStima ?? null,
          superficieMq:  datiEstrattiEValidati.superficieMq ?? null,
        },
      };
    } else {
      // MOTORE DETERMINISTICO — qui i presupposti sono soddisfatti
      calcoliScoring = eseguiMotoreDeterministico(datiEstrattiEValidati, { ...parametriMercato, documentiVerificati: true });
      calcoliScoring.fonteValoreRiferimento = riferimento.fonte;
      // Explainability: le formule testuali richiedono un valore numerico
      spiegazione = calcoliScoring.valoreAttuale !== null
        ? generaRelazioneCompletaSpiegata(calcoliScoring, datiEstrattiEValidati)
        : { valoreNonDisponibile: true, motivo: 'Nessun valore di stima o prezzo base presente nei documenti' };
      spiegazione.documentiAnalizzati = metadata.documenti || [];
    }

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
        // colonna non nullable: 0 in DB, il dato vero (null) resta in datiComputati
        coherenceIndex:              calcoliScoring.coherenceIndex ?? 0,
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
      data:  { status: finalStatus, riskScore: calcoliScoring.coherenceIndex === null ? null : 100 - calcoliScoring.coherenceIndex },
    });

    const durationMs = Date.now() - startTime;
    await recordJobEvent(jobId, 'SCORING_COMPLETED', {
      coherenceIndex: calcoliScoring.coherenceIndex,
      semaforo:       calcoliScoring.semaforo,
      giudizioNonPossibile: calcoliScoring.giudizioNonPossibile,
      motivi:         calcoliScoring.motiviGiudizioNonPossibile || [],
      valoreRiferimento: calcoliScoring.valoreRiferimento,
      fonteValoreRiferimento: parametriMercato.fonteValoreRiferimento,
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
module.exports.eseguiMotoreDeterministico = eseguiMotoreDeterministico;
module.exports.determinaValoreRiferimento = determinaValoreRiferimento;
module.exports.valutaPresupposti = valutaPresupposti;
module.exports.esitoGiudizioNonPossibile = esitoGiudizioNonPossibile;
