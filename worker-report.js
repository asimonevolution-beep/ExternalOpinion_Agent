/**
 * EXTERNAL OPINION — WORKER REPORT V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 * 
 * Responsabilità:
 * - PDF generation
 * - Report rendering
 * - Forensic hashing
 * - Digital signature
 * - S3 storage
 */

const { Worker } = require('bullmq');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('./db');
const { recordJobEvent } = require('./orchestrator');

const WORKER_ID = `report-${crypto.randomBytes(4).toString('hex')}`;

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const worker = new Worker('reportRenderQueue', async (job) => {
  const { jobId, urlOriginale, calcoliScoring, spiegazione, hashScoring } =
    job.data;
  const startTime = Date.now();

  try {
    console.log(`[REPORT ${WORKER_ID}] Processing Job: ${jobId}`);

    await recordJobEvent(jobId, 'REPORT_RENDERED', {}, WORKER_ID);

    // ===== PDF GENERATION =====
    const doc = new PDFDocument({
      bufferPages: true,
      font: 'Helvetica',
    });

    // Header
    doc.fontSize(24).text('EXTERNAL OPINION', { align: 'center' });
    doc.fontSize(12).text(`Report ID: ${jobId}`, { align: 'center' });
    doc.fontSize(10).text(`Timestamp: ${new Date().toISOString()}`, {
      align: 'center',
    });

    doc.addPage();

    // Coherence Section
    doc.fontSize(16).text('Coherence Index Analysis', { underline: true });
    doc.fontSize(11).text(`Score: ${calcoliScoring.coherenceIndex}/100`, {
      margin: 10,
    });
    doc
      .fontSize(10)
      .text(
        `Semaforo: ${calcoliScoring.semaforo}`,
        { margin: 10 }
      );

    doc.addPage();

    // Valuation Section
    doc.fontSize(16).text('Valuation Engine', { underline: true });
    doc.fontSize(11).text(`Valore Attuale: €${calcoliScoring.valoreAttuale}`, {
      margin: 10,
    });
    doc.fontSize(11).text(`Valore Potenziale: €${calcoliScoring.valorePotenziale}`, {
      margin: 10,
    });
    doc.fontSize(11).text(`Valore Futuro: €${calcoliScoring.valoreFuturoProiettato}`, {
      margin: 10,
    });

    doc.addPage();

    // ROI Section
    doc.fontSize(16).text('ROI Analysis', { underline: true });
    doc.fontSize(11).text(`ROI: ${calcoliScoring.roi}%`, { margin: 10 });
    doc.fontSize(11).text(
      `Conveniente: ${calcoliScoring.roiConveniente ? 'SÌ' : 'NO'}`,
      { margin: 10 }
    );

    doc.addPage();

    // Explainability
    doc.fontSize(14).text('Explanation', { underline: true });
    if (spiegazione.riskProfile) {
      doc
        .fontSize(10)
        .text(`Risk Level: ${spiegazione.riskProfile.riskLevel}`, {
          margin: 10,
        });
      if (spiegazione.riskProfile.riskFactors) {
        doc.fontSize(10).text('Risk Factors:');
        spiegazione.riskProfile.riskFactors.forEach((factor) => {
          doc
            .fontSize(9)
            .text(
              `- ${factor.categoria}: ${factor.descrizione} (${factor.severita})`,
              { margin: 15 }
            );
        });
      }
    }

    doc.addPage();

    // Footer
    doc.fontSize(8).text(`Hash Forensico: ${hashScoring.substring(0, 32)}...`, {
      align: 'center',
      margin: 10,
    });

    // Converti a buffer
    const pdfBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });

    // SHA-256 report
    const reportHash = crypto
      .createHash('sha256')
      .update(pdfBuffer)
      .digest('hex');

    // Salva audit hash
    await prisma.auditHash.create({
      data: {
        jobId,
        stepName: 'REPORT',
        hashValue: reportHash,
        payload: {
          pdfSizeBytes: pdfBuffer.length,
          renderedAt: new Date().toISOString(),
        },
        workerId: WORKER_ID,
      },
    });

    // Salva artefatto
    await prisma.reportArtifact.create({
      data: {
        jobId,
        artifactType: 'pdf',
        storageUrl: `/artifacts/${jobId}/report.pdf`,
        fileHash: reportHash,
        fileSizeBytes: pdfBuffer.byteLength,
        mimeType: 'application/pdf',
      },
    });

    // Aggiorna Immobile con hash finale
    await prisma.immobile.update({
      where: { jobId },
      data: {
        hashReport: reportHash,
      },
    });

    const durationMs = Date.now() - startTime;

    await recordJobEvent(
      jobId,
      'REPORT_HASHED',
      {
        reportHash,
        pdfSizeBytes: pdfBuffer.byteLength,
      },
      WORKER_ID,
      durationMs
    );

    return {
      jobId,
      reportHash,
      pdfBuffer: pdfBuffer.toString('base64'), // Per chain
      pdfSize: pdfBuffer.byteLength,
    };
  } catch (err) {
    console.error(`[REPORT ${WORKER_ID}] Error for Job ${jobId}:`, err.message);

    await recordJobEvent(
      jobId,
      'JOB_FAILED',
      { error: err.message, stage: 'REPORT_GENERATION' },
      WORKER_ID
    );

    throw err;
  }
}, {
  connection: redisConnection,
  concurrency: 4,
});

worker.on('completed', (job) => {
  console.log(`[REPORT ${WORKER_ID}] ✓ Completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(
    `[REPORT ${WORKER_ID}] ✗ Failed (attempt ${job.attemptsMade}): ${job.id}`,
    err.message
  );
});

console.log(`[REPORT ${WORKER_ID}] Ready to process reportRenderQueue`);

module.exports = worker;
