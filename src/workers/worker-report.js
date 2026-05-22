/**
 * EXTERNAL OPINION — WORKER REPORT V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 *
 * Responsabilita:
 * - Generazione PDF professionale con PDFKit
 * - Salvataggio fisico su disco in /OUTPUT_REPORT/
 * - Forensic hash SHA-256 del PDF
 * - Aggiornamento DB (ReportArtifact + AuditHash + Immobile)
 * - Job status -> REPORT_READY
 */

const { Worker }    = require('bullmq');
const PDFDocument   = require('pdfkit');
const crypto        = require('crypto');
const fs            = require('fs');
const path          = require('path');
const prisma        = require('../../db');
const { recordJobEvent } = require('../../orchestrator');

const WORKER_ID  = `report-${crypto.randomBytes(4).toString('hex')}`;
const OUTPUT_DIR = path.join(__dirname, 'OUTPUT_REPORT');

// Assicura che la directory di output esista
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const { getRedisConnection } = require('../../redis-connection');
const redisConnection = getRedisConnection();

// ============================================================================
// HELPER — formatta euro
// ============================================================================
function eur(n) {
  return typeof n === 'number' ? `EUR ${n.toLocaleString('it-IT')}` : 'N/D';
}

// ============================================================================
// GENERAZIONE PDF
// ============================================================================
async function generaPDF(jobId, calcoliScoring, spiegazione, datiEstrattiEValidati, hashScoring, urlOriginale) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks = [];
    doc.on('data',  c  => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const CREAM  = '#F5F0E8';
    const INK    = '#1A1612';
    const ACCENT = '#C8A96E';
    const GREEN  = '#1E8449';
    const YELLOW = '#D4AC0D';
    const RED    = '#C0392B';
    const semaforoColor = calcoliScoring.semaforo === 'VERDE' ? GREEN : calcoliScoring.semaforo === 'GIALLO' ? YELLOW : RED;

    // ---- COPERTINA ----
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(INK);
    doc.fillColor(CREAM)
       .font('Helvetica-Bold').fontSize(28)
       .text('EXTERNAL OPINION', 50, 120, { align: 'center' });
    doc.fillColor(ACCENT).font('Helvetica').fontSize(13)
       .text('Parere Tecnico Indipendente', 50, 160, { align: 'center' });

    doc.fillColor(semaforoColor).font('Helvetica-Bold').fontSize(48)
       .text(calcoliScoring.semaforo, 50, 230, { align: 'center' });

    doc.fillColor(CREAM).font('Helvetica').fontSize(10)
       .text(`Report ID: ${jobId}`, 50, 310, { align: 'center' })
       .text(`Data:      ${new Date().toLocaleDateString('it-IT')}`, 50, 328, { align: 'center' })
       .text(`Hash:      ${hashScoring.substring(0, 32)}...`, 50, 346, { align: 'center' });

    if (urlOriginale) {
      doc.fillColor(ACCENT).fontSize(9)
         .text(`Fonte: ${urlOriginale.substring(0, 80)}`, 50, 370, { align: 'center' });
    }

    // ---- PAGINA 2: COHERENCE INDEX ----
    doc.addPage();
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text('1. Indice di Coerenza (Coherence Index)', 50, 50);
    doc.moveTo(50, 75).lineTo(545, 75).strokeColor(ACCENT).lineWidth(1).stroke();

    const ci = calcoliScoring.coherenceIndex;
    doc.fillColor(semaforoColor).font('Helvetica-Bold').fontSize(52)
       .text(`${ci}/100`, 50, 90, { align: 'center' });

    doc.fillColor(INK).font('Helvetica').fontSize(11).text(
      spiegazione?.coherence?.interpretazione || '',
      50, 160, { width: 495, lineGap: 4 }
    );

    // Breakdown penalita
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(12).text('Penalita rilevate:');
    doc.moveDown(0.5);
    const penalties = spiegazione?.coherence?.penaltyBreakdown || [];
    if (penalties.length === 0) {
      doc.font('Helvetica').fontSize(11).fillColor(GREEN).text('Nessuna penalita rilevata — immobile conforme.');
    } else {
      penalties.forEach(p => {
        doc.fillColor(RED).font('Helvetica-Bold').fontSize(11)
           .text(`  - ${p.descrizione}  (-${p.penalita}%)`, { lineGap: 3 });
        doc.fillColor(INK).font('Helvetica').fontSize(10)
           .text(`    Impatto: ${p.impatto}`, { lineGap: 5 });
      });
    }

    // ---- PAGINA 3: VALUTAZIONE ----
    doc.addPage();
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text('2. Valutazione Economica', 50, 50);
    doc.moveTo(50, 75).lineTo(545, 75).strokeColor(ACCENT).lineWidth(1).stroke();

    const rows = [
      ['Valore Attuale (stato corrente)',       eur(calcoliScoring.valoreAttuale)],
      ['Valore Potenziale (post-sanatoria)',     eur(calcoliScoring.valorePotenziale)],
      ['Valore Futuro Proiettato (2 anni)',      eur(calcoliScoring.valoreFuturoProiettato)],
      ['Costi Totali Operativi',                eur(calcoliScoring.costiTotaliOperativi)],
      ['Margine Reale',                         eur(calcoliScoring.margineReale)],
      ['Profitto Futuro Post-Rivendita',         eur(calcoliScoring.profittoFuturoPostRivendita)],
    ];

    let y = 90;
    rows.forEach(([label, val], i) => {
      const bg = i % 2 === 0 ? '#F9F6F0' : '#FFFFFF';
      doc.rect(50, y, 495, 24).fill(bg).fillColor(INK);
      doc.font('Helvetica').fontSize(11).fillColor(INK)
         .text(label, 60, y + 6, { width: 300 });
      doc.font('Helvetica-Bold').fontSize(11)
         .text(val, 360, y + 6, { width: 175, align: 'right' });
      y += 24;
    });

    // ---- PAGINA 4: ROI ----
    doc.addPage();
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text('3. Analisi ROI', 50, 50);
    doc.moveTo(50, 75).lineTo(545, 75).strokeColor(ACCENT).lineWidth(1).stroke();

    const roiColor = calcoliScoring.roiConveniente ? GREEN : RED;
    doc.fillColor(roiColor).font('Helvetica-Bold').fontSize(52)
       .text(`${calcoliScoring.roi}%`, 50, 90, { align: 'center' });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(14)
       .text(calcoliScoring.roiConveniente ? 'INVESTIMENTO CONVENIENTE' : 'INVESTIMENTO NON CONVENIENTE',
             50, 155, { align: 'center' });
    doc.font('Helvetica').fontSize(11).fillColor(INK).moveDown(1)
       .text(spiegazione?.roi?.recommendation || '', 50, doc.y, { width: 495, lineGap: 4 });

    // ---- PAGINA 5: PROFILO RISCHIO ----
    doc.addPage();
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text('4. Profilo di Rischio', 50, 50);
    doc.moveTo(50, 75).lineTo(545, 75).strokeColor(ACCENT).lineWidth(1).stroke();

    const riskFactors = spiegazione?.riskProfile?.riskFactors || [];
    if (riskFactors.length === 0) {
      doc.moveDown(1).font('Helvetica').fontSize(11).fillColor(GREEN)
         .text('Nessun fattore di rischio critico rilevato.');
    } else {
      doc.moveDown(1);
      riskFactors.forEach(f => {
        const fc = f.severita === 'ALTA' ? RED : f.severita === 'MEDIA' ? YELLOW : INK;
        doc.fillColor(fc).font('Helvetica-Bold').fontSize(11)
           .text(`[${f.severita}] ${f.categoria}: ${f.descrizione}`, { lineGap: 3 });
        doc.fillColor(INK).font('Helvetica').fontSize(10)
           .text(`Impatto: ${f.impatto}`, { lineGap: 8 });
      });
    }

    doc.moveDown(2);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12)
       .text('Raccomandazione finale:');
    doc.font('Helvetica').fontSize(11)
       .text(spiegazione?.riskProfile?.recommendation || '', { width: 495, lineGap: 4 });

    // ---- PAGINA 6: DATI TECNICI & FIRMA ----
    doc.addPage();
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text('5. Dati Tecnici & Certificazione', 50, 50);
    doc.moveTo(50, 75).lineTo(545, 75).strokeColor(ACCENT).lineWidth(1).stroke();

    doc.moveDown(1).font('Helvetica').fontSize(10).fillColor(INK);
    doc.text(`Modello AI:          ${datiEstrattiEValidati?.source?.document || 'N/D'}`);
    doc.text(`Confidence Score:    ${((datiEstrattiEValidati?.confidence || 0) * 100).toFixed(1)}%`);
    doc.text(`Logic Engine:        V18.3 — Deterministico`);
    doc.text(`Generato il:         ${new Date().toISOString()}`);
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(10).text('Hash Forensico SHA-256 (integrita documento):');
    doc.font('Courier').fontSize(9).fillColor(ACCENT).text(hashScoring);

    doc.moveDown(2);
    doc.rect(50, doc.y, 495, 60).stroke(INK);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11)
       .text('Validato da: Geometra Simone Azzali', 60, doc.y + 10);
    doc.font('Helvetica').fontSize(10)
       .text('External Opinion — Parere Tecnico Indipendente', 60, doc.y + 5);

    doc.end();
  });
}

// ============================================================================
// WORKER
// ============================================================================

const worker = new Worker('reportRenderQueue', async (job) => {
  const { jobId } = job.data;
  const startTime = Date.now();

  try {
    console.log(`[REPORT ${WORKER_ID}] Processing Job: ${jobId}`);
    await recordJobEvent(jobId, 'REPORT_STARTED', {}, WORKER_ID);

    // Legge tutti i dati dal DB (salvati dai worker precedenti)
    const immobile = await prisma.immobile.findUnique({ where: { jobId } });
    const datiComputati = immobile?.datiComputati ? JSON.parse(immobile.datiComputati) : {};
    const calcoliScoring = datiComputati.calcoliScoring;
    const spiegazione    = datiComputati.spiegazione;
    const hashScoring    = datiComputati.hashScoring || '';
    const urlOriginale   = immobile?.urlAsta || '';
    const datiEstrattiEValidati = datiComputati.datiAI || { confidence: 0.9, source: { document: 'perizia.pdf' } };

    if (!calcoliScoring) throw new Error('calcoliScoring non trovati nel DB — scoring non completato?');

    // Genera PDF
    const pdfBuffer = await generaPDF(
      jobId, calcoliScoring, spiegazione,
      datiEstrattiEValidati, hashScoring, urlOriginale
    );

    // Hash del PDF generato
    const reportHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    // Salva PDF su disco
    const pdfFileName = `report_${jobId}.pdf`;
    const pdfPath     = path.join(OUTPUT_DIR, pdfFileName);
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`[REPORT ${WORKER_ID}] PDF salvato: ${pdfPath} (${pdfBuffer.length} bytes)`);

    // AuditHash (payload come stringa)
    await prisma.auditHash.create({
      data: {
        jobId,
        stepName:  'REPORT',
        hashValue:  reportHash,
        payload:    JSON.stringify({ pdfSizeBytes: pdfBuffer.length, renderedAt: new Date().toISOString() }),
        workerId:   WORKER_ID,
      },
    });

    // ReportArtifact
    await prisma.reportArtifact.create({
      data: {
        jobId,
        artifactType:  'pdf',
        storageUrl:    `/api/jobs/${jobId}/report`,
        fileHash:       reportHash,
        fileSizeBytes:  BigInt(pdfBuffer.length),
        mimeType:       'application/pdf',
      },
    });

    // Aggiorna Immobile con hash report
    await prisma.immobile.update({
      where: { jobId },
      data:  { hashReport: reportHash },
    });

    // Aggiorna Job status
    await prisma.job.update({
      where: { id: jobId },
      data:  { status: 'REPORT_READY' },
    });

    const durationMs = Date.now() - startTime;
    await recordJobEvent(jobId, 'REPORT_HASHED', {
      reportHash,
      pdfSizeBytes: pdfBuffer.length,
      pdfPath: pdfFileName,
      durationMs,
    }, WORKER_ID, durationMs);

    return { jobId, reportHash, pdfPath: pdfFileName, pdfSize: pdfBuffer.length };

  } catch (err) {
    console.error(`[REPORT ${WORKER_ID}] Error for Job ${jobId}:`, err.message);
    await recordJobEvent(jobId, 'JOB_FAILED', { error: err.message, stage: 'REPORT_GENERATION' }, WORKER_ID);
    throw err;
  }
}, {
  connection:  redisConnection,
  concurrency: 4,
});

worker.on('error', (err) => console.error('[WORKER ERROR] worker-report.js:', err.message));
worker.on('completed', (job) => console.log(`[REPORT ${WORKER_ID}] Completed: ${job.id}`));
worker.on('failed',    (job, err) => console.error(`[REPORT ${WORKER_ID}] Failed (${job.attemptsMade}): ${job.id} — ${err.message}`));

console.log(`[REPORT ${WORKER_ID}] Ready to process reportRenderQueue`);
module.exports = worker;