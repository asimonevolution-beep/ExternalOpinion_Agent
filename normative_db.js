const fs = require('fs').promises;
const path = require('path');
const logger = require('./utils/logger');

const NORMATIVE_DB_PATH = path.resolve(__dirname, 'normative_database.json');

/**
 * Initializes normative database with sample cadastral data
 */
async function initNormativeDB() {
  try {
    await fs.access(NORMATIVE_DB_PATH);
  } catch {
    const sampleData = {
      cadastral_zones: {
        'Modena': {
          avg_value_per_sqm: 1200,
          urban_coefficient: 0.6,
          max_buildable_area: 0.35,
          puc_restrictions: ['No industrial in residential zones'],
        },
        'Bologna': {
          avg_value_per_sqm: 1500,
          urban_coefficient: 0.7,
          max_buildable_area: 0.4,
          puc_restrictions: ['Green areas protected'],
        },
      },
      building_codes: {
        'residential': {
          min_room_height: 2.7,
          insulation_req: 'Class A',
          seismic_zone: '2',
        },
        'commercial': {
          min_room_height: 3.0,
          insulation_req: 'Class A+',
          seismic_zone: '2',
        },
      },
      last_updated: new Date().toISOString(),
    };
    await fs.writeFile(NORMATIVE_DB_PATH, JSON.stringify(sampleData, null, 2));
    logger.info('Normative database initialized with sample data');
  }
}

/**
 * Queries normative data for a specific location and property type
 * @param {string} location - City or zone name
 * @param {string} propertyType - Type of property (residential, commercial, etc.)
 * @returns {Object} Normative data
 */
async function queryNormativeData(location, propertyType = 'residential') {
  await initNormativeDB();
  const data = JSON.parse(await fs.readFile(NORMATIVE_DB_PATH, 'utf8'));

  const zoneData = data.cadastral_zones[location] || data.cadastral_zones['Modena']; // Default to Modena
  const codeData = data.building_codes[propertyType] || data.building_codes['residential'];

  return {
    location,
    propertyType,
    zone: zoneData,
    codes: codeData,
  };
}

/**
 * Cross-references extracted data with normative database
 * @param {Object} extractedData - Data extracted from PDF
 * @param {Object} normativeData - Normative data for location
 * @returns {Object} Cross-reference analysis
 */
function crossReferenceWithNormative(extractedData, normativeData) {
  const issues = [];
  const compliance = [];

  // Check area compliance
  if (extractedData.areas && extractedData.areas.length > 0) {
    const areaStr = extractedData.areas[0].replace(/[^0-9,.]/g, '').replace(',', '.');
    const area = parseFloat(areaStr);
    if (area && normativeData.zone.max_buildable_area) {
      const maxArea = normativeData.zone.max_buildable_area * 10000; // Assuming 1ha plot
      if (area > maxArea) {
        issues.push(`Area costruita (${area}mq) supera limite normativo (${maxArea}mq)`);
      } else {
        compliance.push('Area conforme ai limiti edificatori');
      }
    }
  }

  // Check value alignment
  if (normativeData.zone.avg_value_per_sqm) {
    compliance.push(`Valore medio zona: €${normativeData.zone.avg_value_per_sqm}/mq`);
  }

  // Check building codes
  if (normativeData.codes.insulation_req) {
    issues.push(`Verificare conformità isolamento: richiesto ${normativeData.codes.insulation_req}`);
  }

  return {
    issues,
    compliance,
    normative_refs: normativeData,
  };
}

module.exports = {
  initNormativeDB,
  queryNormativeData,
  crossReferenceWithNormative,
};