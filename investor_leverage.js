const logger = require('./utils/logger');

/**
 * Calculates potential hidden savings by comparing detected risks with market average costs
 * @param {Array} detectedRisks - List of detected risks from analysis
 * @returns {Object} Hidden savings analysis
 */
function calculateHiddenSavings(detectedRisks) {
  // Market average costs for common risks (in EUR)
  const riskCosts = {
    infiltration: 15000,
    moisture: 8000,
    thermal_bridge: 12000,
    structural_decay: 25000,
    obsolescence: 10000,
    condensation: 6000,
  };

  let totalPotentialCost = 0;
  const breakdown = [];

  detectedRisks.forEach(risk => {
    const cost = riskCosts[risk.type] || 5000; // Default cost
    totalPotentialCost += cost;
    breakdown.push({
      risk: risk.type,
      potentialCost: cost,
      description: risk.description,
    });
  });

  const avoidedCost = totalPotentialCost * 0.9; // Assuming 90% of potential costs are avoided with early detection

  logger.info('Hidden savings calculated', { totalPotentialCost, avoidedCost, riskCount: detectedRisks.length });

  return {
    totalPotentialCost,
    avoidedCost,
    breakdown,
    message: `Grazie a questa analisi, hai evitato potenziali costi occulti per €${avoidedCost.toFixed(2)}.`,
  };
}

/**
 * Identifies risks from technical analysis
 * @param {Object} technicalData - Extracted technical data
 * @param {Object} cashflowData - Cash flow analysis
 * @returns {Array} Detected risks
 */
function identifyRisks(technicalData, cashflowData) {
  const risks = [];

  // Check for moisture indicators
  if (technicalData.summary.toLowerCase().includes('umidità') || technicalData.summary.toLowerCase().includes('infiltrazione')) {
    risks.push({
      type: 'infiltration',
      severity: 'high',
      description: 'Possibili infiltrazioni d\'acqua rilevate',
    });
  }

  // Check for thermal issues
  if (technicalData.summary.toLowerCase().includes('ponte termico') || technicalData.summary.toLowerCase().includes('dispersione')) {
    risks.push({
      type: 'thermal_bridge',
      severity: 'medium',
      description: 'Anomalie termiche potenzialmente presenti',
    });
  }

  // Check for obsolescence
  if (cashflowData.builtArea && cashflowData.builtArea > 100) {
    risks.push({
      type: 'obsolescence',
      severity: 'low',
      description: 'Possibile obsolescenza impianti',
    });
  }

  return risks;
}

module.exports = {
  calculateHiddenSavings,
  identifyRisks,
};