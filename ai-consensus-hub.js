/**
 * EXTERNAL OPINION — AI CONSENSUS HUB V1.0
 * Direzione Tecnica: Geometra Simone Azzali
 *
 * Connette tutte le AI presenti in parallelo e produce un risultato consensuale.
 *
 * Modelli collegati:
 *   1. Claude Haiku   (Anthropic)   — primario, economico, affidabile
 *   2. Gemini Flash   (Google)      — veloce, gratuito
 *   3. Qwen Plus      (Alibaba)     — alternativa low-cost
 *   4. GPT-4 Turbo    (OpenAI)      — fallback premium
 *   5. Ollama/Llama3  (locale)      — fallback offline
 *
 * Strategia consensus:
 *   - Tutti i modelli girano in parallelo con Promise.allSettled
 *   - statoImmobile: majority vote pesato per confidence
 *   - costiSanatoria / costiRipristino: media pesata per confidence
 *   - difformita: true se ≥ 50% dei modelli lo segnala
 *   - confidence finale: media delle confidence dei modelli che hanno risposto
 *
 * Streaming real-time:
 *   - Ogni risposta AI viene pubblicata su Redis non appena arriva
 *   - I client SSE ricevono aggiornamenti parziali in tempo reale
 */

const {
  tryClaude,
  tryGemini,
  tryQwen,
  tryOpenAI,
  tryOllama,
  SchemaEstrazioneAI,
} = require('./ai-fallback-handler');

const { publishAIProgress } = require('./realtime-hub');

// ============================================================================
// MAJORITY VOTE — statoImmobile
// ============================================================================

const STATO_ORDINE = ['STATO_OTTIMO', 'STATO_BUONO', 'STATO_MEDIO', 'STATO_CRITICO'];

function majorityVoteStato(results) {
  const voti = {};
  let totalPeso = 0;

  for (const r of results) {
    const stato = r.data.statoImmobile;
    const peso = r.data.confidence;
    voti[stato] = (voti[stato] || 0) + peso;
    totalPeso += peso;
  }

  // Normalizza e prendi il più votato
  let best = 'STATO_MEDIO';
  let bestScore = -1;
  for (const [stato, score] of Object.entries(voti)) {
    if (score > bestScore) {
      bestScore = score;
      best = stato;
    }
  }

  const agreement = totalPeso > 0 ? (bestScore / totalPeso) : 0;
  return { stato: best, agreement: parseFloat(agreement.toFixed(2)) };
}

// ============================================================================
// MEDIA PESATA — costi numerici
// ============================================================================

function mediaPesata(results, campo) {
  let somma = 0;
  let totalPeso = 0;
  for (const r of results) {
    const valore = r.data[campo] || 0;
    const peso = r.data.confidence;
    somma += valore * peso;
    totalPeso += peso;
  }
  return totalPeso > 0 ? Math.round(somma / totalPeso) : 0;
}

// ============================================================================
// VOTE BOOLEANO — difformita
// ============================================================================

function votoBool(results, campo) {
  const yesCount = results.filter(r => r.data.difformita?.[campo] === true).length;
  return yesCount >= Math.ceil(results.length / 2);
}

// ============================================================================
// SOURCE MIGLIORE — la fonte con confidence più alta
// ============================================================================

function bestSource(results) {
  const best = results.reduce((acc, r) =>
    r.data.confidence > (acc?.data?.confidence || 0) ? r : acc
  , null);
  return best?.data?.source || { document: 'consensus', page: 0, paragraph: 0 };
}

// ============================================================================
// CONSENSUS ENGINE
// ============================================================================

/**
 * Esegue tutti i modelli AI in parallelo e restituisce un risultato consensuale.
 *
 * @param {string} testoGrezzo  — testo perizia estratto da OCR
 * @param {object} opts
 *   @param {string} opts.jobId         — per pubblicare progress su SSE
 *   @param {string[]} opts.models      — sottoinsieme modelli (default: tutti)
 *   @param {number} opts.minModels     — numero minimo risposte valide (default: 1)
 *   @param {boolean} opts.streaming    — pubblica risultati parziali su SSE (default: true)
 */
async function runConsensus(testoGrezzo, opts = {}) {
  const {
    jobId = null,
    models = ['claude', 'gemini', 'qwen', 'openai', 'ollama'],
    minModels = 1,
    streaming = true,
  } = opts;

  const allBackends = {
    claude:  { fn: tryClaude,  label: 'Claude Haiku 4.5',   priority: 1 },
    gemini:  { fn: tryGemini,  label: 'Gemini 2.0 Flash',   priority: 2 },
    qwen:    { fn: tryQwen,    label: 'Qwen Plus',           priority: 3 },
    openai:  { fn: tryOpenAI,  label: 'GPT-4 Turbo',        priority: 4 },
    ollama:  { fn: tryOllama,  label: 'Ollama/Llama3',      priority: 5 },
  };

  const selected = models
    .filter(m => allBackends[m])
    .sort((a, b) => allBackends[a].priority - allBackends[b].priority);

  console.log(`[CONSENSUS] Avvio ${selected.length} modelli in parallelo per job ${jobId || 'N/A'}`);

  // Pubblica inizio su SSE
  if (streaming && jobId) {
    await publishAIProgress(jobId, {
      phase: 'START',
      models: selected.map(m => allBackends[m].label),
      ts: Date.now(),
    }).catch(() => {});
  }

  // Esegui tutti in parallelo — ogni modello pubblica il suo risultato appena pronto
  const promises = selected.map(async (modelName) => {
    const backend = allBackends[modelName];
    const startMs = Date.now();
    try {
      const result = await backend.fn(testoGrezzo);
      const durationMs = Date.now() - startMs;

      if (streaming && jobId && result.success) {
        await publishAIProgress(jobId, {
          phase: 'MODEL_DONE',
          model: backend.label,
          confidence: result.data.confidence,
          statoImmobile: result.data.statoImmobile,
          durationMs,
        }).catch(() => {});
      }

      return { modelName, ...result, durationMs };
    } catch (err) {
      if (streaming && jobId) {
        await publishAIProgress(jobId, {
          phase: 'MODEL_ERROR',
          model: backend.label,
          error: err.message,
        }).catch(() => {});
      }
      return { modelName, success: false, error: err.message, durationMs: Date.now() - startMs };
    }
  });

  const settled = await Promise.allSettled(promises);

  const valid = settled
    .filter(s => s.status === 'fulfilled' && s.value.success)
    .map(s => s.value);

  const failed = settled
    .filter(s => s.status === 'rejected' || (s.status === 'fulfilled' && !s.value.success))
    .map(s => s.status === 'fulfilled' ? s.value : { error: s.reason?.message });

  console.log(`[CONSENSUS] Risposte valide: ${valid.length}/${selected.length}`);

  if (valid.length < minModels) {
    const errors = failed.map(f => f.error || 'unknown').join('; ');
    throw new Error(`CONSENSUS_INSUFFICIENT_RESPONSES: solo ${valid.length}/${minModels} modelli risposto. Errori: ${errors}`);
  }

  // ── Calcola consensus ────────────────────────────────────────────────────
  const { stato: statoConsensus, agreement } = majorityVoteStato(valid);

  const consensusData = {
    costiSanatoria:  mediaPesata(valid, 'costiSanatoria'),
    costiRipristino: mediaPesata(valid, 'costiRipristino'),
    statoImmobile:   statoConsensus,
    difformita: {
      strutturale: votoBool(valid, 'strutturale'),
      urbanistica:  votoBool(valid, 'urbanistica'),
      catastale:    votoBool(valid, 'catastale'),
    },
    confidence: parseFloat(
      (valid.reduce((s, r) => s + r.data.confidence, 0) / valid.length).toFixed(2)
    ),
    source: bestSource(valid),
  };

  const validated = SchemaEstrazioneAI.parse(consensusData);

  // Pubblica risultato finale su SSE
  if (streaming && jobId) {
    await publishAIProgress(jobId, {
      phase: 'CONSENSUS_DONE',
      modelsUsed: valid.map(r => r.model || r.modelName),
      agreement,
      confidence: validated.confidence,
      statoImmobile: validated.statoImmobile,
    }).catch(() => {});
  }

  const result = {
    success: true,
    data: validated,
    consensus: {
      modelsUsed: valid.map(r => r.model || r.modelName),
      modelsFailed: failed.length,
      agreement,
      avgConfidence: validated.confidence,
      individualResults: valid.map(r => ({
        model: r.model || r.modelName,
        confidence: r.data.confidence,
        statoImmobile: r.data.statoImmobile,
        durationMs: r.durationMs,
      })),
    },
    timestamp: new Date().toISOString(),
  };

  console.log(
    `[CONSENSUS] ✓ statoImmobile=${validated.statoImmobile} ` +
    `confidence=${validated.confidence} agreement=${agreement} ` +
    `modelli=${result.consensus.modelsUsed.join(',')}`
  );

  return result;
}

// ============================================================================
// FAST MODE — usa solo i modelli gratuiti/veloci (per TIER basso)
// ============================================================================

async function runFastConsensus(testoGrezzo, jobId = null) {
  return runConsensus(testoGrezzo, {
    jobId,
    models: ['claude', 'gemini'],
    minModels: 1,
    streaming: true,
  });
}

// ============================================================================
// FULL MODE — tutti i modelli (per TIER premium)
// ============================================================================

async function runFullConsensus(testoGrezzo, jobId = null) {
  return runConsensus(testoGrezzo, {
    jobId,
    models: ['claude', 'gemini', 'qwen', 'openai'],
    minModels: 1,
    streaming: true,
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  runConsensus,
  runFastConsensus,
  runFullConsensus,
};
