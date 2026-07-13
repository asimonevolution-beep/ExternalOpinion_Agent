'use strict';

const ENGINE_CONFIG = {
  MODEL_VERSION: '13.4.0',
  BASELINES: { urban: 3500, suburban: 2100, rural: 900 },
  PRICE_WEIGHT: 0.35,
  STRUCTURAL_WEIGHT: 0.50,
  ENTROPY_WEIGHT: 0.15,
  CONDITION_MATRIX: { ottimo: 0.1, buono: 0.3, parziale: 0.6, integrale: 0.9 },
  KEYWORD_MATRIX: { difform: 0.20, abuso: 0.35, vincolo: 0.25, sanatoria: 0.30 },
};

function runDeterministicInference(payload) {
  const pmq = payload.prezzo / payload.mq;
  const text = (payload.note || '').toLowerCase();

  // A. Contradiction Detection
  const hasPositive = ['ottimo','perfetto','ristrutturato'].some(w => text.includes(w));
  const hasNegative = ['umidit','abuso','difform','crepa'].some(w => text.includes(w));
  const contradiction = hasPositive && hasNegative;

  // B. Entropy Scoring
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const entropy = words > 0 ? parseFloat((text.length / words).toFixed(2)) : 0;

  // C. Keyword Score
  let keywordScore = 0;
  Object.entries(ENGINE_CONFIG.KEYWORD_MATRIX).forEach(([k, v]) => {
    if (text.includes(k)) keywordScore += v;
  });

  const condScore = ENGINE_CONFIG.CONDITION_MATRIX[payload.stato] || 0.5;
  const structuralStress = Math.min(1, condScore * (contradiction ? 1.35 : 1.0) + keywordScore);
  const priceAnomaly = pmq > ENGINE_CONFIG.BASELINES.suburban ? 0.75
    : pmq < ENGINE_CONFIG.BASELINES.rural ? 0.65 : 0.25;

  const rawScore = (
    structuralStress * ENGINE_CONFIG.STRUCTURAL_WEIGHT +
    priceAnomaly    * ENGINE_CONFIG.PRICE_WEIGHT +
    (entropy > 7 ? 0.15 : 0.05) * ENGINE_CONFIG.ENTROPY_WEIGHT * 10
  ) * 100;

  const score = Math.round(Math.min(Math.max(rawScore, 10), 100));
  const risk_class = score > 65 ? 'CRITICAL' : score > 35 ? 'MODERATE' : 'CONTROLLED';

  return {
    risk_score: score,
    risk_class,
    entropy_score: entropy,
    price_per_sqm: Math.round(pmq),
    contradiction,
    model_version: ENGINE_CONFIG.MODEL_VERSION,
  };
}

function buildNarrativeAndFindings(payload, inference) {
  const { zona, prezzo, mq, tipo, piano, anno, stato } = payload;
  const { risk_score, risk_class, price_per_sqm, contradiction } = inference;
  const text = (payload.note || '').toLowerCase();

  const findings = [];

  if (contradiction)
    findings.push({ l: 'Contraddizione rilevata nel testo — descrizione positiva in conflitto con criticità dichiarate', s: 'high' });

  if (text.includes('abuso') || text.includes('condono') || text.includes('sanatoria'))
    findings.push({ l: 'Riferimenti a condono/sanatoria — verificare conformità urbanistica prima del rogito', s: 'high' });

  if (text.includes('vincolo') || text.includes('paesagg'))
    findings.push({ l: 'Vincolo paesaggistico/storico rilevato — interventi soggetti ad autorizzazione speciale (D.Lgs. 42/2004)', s: 'high' });

  if (text.includes('amianto') || text.includes('eternit'))
    findings.push({ l: 'Possibile amianto rilevato — bonifica obbligatoria: costo stimato €8.000–€25.000', s: 'high' });

  if (text.includes('occupat') || text.includes('inquilin'))
    findings.push({ l: 'Immobile potenzialmente occupato — costi e tempi di sgombero non prevedibili', s: 'high' });

  if (text.includes('ipotec') || text.includes('pignoram'))
    findings.push({ l: 'Riferimenti a ipoteche/esecuzioni — verificare passività presso Conservatoria RR.II.', s: 'high' });

  if (text.includes('difform') || text.includes('abuso'))
    findings.push({ l: `Difformità catastale probabile — verifica planimetria obbligatoria su ${mq}mq`, s: 'high' });

  if (tipo?.includes('asta'))
    findings.push({ l: 'Asta giudiziaria: verificare ipoteche residue e stato occupazionale prima di qualsiasi offerta', s: 'high' });

  if (stato === 'integrale' || stato === 'fatiscente')
    findings.push({ l: `Ristrutturazione integrale necessaria: stima €${Math.round(mq * 900).toLocaleString('it-IT')}–€${Math.round(mq * 1300).toLocaleString('it-IT')} su ${mq}mq`, s: 'medium' });

  if (anno === 'Prima del 1940' || anno === '1940–1970')
    findings.push({ l: 'Edificio ante-1970: verificare amianto, vulnerabilità sismica e conformità impianti', s: 'medium' });

  findings.push({
    l: `Score ${risk_score}/100 · €${price_per_sqm}/mq · Rischio ${risk_class}`,
    s: risk_class === 'CRITICAL' ? 'high' : risk_class === 'MODERATE' ? 'medium' : 'low',
  });

  const narrativeMap = {
    CRITICAL: `L'immobile a ${zona} presenta profilo di rischio critico (score ${risk_score}/100). A €${price_per_sqm}/mq con stato "${stato}", l'analisi rileva criticità tecniche significative. Impatto economico nascosto stimato: ${Math.round(prezzo * 0.28).toLocaleString('it-IT')}€. Acquisizione sconsigliata senza due diligence completa firmata.`,
    MODERATE: `L'asset a ${zona} evidenzia anomalie moderate (score ${risk_score}/100). Il prezzo €${price_per_sqm}/mq richiede verifica rispetto ai benchmark di zona. Emergono elementi critici da approfondire prima della firma. Stimato impatto €${Math.round(prezzo * 0.13).toLocaleString('it-IT')}.`,
    CONTROLLED: `L'immobile a ${zona} rientra in parametri accettabili (score ${risk_score}/100). €${price_per_sqm}/mq coerente con la zona. Validazione catastale standard raccomandata prima del rogito.`,
  };

  return {
    narrative: narrativeMap[risk_class],
    findings: findings.slice(0, 5),
  };
}

module.exports = { runDeterministicInference, buildNarrativeAndFindings, ENGINE_CONFIG };
