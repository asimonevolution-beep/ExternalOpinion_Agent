/**
 * EXTERNAL OPINION — AI FALLBACK HANDLER V18.2
 * Direzione Tecnica: Geometra Simone Azzali
 * 
 * Pipeline di fallback per AI inference:
 * 1. Ollama (locale) - PRIMARIO
 * 2. OpenAI (GPT-4) - FALLBACK 1
 * 3. Claude (Anthropic) - FALLBACK 2
 * 4. Gemini (Google) - FALLBACK 3
 * 
 * Trigger di fallback:
 * - Timeout
 * - JSON malformato
 * - Schema mismatch
 * - Confidence < 0.80
 * - Errore di parsing
 */

const { z } = require('zod');

// ============================================================================
// SCHEMA VALIDAZIONE
// ============================================================================

const SchemaEstrazioneAI = z.object({
  costiSanatoria: z.number().int().nonnegative().catch(0),
  costiRipristino: z.number().int().nonnegative().catch(0),
  statoImmobile: z.enum([
    'STATO_OTTIMO',
    'STATO_BUONO',
    'STATO_MEDIO',
    'STATO_CRITICO',
  ]).catch('STATO_MEDIO'),
  difformita: z.object({
    strutturale: z.boolean().catch(false),
    urbanistica: z.boolean().catch(false),
    catastale: z.boolean().catch(false),
  }).catch({ strutturale: false, urbanistica: false, catastale: false }),
  confidence: z.number().min(0).max(1).catch(0.05),
  source: z.object({
    document: z.string().catch('unknown'),
    page: z.number().int().catch(0),
    paragraph: z.number().int().catch(0),
  }).catch({ document: 'unknown', page: 0, paragraph: 0 }),
});

// ============================================================================
// SYSTEM PROMPT (Condiviso tra tutti i modelli)
// ============================================================================

const SYSTEM_PROMPT = `Sei un esperto analista immobiliare con 20 anni di esperienza in valutazioni, perizie e analisi di rischio.

COMPITO: Analizza la perizia immobiliare e estrai i seguenti dati in formato JSON strutturato.

SCHEMA OBBLIGATORIO:
{
  "costiSanatoria": intero (euro, es 50000),
  "costiRipristino": intero (euro, es 120000),
  "statoImmobile": "STATO_OTTIMO" | "STATO_BUONO" | "STATO_MEDIO" | "STATO_CRITICO",
  "difformita": {
    "strutturale": booleano (abusi strutturali?),
    "urbanistica": booleano (non conformità urbanistica?),
    "catastale": booleano (non conformità catastale?)
  },
  "confidence": numero 0-1 (quanto sei sicuro di questi dati? 0.95 = molto sicuro),
  "source": {
    "document": "nome perizia.pdf",
    "page": numero pagina,
    "paragraph": numero paragrafo
  }
}

REGOLE CRITICHE:
- Sii conservativo nelle stime
- Se non trovi il dato, imposta a 0 (costi) o false (difformita)
- Confidence deve riflettere l'incertezza
- Sempre indicare la pagina/paragrafo della fonte
- Mai allucinare dati che non sono nel documento
`;

// ============================================================================
// BACKEND 1: OLLAMA (LOCALE)
// ============================================================================

async function tryOllama(testoGrezzo, timeoutMs = 30000) {
  try {
    const ollama = require('ollama');

    const response = await Promise.race([
      ollama.generate({
        model: process.env.OLLAMA_MODEL || 'llama3',
        prompt: `${SYSTEM_PROMPT}\n\nTesto da analizzare:\n${testoGrezzo}`,
        format: 'json',
        options: {
          temperature: 0.0, // Deterministico
          num_predict: 1000,
        },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OLLAMA_TIMEOUT')), timeoutMs)
      ),
    ]);

    const jsonGrezzo = JSON.parse(response.response);
    const validated = SchemaEstrazioneAI.parse(jsonGrezzo);

    return {
      success: true,
      data: validated,
      model: 'ollama-llama3',
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      success: false,
      error: `Ollama failed: ${err.message}`,
      model: 'ollama-llama3',
    };
  }
}

// ============================================================================
// BACKEND 2: OPENAI (GPT-4)
// ============================================================================

async function tryOpenAI(testoGrezzo, timeoutMs = 45000) {
  try {
    const OpenAI = require('openai');
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: timeoutMs,
    });

    const response = await client.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: testoGrezzo },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const jsonGrezzo = JSON.parse(response.choices[0].message.content);
    const validated = SchemaEstrazioneAI.parse(jsonGrezzo);

    return {
      success: true,
      data: validated,
      model: 'openai-gpt4',
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      success: false,
      error: `OpenAI failed: ${err.message}`,
      model: 'openai-gpt4',
    };
  }
}

// ============================================================================
// BACKEND 3: CLAUDE (ANTHROPIC)
// ============================================================================

async function tryClaude(testoGrezzo, timeoutMs = 45000) {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: timeoutMs,
    });

    // Haiku per estrazione dati (8x più economico di Sonnet, 60x di Opus)
    const model = 'claude-haiku-4-5-20251001';
    const inputTokenEstimate = Math.ceil(testoGrezzo.length / 4);

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${SYSTEM_PROMPT}\n\nTesto da analizzare:\n${testoGrezzo.slice(0, 8000)}`,
        },
      ],
    });

    // Cost tracking
    const outputTokens = response.usage?.output_tokens || 0;
    const costUsd = (inputTokenEstimate * 0.00000025) + (outputTokens * 0.00000125);
    console.log(`[AI-COST] Claude Haiku: ~${inputTokenEstimate} in + ${outputTokens} out = $${costUsd.toFixed(5)}`);

    // Estrai JSON dalla risposta (gestisce markdown code blocks e testo libero)
    let rawText = response.content[0].text.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Nessun JSON trovato nella risposta Claude');
    rawText = jsonMatch[0];

    const jsonGrezzo = JSON.parse(rawText);
    const validated = SchemaEstrazioneAI.parse(jsonGrezzo);

    return {
      success: true,
      data: validated,
      model,
      costUsd,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[CLAUDE-ERROR] ${err.message}`);
    return {
      success: false,
      error: `Claude failed: ${err.message}`,
      model: 'claude-haiku-4-5-20251001',
    };
  }
}

// ============================================================================
// BACKEND 4: GEMINI (GOOGLE) — gemini-2.0-flash
// ============================================================================

async function tryGemini(testoGrezzo, timeoutMs = 45000) {
  if (!process.env.GOOGLE_API_KEY) {
    return { success: false, error: 'GOOGLE_API_KEY non configurata', model: 'gemini-2.0-flash' };
  }
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const geminiModel = client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    });

    const prompt = `${SYSTEM_PROMPT}\n\nTesto da analizzare:\n${testoGrezzo.slice(0, 8000)}`;

    const response = await Promise.race([
      geminiModel.generateContent(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs)
      ),
    ]);

    const rawText = response.response.text();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Nessun JSON in risposta Gemini');
    const jsonGrezzo = JSON.parse(jsonMatch[0]);
    const validated = SchemaEstrazioneAI.parse(jsonGrezzo);

    const inputTokens = response.response.usageMetadata?.promptTokenCount || 0;
    const outputTokens = response.response.usageMetadata?.candidatesTokenCount || 0;
    const costUsd = (inputTokens * 0.000000075) + (outputTokens * 0.0000003);
    console.log(`[AI-COST] Gemini Flash: ~${inputTokens} in + ${outputTokens} out = $${costUsd.toFixed(5)}`);

    return {
      success: true,
      data: validated,
      model: 'gemini-2.0-flash',
      costUsd,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      success: false,
      error: `Gemini failed: ${err.message}`,
      model: 'gemini-2.0-flash',
    };
  }
}

// ============================================================================
// BACKEND 5: QWEN (ALIBABA DASHSCOPE — OpenAI-compatible)
// ============================================================================

async function tryQwen(testoGrezzo, timeoutMs = 45000) {
  if (!process.env.DASHSCOPE_API_KEY) {
    return { success: false, error: 'DASHSCOPE_API_KEY non configurata', model: 'qwen-plus' };
  }
  try {
    const OpenAI = require('openai');
    const client = new OpenAI({
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      timeout: timeoutMs,
    });

    const response = await client.chat.completions.create({
      model: 'qwen-plus',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Testo da analizzare:\n${testoGrezzo.slice(0, 8000)}` },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const rawText = response.choices[0].message.content;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Nessun JSON in risposta Qwen');
    const jsonGrezzo = JSON.parse(jsonMatch[0]);
    const validated = SchemaEstrazioneAI.parse(jsonGrezzo);

    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const costUsd = (inputTokens * 0.0000004) + (outputTokens * 0.0000012);
    console.log(`[AI-COST] Qwen Plus: ~${inputTokens} in + ${outputTokens} out = $${costUsd.toFixed(5)}`);

    return {
      success: true,
      data: validated,
      model: 'qwen-plus',
      costUsd,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      success: false,
      error: `Qwen failed: ${err.message}`,
      model: 'qwen-plus',
    };
  }
}

// ============================================================================
// ORCHESTRATORE DI FALLBACK
// ============================================================================

async function estraiDatiConFallback(
  testoGrezzo,
  opzioniPersonalizzate = {}
) {
  // Ordine di default: claude (economico, affidabile) → gemini (gratuito, veloce)
  // → qwen (economico alternativo) → openai (costoso) → ollama (locale)
  const opzioni = {
    primario: 'claude',
    fallbacks: ['gemini', 'qwen', 'openai', 'ollama'],
    ...opzioniPersonalizzate,
  };

  console.log(`[AI_FALLBACK] Avvio pipeline di estrazione con primario: ${opzioni.primario}`);

  // Tutti i backend disponibili
  const backends = [
    { name: 'claude',  fn: tryClaude  },
    { name: 'gemini',  fn: tryGemini  },
    { name: 'qwen',    fn: tryQwen    },
    { name: 'openai',  fn: tryOpenAI  },
    { name: 'ollama',  fn: tryOllama  },
  ];

  // Riordina per mettere il primario per primo
  const orderedBackends = [
    ...backends.filter((b) => b.name === opzioni.primario),
    ...backends.filter((b) => b.name !== opzioni.primario),
  ];

  let lastError = null;

  for (const backend of orderedBackends) {
    console.log(`[AI_FALLBACK] Tentativo con: ${backend.name}`);

    try {
      const result = await backend.fn(testoGrezzo);

      if (result.success) {
        console.log(
          `[AI_FALLBACK] ✓ Successo con ${backend.name} (confidence: ${result.data.confidence})`
        );

        // Validazione confidence (accetta anche 0 — la soglia applicativa è nel worker)
        if (result.data.confidence < 0) {
          console.warn(
            `[AI_FALLBACK] ⚠ Confidence negativa (${result.data.confidence}) da ${backend.name}`
          );
          lastError = `Negative confidence (${result.data.confidence})`;
          continue;
        }

        return {
          success: true,
          data: result.data,
          model: result.model,
          timestamp: result.timestamp,
        };
      } else {
        lastError = result.error;
        console.warn(`[AI_FALLBACK] ✗ ${backend.name}: ${result.error}`);
      }
    } catch (err) {
      lastError = err.message;
      console.warn(`[AI_FALLBACK] ✗ ${backend.name}: ${err.message}`);
    }
  }

  // Tutti i backend hanno fallito
  throw new Error(
    `EXTRACTION_FAILED_ALL_BACKENDS: ${lastError || 'Unknown error'}`
  );
}

// ============================================================================
// CONSENSUS ENGINE (MULTI-MODELLO) - FUTURE
// ============================================================================

async function consensusMultiModello(testoGrezzo) {
  console.log('[CONSENSUS] Avvio consensus multi-modello');

  const results = [];

  // Esegui tutti in parallelo
  const [oRes, gRes, cRes] = await Promise.allSettled([
    tryOpenAI(testoGrezzo),
    tryGemini(testoGrezzo),
    tryClaude(testoGrezzo),
  ]);

  if (oRes.status === 'fulfilled' && oRes.value.success) results.push(oRes.value);
  if (gRes.status === 'fulfilled' && gRes.value.success) results.push(gRes.value);
  if (cRes.status === 'fulfilled' && cRes.value.success) results.push(cRes.value);

  if (results.length === 0) {
    throw new Error('CONSENSUS_NO_VALID_RESULTS');
  }

  // Calcola media confidence
  const avgConfidence =
    results.reduce((sum, r) => sum + r.data.confidence, 0) / results.length;

  // Prendi la risposta con confidence più alta
  const bestResult = results.reduce((best, current) =>
    current.data.confidence > best.data.confidence ? current : best
  );

  return {
    success: true,
    data: bestResult.data,
    models: results.map((r) => r.model),
    averageConfidence: parseFloat(avgConfidence.toFixed(2)),
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  estraiDatiConFallback,
  consensusMultiModello,
  tryOllama,
  tryOpenAI,
  tryClaude,
  tryGemini,
  tryQwen,
  SchemaEstrazioneAI,
  SYSTEM_PROMPT,
};
