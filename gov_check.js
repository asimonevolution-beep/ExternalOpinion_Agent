const logger = require('./utils/logger');

/**
 * Calculates coherence index between cadastral data and field data
 * @param {Object} cadastralData - Data from cadastral documents
 * @param {Object} fieldData - Data from optical/field sources
 * @returns {Object} Coherence analysis
 */
function calculateCoherenceIndex(cadastralData, fieldData) {
  let coherenceScore = 100;
  const issues = [];

  // Compare areas
  if (cadastralData.area && fieldData.area) {
    const areaDiff = Math.abs(cadastralData.area - fieldData.area) / cadastralData.area;
    if (areaDiff > 0.1) { // 10% difference
      coherenceScore -= 20;
      issues.push({
        type: 'area_mismatch',
        cadastral: cadastralData.area,
        field: fieldData.area,
        difference: areaDiff * 100,
      });
    }
  }

  // Compare volumes/buildings
  if (cadastralData.buildings && fieldData.buildings) {
    const buildingDiff = Math.abs(cadastralData.buildings.length - fieldData.buildings.length);
    if (buildingDiff > 0) {
      coherenceScore -= 15;
      issues.push({
        type: 'building_count_mismatch',
        cadastral: cadastralData.buildings.length,
        field: fieldData.buildings.length,
      });
    }
  }

  // Check for unauthorized constructions
  if (fieldData.unauthorizedStructures && fieldData.unauthorizedStructures.length > 0) {
    coherenceScore -= 30;
    issues.push({
      type: 'unauthorized_structures',
      count: fieldData.unauthorizedStructures.length,
    });
  }

  coherenceScore = Math.max(0, coherenceScore);

  const alert = coherenceScore < 80 ? 'ALERT: Coherence below 80% - Immediate verification required' : 'Coherence acceptable';

  logger.info('Coherence index calculated', { coherenceScore, issueCount: issues.length, alert });

  return {
    coherenceScore,
    issues,
    alert,
    sideBySideData: {
      cadastral: cadastralData,
      field: fieldData,
    },
  };
}

/**
 * Generates quick-scan report for municipal technicians
 * @param {Object} coherenceAnalysis - Coherence analysis result
 * @returns {string} Quick-scan report
 */
function generateQuickScanReport(coherenceAnalysis) {
  const report = `
============================================================
GOV-CHECK QUICK-SCAN REPORT
============================================================
COHERENCE INDEX: ${coherenceAnalysis.coherenceScore}/100
STATUS: ${coherenceAnalysis.alert}

ISSUES DETECTED:
${coherenceAnalysis.issues.map((issue, i) => `${i + 1}. ${issue.type}: ${JSON.stringify(issue)}`).join('\n')}

SIDE-BY-SIDE COMPARISON:
CADASTRAL DATA: ${JSON.stringify(coherenceAnalysis.sideBySideData.cadastral, null, 2)}
FIELD DATA: ${JSON.stringify(coherenceAnalysis.sideBySideData.field, null, 2)}

RECOMMENDATIONS:
${coherenceAnalysis.coherenceScore < 80 ? '- Immediate site inspection required\n- Potential unauthorized constructions detected\n- Administrative sanctions may apply' : '- Data coherence verified\n- Proceed with standard procedures'}
============================================================
`;

  return report;
}

module.exports = {
  calculateCoherenceIndex,
  generateQuickScanReport,
};