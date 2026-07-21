const govCheck = require('./gov_check');
const { queryNormativeData, crossReferenceWithNormative } = require('./normative_db');

function parseNumber(value) {
  if (value == null) return null;
  const cleaned = value.toString().replace(/[^0-9,\.]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(value) {
  if (value == null || Number.isNaN(value)) return 'N/D';
  return `€${Math.round(value).toLocaleString('it-IT')}`;
}

function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return 'N/D';
  return `${Math.round(value)}%`;
}

function safeDivision(numerator, denominator) {
  if (!denominator || Number.isNaN(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function getPrimaryArea(technical) {
  return technical.areaCommerciale || technical.areaCatastale || (technical.areas && technical.areas.length > 0 ? parseNumber(technical.areas[0]) : null);
}

function estimateMarketPricePerSqm(location, normativeData) {
  if (normativeData && normativeData.zone && normativeData.zone.avg_value_per_sqm) {
    return normativeData.zone.avg_value_per_sqm;
  }
  const defaults = {
    Modena: 1200,
    Bologna: 1500,
    Milano: 2200,
    Roma: 2000,
  };
  return defaults[location] || 1200;
}

function calculateRenovationCostPerSqm(technical, baseArea) {
  let cost = 520;
  const issueCount = (technical.structuralIssues || []).length;

  if (issueCount >= 2) cost += 180;
  if (technical.difformita && technical.difformita.some((item) => /non sanabile|non sanabile/i.test(item))) cost += 120;
  if (technical.yearBuilt && technical.yearBuilt < 1970) cost += 100;
  if (technical.occupancyStatus && /abusivo/.test(technical.occupancyStatus.toLowerCase())) cost += 120;
  if (technical.structuralIssues && technical.structuralIssues.some((item) => /umidit|infiltraz|muffa|lesione|crepa|cedimento/i.test(item))) cost += 120;

  if (cost < 450) cost = 450;
  return Math.round(cost);
}

function buildRiskItems(technical, valuation) {
  const risks = [];
  const occupancy = (technical.occupancyStatus || '').toLowerCase();
  const hasAbusive = /abusivo/.test(occupancy);
  const arrears = technical.condominialArrears || 0;
  const yearBuilt = technical.yearBuilt;
  const hasPre1970 = yearBuilt && yearBuilt < 1970;
  const hasStructural = (technical.structuralIssues || []).length > 0;
  const hasDifformita = (technical.difformita || []).length > 0;
  const nonSanabile = technical.difformita && technical.difformita.some((item) => /non sanabile|irregolarit[àa]|abuso/i.test(item));
  const sismicZone = technical.sismicZone;

  if (hasAbusive) {
    risks.push({
      type: 'Occupazione abusiva',
      severity: 'high',
      costEstimate: 25000,
      description: 'Occupazione abusiva richiede sgombero e contenzioso',
    });
  }

  if (nonSanabile) {
    risks.push({
      type: 'Difformità non sanabile',
      severity: 'critical',
      costEstimate: Math.max(30000, valuation.renovationCost * 0.5 || 30000),
      description: 'Difformità urbanistiche non sanabile porta a ROSSO automatico',
    });
  } else if (hasDifformita) {
    risks.push({
      type: 'Difformità urbanistiche',
      severity: 'high',
      costEstimate: 18000,
      description: 'Difformità rilevate possono richiedere sanatoria e spese extra',
    });
  }

  if (arrears > 10000) {
    risks.push({
      type: 'Spese condominiali arretrate',
      severity: 'high',
      costEstimate: arrears,
      description: 'Condòmini possono richiedere oltre 2 anni di spese arretrate',
    });
  } else if (arrears > 0) {
    risks.push({
      type: 'Spese condominiali arretrate',
      severity: 'medium',
      costEstimate: arrears,
      description: 'Debiti condominiali possono gravare sull’acquirente',
    });
  }

  if (hasPre1970 && !/ristrutturato|riqualificat|restaurat|ammodernat/i.test(technical.rawText.toLowerCase())) {
    risks.push({
      type: 'Impianti obsoleti',
      severity: 'medium',
      costEstimate: 15000,
      description: 'Pre-1970 senza interventi recenti aumenta rischio impianti',
    });
  }

  if (sismicZone && /[12]/.test(sismicZone) && !/adeguament[oi]|antisismico|sismico/i.test(technical.rawText.toLowerCase())) {
    risks.push({
      type: 'Zona sismica 1-2',
      severity: 'medium',
      costEstimate: 20000,
      description: 'Zona sismica senza adeguamento espone a rischio strutturale',
    });
  }

  if (hasStructural) {
    risks.push({
      type: 'Problemi strutturali/impiantistici',
      severity: 'high',
      costEstimate: 15000,
      description: 'Anomalie strutturali o impiantistiche individuate in perizia',
    });
  }

  if (risks.length < 3) {
    risks.push({
      type: 'Rischio di mercato nascosto',
      severity: 'low',
      costEstimate: 8000,
      description: 'Ulteriori criticità possono emergere in fase procedurale',
    });
  }

  return risks;
}

function calculateScore(risks, valuation, technical) {
  let score = 100;
  let forcedRed = false;
  let minYellow = false;

  risks.forEach((risk) => {
    if (risk.severity === 'critical') score -= 30;
    if (risk.severity === 'high') score -= 20;
    if (risk.severity === 'medium') score -= 12;
    if (risk.severity === 'low') score -= 6;

    if (risk.type === 'Difformità non sanabile') forcedRed = true;
    if (risk.type === 'Spese condominiali arretrate' && risk.costEstimate > 10000) minYellow = true;
  });

  if (technical.occupancyStatus && /abusivo/.test(technical.occupancyStatus.toLowerCase())) {
    score -= 15;
  }

  if (valuation.pricePerSqmAuction && valuation.marketPricePerSqm && valuation.pricePerSqmAuction > valuation.marketPricePerSqm) {
    score -= 10;
  }

  if (minYellow && score > 79) score = 79;
  if (forcedRed) score = Math.min(score, 59);
  score = Math.max(0, Math.min(100, score));

  if (score >= 80) return 80 + (score - 80);
  if (score >= 60) return score;
  return score;
}

function buildTrafficLight(score, risks, technical) {
  let color = '🔴';
  let label = 'ROSSO';
  if (score >= 80) {
    color = '🟢';
    label = 'VERDE';
  } else if (score >= 60) {
    color = '🟡';
    label = 'GIALLO';
  }
  if (technical.occupancyStatus && /abusivo/.test(technical.occupancyStatus.toLowerCase())) {
    if (label === 'VERDE') {
      color = '🟡';
      label = 'GIALLO';
    } else if (label === 'GIALLO') {
      color = '🔴';
      label = 'ROSSO';
    }
  }
  return { color, label };
}

function buildRecommendation(trafficLight, maxOffer, score, risks, technical) {
  if (trafficLight.label === 'ROSSO') {
    const reason = risks.find((risk) => risk.severity === 'critical') || risks[0];
    return `Non partecipare: ${reason.description.toLowerCase()}.`;
  }
  return `Offri fino a ${formatCurrency(maxOffer)}, non oltre. Il rischio è gestibile solo a quel prezzo.`;
}

function buildFormattedAnalysis(parsedData, estimation) {
  const technical = parsedData.technical;
  const valuation = estimation.valuation;
  const traffic = estimation.trafficLight;
  const score = estimation.riskScore;
  const risks = estimation.risks;

  const recommendation = buildRecommendation(traffic, estimation.maxOffer, score, risks, technical);

  return [
    `VERDETTO: ${traffic.color} ${traffic.label} — ${estimation.headline}`,
    `SCORE: ${score}/100`,
    '',
    'DATI ESTRATTI',
    `- Superficie: ${valuation.area ? `${Math.round(valuation.area)}mq` : 'N/D'} | Prezzo asta: ${formatCurrency(valuation.basePrice)} | ${valuation.pricePerSqmAuction ? formatCurrency(valuation.pricePerSqmAuction).replace('€', '€') : 'N/D'}/mq`,
    `- Valore CTU: ${formatCurrency(valuation.ctuValue)} | Sconto: ${formatPercent(valuation.discountPercent)}`,
    `- Mercato zona: ${formatCurrency(valuation.marketPricePerSqm).replace('€', '€')}/mq | Valore stimato: ${formatCurrency(valuation.marketValueEstimate)}`,
    `- Occupazione: ${technical.occupancyStatus || 'N/D'} | Anno: ${technical.yearBuilt || 'N/D'} | Piano: ${technical.floor || 'N/D'}`,
    '',
    'ANALISI FINANZIARIA',
    `- Ristrutturazione: ${formatCurrency(valuation.renovationCostTotal)} (${formatCurrency(valuation.renovationCostPerSqm).replace('€', '€')}/mq)`,
    `- Investimento totale: ${formatCurrency(valuation.totalInvestment)}`,
    `- Valore post-intervento: ${formatCurrency(valuation.postRenovationValue)}`,
    `- ROI rivendita lordo: ${formatPercent(valuation.roiResale)}`,
    `- ROI affitto lordo: ${formatPercent(valuation.roiRent)} (canone stimato ${formatCurrency(valuation.rentMonthly)}/mese)`,
    `- Breakeven: ${estimation.breakevenYears ? `${estimation.breakevenYears.toFixed(1)} anni` : 'N/D'}`,
    `- MASSIMALE OFFERTA: ${formatCurrency(estimation.maxOffer)}`,
    '',
    'RISCHI',
    ...risks.slice(0, 6).map((risk, index) => `${index + 1}. ${risk.type} — ${risk.severity} — ${formatCurrency(risk.costEstimate)}`),
    '',
    'RISPARMI OCCULTI EVITATI',
    `Rischi non visibili senza analisi professionale: ${formatCurrency(estimation.hiddenSavings)} totali potenziali.`,
    '',
    'RACCOMANDAZIONE FINALE',
    recommendation,
    '',
    '— External Opinion Agent v15.0 | Supervisione: Simone Azzali',
  ].join('\n');
}

async function estimate(parsedData, location = 'Modena') {
  const normativeData = await queryNormativeData(location, 'residential');
  const crossRef = crossReferenceWithNormative(parsedData.technical, normativeData);
  const technical = parsedData.technical || {};

  const area = getPrimaryArea(technical);
  const basePrice = parseNumber(technical.basePrice);
  const marketPricePerSqm = estimateMarketPricePerSqm(location, normativeData);
  const pricePerSqmAuction = area && basePrice ? basePrice / area : null;
  const discountPercent = pricePerSqmAuction ? safeDivision((marketPricePerSqm - pricePerSqmAuction) * 100, marketPricePerSqm) : null;
  const renovationCostPerSqm = area ? calculateRenovationCostPerSqm(technical, area) : null;
  const renovationCostTotal = area && renovationCostPerSqm ? Math.round(area * renovationCostPerSqm) : null;
  const postRenovationValue = area ? Math.round(area * marketPricePerSqm * 1.03) : null;
  const taxesAndFees = basePrice && renovationCostTotal ? Math.round((basePrice + renovationCostTotal) * 0.10) : null;
  const totalInvestment = basePrice && renovationCostTotal && taxesAndFees ? basePrice + renovationCostTotal + taxesAndFees : null;
  const roiResale = totalInvestment && postRenovationValue ? safeDivision((postRenovationValue - totalInvestment) * 100, totalInvestment) : null;
  const rentMonthly = area ? Math.round(area * 6) : null;
  const annualRent = rentMonthly ? rentMonthly * 12 : null;
  const roiRent = totalInvestment && annualRent ? safeDivision(annualRent * 100, totalInvestment) : null;
  const breakevenYears = annualRent && totalInvestment ? safeDivision(totalInvestment, annualRent) : null;
  const maxOfferResale = postRenovationValue && renovationCostTotal && taxesAndFees ? Math.round(postRenovationValue / 1.15 - renovationCostTotal - taxesAndFees) : null;
  const maxOffer = basePrice && maxOfferResale ? Math.max(0, Math.min(basePrice, maxOfferResale)) : basePrice || null;

  const valuation = {
    area,
    basePrice,
    ctuValue: parseNumber(technical.ctuValue),
    marketPricePerSqm,
    pricePerSqmAuction,
    discountPercent,
    marketValueEstimate: area ? Math.round(area * marketPricePerSqm) : null,
    renovationCostPerSqm,
    renovationCostTotal,
    postRenovationValue,
    taxesAndFees,
    totalInvestment,
    roiResale,
    rentMonthly,
    roiRent,
  };

  const risks = buildRiskItems(technical, valuation);
  const hiddenSavings = risks.reduce((sum, item) => sum + (item.costEstimate || 0), 0);
  const riskScore = Math.round(calculateScore(risks, valuation, technical));
  const trafficLight = buildTrafficLight(riskScore, risks, technical);

  const headline = trafficLight.label === 'ROSSO'
    ? 'Difformità o occupazione abusiva mettono a rischio il rendimento'
    : trafficLight.label === 'GIALLO'
      ? 'Opportunità condizionata da costi e regolarità tecniche'
      : 'Opportunità valida con prezzo conservativo e verifica documentale';

  const analysisText = buildFormattedAnalysis(parsedData, {
    valuation,
    riskScore,
    trafficLight,
    risks,
    hiddenSavings,
    maxOffer,
    breakevenYears,
    headline,
  });

  const coherenceAnalysis = govCheck.calculateCoherenceIndex(
    { area: area || null, buildings: [], unauthorizedStructures: [] },
    { area: area || null, buildings: [], unauthorizedStructures: [] }
  );

  return {
    parsedData,
    normativeData,
    crossReference: crossRef,
    risks,
    hiddenSavings,
    coherenceAnalysis,
    valuation,
    riskScore,
    trafficLight,
    maxOffer,
    breakevenYears,
    headline,
    analysisText,
  };
}

module.exports = {
  estimate,
};
