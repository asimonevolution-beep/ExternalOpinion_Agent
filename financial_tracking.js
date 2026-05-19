const fs = require('fs').promises;
const path = require('path');
const logger = require('./utils/logger');

const FINANCIAL_DB_PATH = path.resolve(__dirname, 'financial_tracking.json');

/**
 * Initializes financial tracking database
 */
async function initFinancialDB() {
  try {
    await fs.access(FINANCIAL_DB_PATH);
  } catch {
    await fs.writeFile(FINANCIAL_DB_PATH, JSON.stringify({
      totalValidatedValue: 0,
      totalOperations: 0,
      operations: [],
      lastUpdated: new Date().toISOString(),
    }, null, 2));
    logger.info('Financial tracking database initialized');
  }
}

/**
 * Records a validated operation
 * @param {number} value - Value of the operation in EUR
 * @param {string} type - Type of operation (e.g., 'real_estate_analysis', 'compliance_check')
 * @param {Object} metadata - Additional metadata
 */
async function recordValidatedOperation(value, type = 'real_estate_analysis', metadata = {}) {
  await initFinancialDB();

  const data = JSON.parse(await fs.readFile(FINANCIAL_DB_PATH, 'utf8'));
  data.totalValidatedValue += value;
  data.totalOperations += 1;
  data.operations.push({
    id: Date.now(),
    value,
    type,
    timestamp: new Date().toISOString(),
    metadata,
  });
  data.lastUpdated = new Date().toISOString();

  await fs.writeFile(FINANCIAL_DB_PATH, JSON.stringify(data, null, 2));
  logger.info('Operation recorded in financial tracking', { value, type, totalValue: data.totalValidatedValue });
}

/**
 * Gets financial summary
 * @returns {Object} Financial summary
 */
async function getFinancialSummary() {
  await initFinancialDB();
  const data = JSON.parse(await fs.readFile(FINANCIAL_DB_PATH, 'utf8'));
  return {
    totalValidatedValue: data.totalValidatedValue,
    totalOperations: data.totalOperations,
    averageValue: data.totalOperations > 0 ? data.totalValidatedValue / data.totalOperations : 0,
    lastUpdated: data.lastUpdated,
  };
}

/**
 * Generates annual financial report
 * @param {number} year - Year to report (optional, defaults to current year)
 * @returns {string} Annual report
 */
async function generateAnnualReport(year = new Date().getFullYear()) {
  await initFinancialDB();
  const data = JSON.parse(await fs.readFile(FINANCIAL_DB_PATH, 'utf8'));

  const yearOperations = data.operations.filter(op => new Date(op.timestamp).getFullYear() === year);
  const yearValue = yearOperations.reduce((sum, op) => sum + op.value, 0);

  const report = `
============================================================
EXTERNAL OPINION FINANCIAL REPORT ${year}
============================================================
TOTAL VALIDATED VALUE: €${data.totalValidatedValue.toFixed(2)}
TOTAL OPERATIONS: ${data.totalOperations}
AVERAGE VALUE PER OPERATION: €${(data.totalValidatedValue / Math.max(data.totalOperations, 1)).toFixed(2)}

YEAR ${year} SUMMARY:
- Operations: ${yearOperations.length}
- Value: €${yearValue.toFixed(2)}
- Monthly Average: €${(yearValue / 12).toFixed(2)}

RECENT OPERATIONS:
${yearOperations.slice(-5).map(op => `- ${new Date(op.timestamp).toLocaleDateString()}: €${op.value.toFixed(2)} (${op.type})`).join('\n')}

LAST UPDATED: ${data.lastUpdated}
============================================================
`;

  return report;
}

module.exports = {
  initFinancialDB,
  recordValidatedOperation,
  getFinancialSummary,
  generateAnnualReport,
};