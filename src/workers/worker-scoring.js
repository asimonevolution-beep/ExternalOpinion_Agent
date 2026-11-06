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
const { inviaEmailVerdetto } = require('../email/verdetto-email');

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
  const { costiSanatoria, costiRipristino, difformita } = datiAI;

  // --- Coherence Index ---
  let penalty = 0;
  if (difformita.strutturale)  penalty += 0.50;
  if (difformita.urbanistica)  penalty += 0.35;
  if (difformita.catastale)    penalty += 0.15;
  const coherenceIndex = Math.max(0, 100 * (1 - penalty));

  // --- Valore di mercato ---
  // È solo quello stimato dal perito (o un valore di zona fornito). Il prezzo
  // base d'asta NON è un valore di mercato: prima veniva mostrato come "valore
  // attuale" e il margine risultava pari all'intero valore (98.952 € su Carpi).
  const fonte                = parametriMercato.fonteValoreRiferimento;
  const valoreDiMercato      = (valoreRiferimento > 0 && fonte !== 'PREZZO_BASE_ASTA') ? valoreRiferimento : null;
  const haValore             = valoreDiMercato !== null;
  const valoreFuturoProiettato = haValore ? valoreDiMercato * Math.pow(1 + trendZona, anniProiezione) : null;

  // --- Costi noti e investimento ---
  const speseCondominiali    = datiAI.speseCondominialiArretrate > 0 ? datiAI.speseCondominialiArretrate : 0;
  const costiTotaliOperativi = (costiSanatoria || 0) + (costiRipristino || 0) + speseCondominiali;
  const investimento         = datiAI.prezzoBase > 0 ? datiAI.prezzoBase + costiTotaliOperativi : null;
  const investimentoMinimo   = datiAI.offertaMinima > 0 ? datiAI.offertaMinima + costiTotaliOperativi : null;

  // --- ROI: (valore di mercato − investimento) / investimento ---
  const roiCalcolato        = (haValore && investimento > 0) ? safeRoiCalculation(valoreDiMercato - investimento, investimento) : null;
  const roiOffertaMinimaRaw = (haValore && investimentoMinimo > 0) ? safeRoiCalculation(valoreDiMercato - investimentoMinimo, investimentoMinimo) : null;
  const margineReale        = (haValore && investimento > 0) ? valoreDiMercato - investimento : null;
  const profittoFuturo      = (haValore && investimento > 0) ? valoreFuturoProiettato - investimento : null;
  const arrotonda2          = (v) => (v === null || v === undefined ? null : parseFloat(Number(v).toFixed(2)));

  const signal = calculateDecisionSignal({
    riskScore:         100 - coherenceIndex,
    coherenceIndex,
    roi:               roiCalcolato !== null ? arrotonda2(roiCalcolato) : 0,
    // Verde solo con perizia letta e valore di stima del perito.
    documentsVerified: documentiVerificati === true && haValore,
  });

  return {
    coherenceIndex:            arrotonda2(coherenceIndex),
    semaforo:                  colorToSemaforo(signal.color),
    decisionSignal:            signal,
    giudizioNonPossibile:      false,
    valoreRiferimento:         haValore ? Math.round(valoreDiMercato) : null,
    valoreAttuale:             haValore ? Math.round(valoreDiMercato) : null,
    valorePotenziale:          haValore ? Math.round(valoreDiMercato) : null,
    valoreFuturoProiettato:    haValore ? Math.round(valoreFuturoProiettato) : null,
    margineReale:              margineReale !== null ? Math.round(margineReale) : null,
    profittoFuturoPostRivendita: profittoFuturo !== null ? Math.round(profittoFuturo) : null,
    costiTotaliOperativi:      Math.round(costiTotaliOperativi),
    investimento:              investimento !== null ? Math.round(investimento) : null,
    investimentoMinimo:        investimentoMinimo !== null ? Math.round(investimentoMinimo) : null,
    prezzoBase:                datiAI.prezzoBase > 0 ? datiAI.prezzoBase : null,
    offertaMinima:             datiAI.offertaMinima > 0 ? datiAI.offertaMinima : null,
    roi:                       arrotonda2(roiCalcolato),
    roiOffertaMinima:          arrotonda2(roiOffertaMinimaRaw),
    roiConveniente:            roiCalcolato !== null ? roiCalcolato > 18 : false,
  };
}

// ============================================================================
// ESITO PER IL CLIENTE — testi costruiti solo dai numeri calcolati
// ============================================================================
// La pagina mostrava una frase fissa per colore ("Alcune anomalie rilevate")
// anche con zero difformità. Ogni frase qui deriva da un dato del calcolo.

const euro = (v) => `${Math.round(v).toLocaleString('it-IT')} €`;
const perc = (v) => `${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function costruisciEsitoCliente(calcoli, datiAI = {}) {
  if (calcoli.giudizioNonPossibile) {
    return {
      titolo: 'Giudizio non possibile',
      sottotitolo: 'Manca la perizia: senza documento tecnico non emettiamo un semaforo.',
      frasi: calcoli.motiviGiudizioNonPossibile || [],
      azione: 'Incolla il link della pagina dell\'asta oppure il PDF della perizia.',
      rischioDocumentale: null,
      punti: [],
    };
  }

  const frasi = [];
  const d = datiAI.difformita || {};
  const elenco = [d.strutturale && 'strutturale', d.urbanistica && 'urbanistica', d.catastale && 'catastale'].filter(Boolean);
  frasi.push(elenco.length
    ? `La perizia segnala difformità: ${elenco.join(', ')}.`
    : 'La perizia non segnala difformità strutturali, urbanistiche o catastali.');

  if (calcoli.valoreAttuale) {
    let f = `Il perito stima l'immobile ${euro(calcoli.valoreAttuale)}.`;
    if (calcoli.roi !== null && calcoli.prezzoBase) {
      f += ` Al prezzo base di ${euro(calcoli.prezzoBase)} il margine sulla stima è ${perc(calcoli.roi)}`;
      f += (calcoli.roiOffertaMinima !== null && calcoli.offertaMinima)
        ? `; all'offerta minima di ${euro(calcoli.offertaMinima)} sale a ${perc(calcoli.roiOffertaMinima)}.`
        : '.';
    }
    frasi.push(f);
  } else {
    frasi.push('Nei documenti non c\'è un valore di stima del perito: il margine non è calcolabile.');
  }

  if (calcoli.costiTotaliOperativi > 0) {
    frasi.push(`Costi indicati nei documenti e inclusi nel calcolo: ${euro(calcoli.costiTotaliOperativi)}.`);
  }
  if (!datiAI.costiQuantificati && elenco.length) {
    frasi.push('I costi per sistemare le difformità non sono quantificati: vanno stimati prima di offrire.');
  }

  const occupazione = {
    LIBERO: 'Immobile indicato come libero.',
    OCCUPATO_DEBITORE: 'Immobile nella disponibilità del debitore: va liberato dopo l\'aggiudicazione.',
    OCCUPATO_TERZI: 'Immobile occupato da terzi: verificare titolo e tempi di liberazione.',
  }[datiAI.statoOccupazione];
  const punti = [...(occupazione ? [occupazione] : []), ...(datiAI.puntiDaVerificare || [])].slice(0, 6);

  const titoli = {
    VERDE:  { titolo: 'Verde — Scenario favorevole', sottotitolo: 'Documenti coerenti e margine positivo al prezzo base.' },
    GIALLO: { titolo: 'Giallo — Da verificare prima di offrire', sottotitolo: elenco.length
      ? 'Ci sono difformità da valutare prima di decidere.'
      : 'Documenti in ordine, ma il margine dipende dal prezzo che offri.' },
    ROSSO:  { titolo: 'Rosso — Scenario critico', sottotitolo: 'Difformità gravi o margine fortemente negativo.' },
  }[calcoli.semaforo];

  let azione;
  if (calcoli.semaforo === 'VERDE') azione = 'Procedi con le verifiche standard prima dell\'offerta: il report completo le elenca una per una.';
  else if (calcoli.semaforo === 'ROSSO') azione = 'Non partecipare senza una verifica tecnica completa dell\'immobile.';
  else if (elenco.length) azione = 'Fai stimare i costi delle difformità prima di offrire e tienili fuori dal prezzo che proponi.';
  else azione = 'Stabilisci un\'offerta massima sotto la stima del perito e controlla i punti qui sotto prima di partecipare.';

  return {
    ...titoli,
    frasi,
    azione,
    rischioDocumentale: calcoli.coherenceIndex > 70 ? 'Basso' : calcoli.coherenceIndex > 40 ? 'Medio' : 'Alto',
    punti,
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
      // MOTORE DETERMINISTICO
      calcoliScoring = eseguiMotoreDeterministico(datiEstrattiEValidati, { ...parametriMercato, documentiVerificati: metadata.periziaLetta === true });
      calcoliScoring.fonteValoreRiferimento = riferimento.fonte;
      // Explainability: le formule testuali richiedono un valore numerico
      spiegazione = calcoliScoring.valoreAttuale !== null
        ? generaRelazioneCompletaSpiegata(calcoliScoring, datiEstrattiEValidati)
        : { valoreNonDisponibile: true, motivo: 'Nessun valore di stima o prezzo base presente nei documenti' };
      spiegazione.documentiAnalizzati = metadata.documenti || [];
    }

    calcoliScoring.esitoCliente = costruisciEsitoCliente(calcoliScoring, datiEstrattiEValidati);

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

    // Email dell'esito al cliente (e avviso a Simone). Un errore d'invio non
    // blocca il pagamento: resta registrato negli eventi del job.
    if (finalStatus === 'READY_FOR_PAYMENT' && calcoliScoring.esitoCliente) {
      try {
        const giaInviata = await prisma.jobEvent.findFirst({ where: { jobId, eventType: 'VERDICT_EMAIL_SENT' } });
        if (!giaInviata) {
          const jobRec = await prisma.job.findUnique({ where: { id: jobId }, select: { payload: true } });
          let emailCliente = null;
          try { emailCliente = JSON.parse(jobRec?.payload || '{}').email || null; } catch { /* payload non JSON */ }
          const esitiInvio = await inviaEmailVerdetto({
            jobId, email: emailCliente, esito: calcoliScoring.esitoCliente, urlAsta: urlOriginale, semaforo: calcoliScoring.semaforo,
          });
          await recordJobEvent(jobId, 'VERDICT_EMAIL_SENT', { cliente: esitiInvio.cliente?.messageId || null, admin: esitiInvio.admin?.messageId || null, adminErrore: esitiInvio.adminErrore || null }, WORKER_ID);
        }
      } catch (err) {
        console.error(`[SCORING ${WORKER_ID}] Email esito non inviata per ${jobId}: ${err.message}`);
        await recordJobEvent(jobId, 'VERDICT_EMAIL_FAILED', { error: err.message }, WORKER_ID);
      }
    }

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
module.exports.costruisciEsitoCliente = costruisciEsitoCliente;
