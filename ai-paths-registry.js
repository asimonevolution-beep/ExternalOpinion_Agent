/**
 * EXTERNAL OPINION — AI PATHS REGISTRY V1.0
 * Direzione Tecnica: Geometra Simone Azzali
 *
 * Registry centralizzato di tutte le AI presenti nel progetto.
 * Ogni entry descrive: dove vive il modello, come si raggiunge,
 * quanto costa, quale variabile d'ambiente serve.
 *
 * Usato da:
 *   - realtime-hub.js: endpoint /api/ai-registry (live status)
 *   - ai-consensus-hub.js: selezione dinamica dei modelli
 *   - worker-llm.js: scelta del tier di estrazione
 *   - admin dashboard: pannello stato AI
 *
 * Per aggiungere una nuova AI: aggiungi un entry in AI_MODELS e registrala
 * nella pipeline aggiornando ai-consensus-hub.js.
 */

// ============================================================================
// REGISTRY STATICO — aggiornato ad ogni deploy
// ============================================================================

const AI_MODELS = {

  // ── PRIMARIO ────────────────────────────────────────────────────────────────

  claude: {
    id:          'claude',
    label:       'Claude Haiku 4.5',
    provider:    'Anthropic',
    model:       'claude-haiku-4-5-20251001',
    envKey:      'ANTHROPIC_API_KEY',
    filePath:    './ai-fallback-handler.js',
    fn:          'tryClaude',
    role:        'PRIMARY',
    costUsdPer1k: 0.00125,
    avgLatencyMs: 2500,
    maxInputChars: 32000,
    supportsJson: true,
    supportsPromptCaching: true,
    tiers:       ['all'],
    description: 'Modello principale per estrazione dati perizia. Economico, affidabile, JSON strutturato.',
  },

  // ── SECONDARI (CONSENSUS + FALLBACK) ────────────────────────────────────────

  gemini: {
    id:          'gemini',
    label:       'Gemini 2.0 Flash',
    provider:    'Google',
    model:       'gemini-2.0-flash',
    envKey:      'GOOGLE_API_KEY',
    filePath:    './ai-fallback-handler.js',
    fn:          'tryGemini',
    role:        'CONSENSUS_FAST',
    costUsdPer1k: 0.0003,
    avgLatencyMs: 1800,
    maxInputChars: 32000,
    supportsJson: true,
    supportsPromptCaching: false,
    tiers:       ['TIER_1_CASCADE_79', 'TIER_1_SCREENING_69', 'all'],
    description: 'Veloce, basso costo. Usato nel fast consensus (tier entry).',
  },

  qwen: {
    id:          'qwen',
    label:       'Qwen Plus',
    provider:    'Alibaba DashScope',
    model:       'qwen-plus',
    envKey:      'DASHSCOPE_API_KEY',
    filePath:    './ai-fallback-handler.js',
    fn:          'tryQwen',
    role:        'CONSENSUS_FULL',
    costUsdPer1k: 0.0012,
    avgLatencyMs: 3200,
    maxInputChars: 32000,
    supportsJson: true,
    supportsPromptCaching: false,
    tiers:       ['TIER_2_ADVISORY_150', 'TIER_3_PREMIUM_690', 'TIER_4_ENTERPRISE_API'],
    description: 'Alternativa economica OpenAI-compatible. Attivato nel full consensus.',
  },

  openai: {
    id:          'openai',
    label:       'GPT-4 Turbo',
    provider:    'OpenAI',
    model:       'gpt-4-turbo',
    envKey:      'OPENAI_API_KEY',
    filePath:    './ai-fallback-handler.js',
    fn:          'tryOpenAI',
    role:        'CONSENSUS_FULL',
    costUsdPer1k: 20.0,
    avgLatencyMs: 6000,
    maxInputChars: 32000,
    supportsJson: true,
    supportsPromptCaching: false,
    tiers:       ['TIER_3_PREMIUM_690', 'TIER_4_ENTERPRISE_API'],
    description: 'Modello premium. Solo per tier alto o come ultimo fallback.',
  },

  ollama: {
    id:          'ollama',
    label:       'Ollama/Llama3 (locale)',
    provider:    'Meta (self-hosted)',
    model:       process.env.OLLAMA_MODEL || 'llama3',
    envKey:      null,
    filePath:    './ai-fallback-handler.js',
    fn:          'tryOllama',
    role:        'FALLBACK_OFFLINE',
    costUsdPer1k: 0,
    avgLatencyMs: 8000,
    maxInputChars: 16000,
    supportsJson: true,
    supportsPromptCaching: false,
    tiers:       ['fallback'],
    description: 'Fallback offline su server locale. Non richiede API key.',
  },
};

// ============================================================================
// PIPELINE DI ESTRAZIONE — ordine di uso
// ============================================================================

const PIPELINES = {
  sequential_fallback: {
    label:  'Sequential Fallback (default)',
    order:  ['claude', 'gemini', 'qwen', 'openai', 'ollama'],
    mode:   'first_success',
    file:   './ai-fallback-handler.js',
    fn:     'estraiDatiConFallback',
    description: 'Prova modelli uno alla volta. Claude prima, poi fallback se fallisce.',
  },
  fast_consensus: {
    label:  'Fast Consensus (tier entry)',
    order:  ['claude', 'gemini'],
    mode:   'parallel_vote',
    file:   './ai-consensus-hub.js',
    fn:     'runFastConsensus',
    description: 'Claude + Gemini in parallelo. Majority vote per risultato più affidabile.',
  },
  full_consensus: {
    label:  'Full Consensus (tier premium)',
    order:  ['claude', 'gemini', 'qwen', 'openai'],
    mode:   'parallel_vote',
    file:   './ai-consensus-hub.js',
    fn:     'runFullConsensus',
    description: 'Tutti i modelli disponibili in parallelo. Massima precisione.',
  },
};

// ============================================================================
// PERCORSI FILE DEL PROGETTO (condiviso con AI e devtools)
// ============================================================================

const PROJECT_PATHS = {
  // Core
  server:            './server-v18.3.js',
  orchestrator:      './orchestrator.js',
  dag:               './dag-orchestrator.js',
  db:                './db.js',
  redis:             './redis-connection.js',

  // AI
  aiFallback:        './ai-fallback-handler.js',
  aiConsensus:       './ai-consensus-hub.js',
  aiRegistry:        './ai-paths-registry.js',   // questo file
  realtimeHub:       './realtime-hub.js',

  // Workers
  workerScraper:     './src/workers/worker-scraper.js',
  workerOCR:         './src/workers/worker-ocr.js',
  workerLLM:         './src/workers/worker-llm.js',
  workerScoring:     './src/workers/worker-scoring.js',
  workerReport:      './src/workers/worker-report.js',
  workerReview:      './src/workers/worker-review.js',
  workerNotify:      './src/workers/worker-notify.js',

  // Infra
  schema:            './prisma/schema.prisma',
  dockerfile:        './Dockerfile',
  railwayConfig:     './railway.toml',

  // Frontend
  publicIndex:       './public/index.html',
  publicSuccess:     './public/success.html',
  publicCancel:      './public/cancel.html',
};

// ============================================================================
// CONNESSIONI ESTERNE — endpoint e servizi
// ============================================================================

const EXTERNAL_CONNECTIONS = {
  railway: {
    label:      'Railway (hosting)',
    url:        'https://externalopinionagent-production-1f66.up.railway.app',
    projectId:  '885dcc5f-5be1-4294-b5f6-b0dbf2d31a98',
    serviceId:  'd734ac38-3e22-4a19-af58-e4ffd8cfc6da',
    branch:     'master',
    autoDeployOn: 'git push origin master',
  },
  github: {
    label: 'GitHub (sorgente)',
    repo:  'asimonevolution-beep/ExternalOpinion_Agent',
    url:   'https://github.com/asimonevolution-beep/ExternalOpinion_Agent',
  },
  stripe: {
    label:   'Stripe (pagamenti)',
    envKeys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    webhook: '/api/stripe/webhook',
    tiers: {
      TIER_1_CASCADE_79:   79,
      TIER_1_SCREENING_69: 69,
      TIER_1_ENTRY_89:     89,
      TIER_2_ADVISORY_150: 150,
      TIER_3_PREMIUM_690:  690,
    },
  },
  smtp: {
    label:   'SMTP (email clienti)',
    host:    process.env.SMTP_HOST || 'smtp.gmail.com',
    port:    587,
    envKeys: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'],
  },
};

// ============================================================================
// LIVE STATUS — stato runtime (chiamato a runtime, non a require-time)
// ============================================================================

function getLiveStatus() {
  const status = {};
  for (const [id, model] of Object.entries(AI_MODELS)) {
    status[id] = {
      ...model,
      active:       model.envKey ? !!process.env[model.envKey] : true,
      configStatus: model.envKey
        ? (process.env[model.envKey] ? 'CONFIGURED' : 'MISSING_API_KEY')
        : 'NO_KEY_REQUIRED',
    };
  }
  return status;
}

function getActivePipeline() {
  const mode = process.env.AI_CONSENSUS_MODE;
  if (mode === 'true') return 'fast_consensus';
  if (mode === 'full') return 'full_consensus';
  return 'sequential_fallback';
}

function getSummary() {
  const live = getLiveStatus();
  const activeModels = Object.values(live).filter(m => m.active);
  const pipeline = getActivePipeline();
  return {
    totalModels:     Object.keys(AI_MODELS).length,
    activeModels:    activeModels.length,
    pipeline:        PIPELINES[pipeline].label,
    pipelineMode:    pipeline,
    models:          activeModels.map(m => ({ id: m.id, label: m.label, role: m.role })),
    realtimeStream:  '/api/stream/:jobId',
    adminStream:     '/api/stream/admin/live',
    aiRegistryApi:   '/api/ai-registry',
    ts:              new Date().toISOString(),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  AI_MODELS,
  PIPELINES,
  PROJECT_PATHS,
  EXTERNAL_CONNECTIONS,
  getLiveStatus,
  getActivePipeline,
  getSummary,
};
