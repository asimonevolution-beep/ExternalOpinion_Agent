uconst PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./utils/logger');

/**
 * Agent Reporter - Handles PDF report generation
 * Single responsibility: Generate Premium and Teaser PDF reports from estimation data
 */
class AgentReporter {
  constructor() {
    this.reportsDir = path.resolve(__dirname, '..', 'REPORT_FINALI');
  }

  /**
   * Generate traffic light color based on risk score
   * @param {number} score - Risk/coherence score
   * @returns {string} Color name
   */
  getTrafficLightColor(score) {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    return 'red';
  }

  /**
   * Generate Premium Report (full details)
   * @param {Object} estimationData - Complete estimation data
   * @param {string} fileName - Base filename
   * @returns {string} Path to generated PDF
   */
  async generatePremiumReport(estimationData, fileName) {
    const outputPath = path.join(this.reportsDir, `PREMIUM_${fileName.replace('.pdf', '')}.pdf`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = require('fs').createWriteStream(outputPath);

      doc.pipe(stream);

      try {
        // Header
        doc.fontSize(24).fillColor('#2E86AB').text('EXTERNAL OPINION', { align: 'center' });
        doc.fontSize(18).fillColor('#000000').text('REPORT PREMIUM', { align: 'center' });
        doc.moveDown(2);

        // Property Information
        doc.fontSize(16).fillColor('#2E86AB').text('INFORMAZIONI PROPRIETÀ');
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000');

        const property = estimationData.property || {};
        doc.text(`Tipo: ${property.type || 'N/D'}`);
        doc.text(`Indirizzo: ${property.address || 'N/D'}`);
        doc.text(`Località: ${property.location || 'N/D'}`);
        doc.text(`Anno Costruzione: ${property.year || 'N/D'}`);
        doc.moveDown();

        // Dimensions
        doc.fontSize(16).fillColor('#2E86AB').text('DIMENSIONI E CARATTERISTICHE');
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000');

        const dimensions = estimationData.dimensions || {};
        doc.text(`Superficie: ${dimensions.area ? `${dimensions.area} mq` : 'N/D'}`);
        doc.text(`Locali: ${dimensions.rooms || 'N/D'}`);
        doc.moveDown();

        // Valuation
        doc.fontSize(16).fillColor('#2E86AB').text('VALUTAZIONE ECONOMICA');
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000');

        const valuation = estimationData.valuation || {};
        doc.text(`Prezzo Base Asta: ${valuation.basePrice ? `€ ${valuation.basePrice.toLocaleString()}` : 'N/D'}`);
        doc.text(`Valore di Mercato Stimato: ${valuation.estimatedMarketValue ? `€ ${valuation.estimatedMarketValue.toLocaleString()}` : 'N/D'}`);
        doc.text(`Costo Ristrutturazione: ${valuation.renovationCost ? `€ ${valuation.renovationCost.toLocaleString()}` : 'N/D'}`);

        if (valuation.profitAnalysis) {
          doc.moveDown(0.5);
          doc.text(`Investimento Totale: € ${valuation.profitAnalysis.totalInvestment?.toLocaleString() || 'N/D'}`);
          doc.text(`Profitto Potenziale Lordo: € ${valuation.profitAnalysis.grossProfit?.toLocaleString() || 'N/D'}`);
          doc.text(`Profitto Netto: € ${valuation.profitAnalysis.netProfit?.toLocaleString() || 'N/D'}`);
          doc.text(`ROI: ${valuation.profitAnalysis.roi ? `${valuation.profitAnalysis.roi.toFixed(1)}%` : 'N/D'}`);
        }
        doc.moveDown();

        // Risks
        doc.fontSize(16).fillColor('#2E86AB').text('RISCHI IDENTIFICATI');
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000');

        const risks = estimationData.risks || [];
        if (risks.length > 0) {
          risks.forEach((risk, index) => {
            const color = risk.severity === 'critical' ? '#FF0000' : risk.severity === 'high' ? '#FF6600' : '#FFA500';
            doc.fillColor(color).text(`${index + 1}. ${risk.description} (Severità: ${risk.severity})`);
            doc.fillColor('#000000');
          });
        } else {
          doc.text('Nessun rischio critico rilevato');
        }
        doc.moveDown();

        // Hidden Savings
        doc.fontSize(16).fillColor('#2E86AB').text('RISPARMI OCCULTI EVITATI');
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000');

        const hiddenSavings = estimationData.hiddenSavings || {};
        doc.text(hiddenSavings.message || 'N/D');

        if (hiddenSavings.breakdown) {
          doc.moveDown(0.5);
          hiddenSavings.breakdown.forEach(item => {
            doc.text(`• ${item.risk}: € ${item.potentialCost.toLocaleString()}`);
          });
        }
        doc.moveDown();

        // Coherence Analysis
        doc.fontSize(16).fillColor('#2E86AB').text('ANALISI COERENZA NORMATIVA');
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000');

        const coherence = estimationData.coherenceAnalysis || {};
        doc.text(`Coherence Index: ${coherence.coherenceScore || 'N/D'}/100`);
        doc.text(`Status: ${coherence.alert || 'N/D'}`);
        doc.moveDown();

        // Negotiation Leverage
        doc.fontSize(16).fillColor('#2E86AB').text('LEVA NEGOZIALE');
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000');
        doc.text(`Score Negoziale: ${estimationData.negotiationLeverage || 'N/D'}/100`);
        doc.moveDown(2);

        // Footer
        doc.fontSize(10).fillColor('#666666').text('Report generato automaticamente da External Opinion Agent', { align: 'center' });
        doc.text(`Data: ${new Date().toLocaleString('it-IT')}`, { align: 'center' });

        doc.end();

        stream.on('finish', () => {
          logger.info(`Agent Reporter: Premium report generated at ${outputPath}`);
          resolve(outputPath);
        });

        stream.on('error', (error) => {
          logger.error('Agent Reporter: Error generating premium report:', error);
          reject(error);
        });

      } catch (error) {
        logger.error('Agent Reporter: Error in premium report generation:', error);
        reject(error);
      }
    });
  }

  /**
   * Generate Teaser Report (summary with obscured values)
   * @param {Object} estimationData - Complete estimation data
   * @param {string} fileName - Base filename
   * @returns {string} Path to generated PDF
   */
  async generateTeaserReport(estimationData, fileName) {
    const outputPath = path.join(this.reportsDir, `TEASER_${fileName.replace('.pdf', '')}.pdf`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = require('fs').createWriteStream(outputPath);

      doc.pipe(stream);

      try {
        // Header
        doc.fontSize(24).fillColor('#2E86AB').text('EXTERNAL OPINION', { align: 'center' });
        doc.fontSize(18).fillColor('#000000').text('REPORT TEASER', { align: 'center' });
        doc.moveDown(2);

        // Property Overview
        doc.fontSize(16).fillColor('#2E86AB').text('RIASSUNTO PROPRIETÀ');
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000');

        const property = estimationData.property || {};
        doc.text(`Tipo: ${property.type || 'N/D'}`);
        doc.text(`Località: ${property.location || 'N/D'}`);
        doc.text(`Anno Costruzione: ${property.year || 'N/D'}`);
        doc.moveDown();

        // Traffic Light Indicators
        doc.fontSize(16).fillColor('#2E86AB').text('SEMAFORI DI RISCHIO');
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000');

        // Risk Level
        const riskScore = estimationData.negotiationLeverage || 50;
        const riskColor = this.getTrafficLightColor(riskScore);
        const riskText = riskColor === 'green' ? 'RISCHIO BASSO' : riskColor === 'yellow' ? 'RISCHIO MEDIO' : 'RISCHIO ALTO';

        doc.fillColor(riskColor === 'green' ? '#00AA00' : riskColor === 'yellow' ? '#FFAA00' : '#FF0000')
           .text(`🔴 ${riskText}`, { align: 'center' });
        doc.fillColor('#000000').moveDown();

        // Coherence Level
        const coherenceScore = estimationData.coherenceAnalysis?.coherenceScore || 50;
        const coherenceColor = this.getTrafficLightColor(coherenceScore);
        const coherenceText = coherenceColor === 'green' ? 'COERENZA ALTA' : coherenceColor === 'yellow' ? 'COERENZA MEDIA' : 'COERENZA BASSA';

        doc.fillColor(coherenceColor === 'green' ? '#00AA00' : coherenceColor === 'yellow' ? '#FFAA00' : '#FF0000')
           .text(`🔴 ${coherenceText}`, { align: 'center' });
        doc.fillColor('#000000').moveDown();

        // Obscured Values
        doc.fontSize(16).fillColor('#2E86AB').text('VALORI ECONOMICI');
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000');
        doc.text('Valore di Mercato Stimato: ******* €');
        doc.text('Costo Ristrutturazione: ******* €');
        doc.text('Profitto Potenziale: ******* €');
        doc.text('ROI Atteso: ******* %');
        doc.moveDown();

        // Hidden Savings Teaser
        doc.fontSize(16).fillColor('#2E86AB').text('RISPARMI OCCULTI');
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000');
        doc.text('Risparmi potenziali identificati: ******* €');
        doc.moveDown();

        // Call to Action
        doc.fontSize(16).fillColor('#FF6600').text('SBLOCCA L\'ANALISI PREMIUM', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000').text(
          'Per visualizzare i valori economici esatti, i dettagli delle difformità ' +
          'e le raccomandazioni operative complete, acquista l\'Analisi Premium.',
          { align: 'center' }
        );
        doc.moveDown(2);

        // Footer
        doc.fontSize(10).fillColor('#666666').text('Report teaser generato automaticamente da External Opinion Agent', { align: 'center' });
        doc.text(`Data: ${new Date().toLocaleString('it-IT')}`, { align: 'center' });

        doc.end();

        stream.on('finish', () => {
          logger.info(`Agent Reporter: Teaser report generated at ${outputPath}`);
          resolve(outputPath);
        });

        stream.on('error', (error) => {
          logger.error('Agent Reporter: Error generating teaser report:', error);
          reject(error);
        });

      } catch (error) {
        logger.error('Agent Reporter: Error in teaser report generation:', error);
        reject(error);
      }
    });
  }

  /**
   * Generate both Premium and Teaser reports
   * @param {Object} estimationData - Complete estimation data
   * @param {string} fileName - Base filename
   * @returns {Object} Paths to both reports
   */
  async generateReports(estimationData, fileName) {
    try {
      logger.info(`Agent Reporter: Generating reports for ${fileName}`);

      const [premiumPath, teaserPath] = await Promise.all([
        this.generatePremiumReport(estimationData, fileName),
        this.generateTeaserReport(estimationData, fileName)
      ]);

      logger.info('Agent Reporter: Both reports generated successfully');

      return {
        premium: premiumPath,
        teaser: teaserPath
      };
    } catch (error) {
      logger.error('Agent Reporter: Error generating reports:', error);
      throw error;
    }
  }
}

module.exports = new AgentReporter();