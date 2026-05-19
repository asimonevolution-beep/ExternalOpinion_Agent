const logger = require('./utils/logger');
const { queryNormativeData, crossReferenceWithNormative } = require('./normative_db');
const { calculateHiddenSavings, identifyRisks } = require('./investor_leverage');
const { calculateCoherenceIndex } = require('./gov_check');

/**
 * Synthesizes Real + Normative + Economic data for comprehensive analysis
 * @param {Object} realData - Data extracted from PDF/website
 * @param {Object} normativeData - Normative database data
 * @param {Object} economicData - Economic analysis data
 * @returns {Object} Synthesized analysis
 */
async function synthesizeData(realData, normativeData, economicData) {
  try {
    logger.info('Starting data synthesis');

    // Cross-reference with normative data
    const normativeCrossRef = crossReferenceWithNormative(realData, normativeData);

    // Calculate economic leverage
    const hiddenSavings = calculateHiddenSavings(realData);
    const risks = identifyRisks(realData);

    // Calculate coherence index
    const coherenceIndex = calculateCoherenceIndex(realData, normativeData);

    // Generate comprehensive report
    const synthesis = {
      property_id: realData.property_id || 'unknown',
      timestamp: new Date().toISOString(),

      // Real data section
      real_data: {
        location: realData.location,
        area: realData.areas ? realData.areas[0] : null,
        base_price: realData.prices ? realData.prices[0] : null,
        rooms: realData.rooms,
        description: realData.description,
      },

      // Normative compliance section
      normative_compliance: {
        zone_data: normativeData.zone,
        building_codes: normativeData.codes,
        issues: normativeCrossRef.issues,
        compliance_points: normativeCrossRef.compliance,
        coherence_index: coherenceIndex,
      },

      // Economic analysis section
      economic_analysis: {
        hidden_savings: hiddenSavings,
        identified_risks: risks,
        market_value_estimate: calculateMarketValue(realData, normativeData),
        negotiation_leverage: calculateNegotiationLeverage(hiddenSavings, risks),
      },

      // Synthesis insights
      insights: generateInsights(realData, normativeData, economicData),

      // Recommendations
      recommendations: generateRecommendations(coherenceIndex, hiddenSavings, risks),
    };

    logger.info('Data synthesis completed');
    return synthesis;
  } catch (error) {
    logger.error('Error in data synthesis:', error);
    throw error;
  }
}

/**
 * Calculates estimated market value based on normative data
 * @param {Object} realData - Real property data
 * @param {Object} normativeData - Normative data
 * @returns {number} Estimated market value
 */
function calculateMarketValue(realData, normativeData) {
  if (!realData.areas || !normativeData.zone.avg_value_per_sqm) return null;

  const areaStr = realData.areas[0].replace(/[^0-9,.]/g, '').replace(',', '.');
  const area = parseFloat(areaStr);

  if (!area) return null;

  const baseValue = area * normativeData.zone.avg_value_per_sqm;
  const urbanCoeff = normativeData.zone.urban_coefficient || 1;

  return Math.round(baseValue * urbanCoeff);
}

/**
 * Calculates negotiation leverage score
 * @param {Object} hiddenSavings - Hidden savings data
 * @param {Array} risks - Identified risks
 * @returns {number} Leverage score (0-100)
 */
function calculateNegotiationLeverage(hiddenSavings, risks) {
  let leverage = 50; // Base leverage

  // Add leverage from hidden savings
  if (hiddenSavings.total_savings > 0) {
    leverage += Math.min(hiddenSavings.total_savings / 10000, 30); // Max 30 points
  }

  // Subtract leverage from risks
  const riskPenalty = risks.length * 5;
  leverage -= Math.min(riskPenalty, 20); // Max 20 point penalty

  return Math.max(0, Math.min(100, leverage));
}

/**
 * Generates insights from synthesized data
 * @param {Object} realData - Real data
 * @param {Object} normativeData - Normative data
 * @param {Object} economicData - Economic data
 * @returns {Array} Insights array
 */
function generateInsights(realData, normativeData, economicData) {
  const insights = [];

  // Location insights
  if (normativeData.zone.avg_value_per_sqm > 1300) {
    insights.push('Zona ad alto valore immobiliare - opportunità di investimento premium');
  }

  // Area insights
  if (realData.areas && realData.areas[0]) {
    const area = parseFloat(realData.areas[0].replace(/[^0-9,.]/g, '').replace(',', '.'));
    if (area > 200) {
      insights.push('Superficie ampia - potenziale per riconversione commerciale');
    }
  }

  // Economic insights
  if (economicData && economicData.hidden_savings > 5000) {
    insights.push('Elevato potenziale risparmio su imprevisti - forte leva negoziale');
  }

  return insights;
}

/**
 * Generates recommendations based on analysis
 * @param {number} coherenceIndex - Coherence index
 * @param {Object} hiddenSavings - Hidden savings
 * @param {Array} risks - Risks
 * @returns {Array} Recommendations array
 */
function generateRecommendations(coherenceIndex, hiddenSavings, risks) {
  const recommendations = [];

  if (coherenceIndex < 70) {
    recommendations.push('Richiedere documentazione integrativa per verificare conformità normativa');
  }

  if (hiddenSavings.total_savings > 10000) {
    recommendations.push('Utilizzare risparmi nascosti come leva per riduzione prezzo base d\'asta');
  }

  if (risks.length > 3) {
    recommendations.push('Valutare approfondimento tecnico prima della partecipazione');
  }

  if (recommendations.length === 0) {
    recommendations.push('Proprietà conforme - procedere con offerta competitiva');
  }

  return recommendations;
}

module.exports = {
  synthesizeData,
  calculateMarketValue,
  calculateNegotiationLeverage,
  generateInsights,
  generateRecommendations,
};