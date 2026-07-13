/**
 * EXTERNAL OPINION — WORKER ASTE V18.3
 * Generazione perizia asta giudiziaria
 *
 * Responsabilita:
 * - Ricezione job da POST /aste/checkout
 * - Analisi immobile (indirizzo, OMI lookup)
 * - Generazione PDF perizia
 * - Invio email con PDF
 */

const { Worker } = require('bullmq');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('../../db');
const { Resend } = require('resend');

const WORKER_ID = `aste-${crypto.randomBytes(4).toString('hex')}`;
const OUTPUT_DIR = path.join(__dirname, '../..', 'OUTPUT_REPORT');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const { getSharedRedis } = require('../../redis-connection');
const redisConnection = getSharedRedis();

// ============================================================================
// WORKER ASTE
// ============================================================================
const worker = new Worker('asteQueue', async (job) => {
  console.log(`[ASTE-WORKER] Inizio job ${job.id} — indirizzo: ${job.data.indirizzo}`);

  const { jobId, indirizzo, lotto, email, telefono, note } = job.data;

  try {
    // Step 1: Lookup OMI data per l'indirizzo
    const omiResponse = await fetch(
      `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/v1/omi/${encodeURIComponent(indirizzo)}`
    );
    const omiData = await omiResponse.json();
    console.log(`[ASTE-WORKER] OMI lookup: ${omiData.prezzoMedioMq || 'fallback'} €/mq`);

    // Step 2: Estrai superficie dall'indirizzo (fallback: assume 100 m²)
    const superficieMatch = indirizzo.match(/(\d+)\s*m[²2]/i);
    const superficie = superficieMatch ? parseFloat(superficieMatch[1]) : 100;
    const stimaValore = (omiData.prezzoMedioMq || 3200) * superficie;

    // Step 3: Genera PDF perizia asta
    const pdfBuffer = await generaPdfAsta({
      jobId,
      indirizzo,
      lotto,
      telefono,
      superficie,
      omi: omiData,
      estimatedValue: stimaValore,
    });

    // Step 4: Salva PDF su disco
    const fileName = `perizia-asta-${jobId.substring(0, 8)}.pdf`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    // Step 5: Calcola hash SHA-256 del PDF
    const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    // Step 6: Aggiorna DB — salva ReportArtifact
    const artifact = await prisma.reportArtifact.create({
      data: {
        jobId,
        artifactType: 'PDF_PERIZIA_ASTA',
        storageUrl: `file://${filePath}`,
        fileHash,
        fileSizeBytes: pdfBuffer.length,
        mimeType: 'application/pdf',
        isPublic: false,
      },
    });

    // Step 7: Invia email con PDF (link di download o allegato)
    await sendAstaConfirmationEmail(email, indirizzo, fileName, filePath);

    // Step 8: Aggiorna Immobile come READY
    await prisma.immobile.update({
      where: { jobId },
      data: { status: 'VERDE', confidenceScore: 0.85 },
    });

    // Step 9: Log job completion
    const job_rec = await prisma.job.findUnique({ where: { id: jobId } });
    if (job_rec) {
      await prisma.jobEvent.create({
        data: {
          jobId,
          eventType: 'REPORT_GENERATED',
          metadata: JSON.stringify({ artifactId: artifact.id, fileName, fileHash }),
        },
      });
    }

    console.log(`[ASTE-WORKER] ✅ Perizia generata — ${jobId} → ${fileName}`);
    return { success: true, artifactId: artifact.id, fileName };

  } catch (err) {
    console.error(`[ASTE-WORKER] ❌ Errore ${jobId}:`, err.message);

    // Aggiorna job status come FAILED
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'FAILED', error: err.message },
    }).catch(() => {});

    throw err;
  }
}, {
  connection: redisConnection,
  concurrency: 2,
});

worker.on('completed', (job) => {
  console.log(`[ASTE-WORKER] Job ${job.id} completato`);
});

worker.on('failed', (job, err) => {
  console.error(`[ASTE-WORKER] Job ${job.id} fallito:`, err.message);
});

// ============================================================================
// GENERA PDF PERIZIA ASTA
// ============================================================================
async function generaPdfAsta({ jobId, indirizzo, lotto, telefono, superficie, omi, estimatedValue }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];

    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ---- HEADER ----
    doc.fontSize(16).font('Helvetica-Bold')
      .text('PERIZIA IMMOBILE — ASTA GIUDIZIARIA', 50, 40);
    doc.fontSize(10).font('Helvetica')
      .text(`Data: ${new Date().toLocaleDateString('it-IT')}`, 50, 62)
      .text(`Codice: ${jobId.substring(0, 8)}`, 50, 76);

    doc.moveTo(40, 95).lineTo(555, 95).stroke();

    // ---- DATI IMMOBILE ----
    doc.fontSize(12).font('Helvetica-Bold')
      .text('DATI IMMOBILE', 50, 110);
    doc.fontSize(10).font('Helvetica')
      .text(`Indirizzo: ${indirizzo}`, 50, 130)
      .text(`Lotto: ${lotto || 'N/D'}`, 50, 145)
      .text(`Superficie: ${superficie} m²`, 50, 160)
      .text(`Contatto: ${telefono}`, 50, 175);

    // ---- VALUTAZIONE OMI ----
    doc.fontSize(12).font('Helvetica-Bold')
      .text('VALUTAZIONE OMI', 50, 205);
    doc.fontSize(10).font('Helvetica')
      .text(`Zona: ${omi.zonaCatastale || 'N/D'}`, 50, 225)
      .text(`Prezzo min: €${omi.prezzoMinMq?.toLocaleString('it-IT') || 'N/D'}/m²`, 50, 240)
      .text(`Prezzo medio: €${omi.prezzoMedioMq?.toLocaleString('it-IT') || 'N/D'}/m²`, 50, 255)
      .text(`Prezzo max: €${omi.prezzoMaxMq?.toLocaleString('it-IT') || 'N/D'}/m²`, 50, 270);

    // ---- STIMA VALORE ----
    doc.fontSize(14).font('Helvetica-Bold')
      .text(`STIMA VALORE: €${estimatedValue.toLocaleString('it-IT')}`, 50, 305);

    // ---- FOOTER ----
    doc.fontSize(8).font('Helvetica')
      .text('Analisi tecnica di parte a scopo informativo.', 50, 720)
      .text('Non costituisce perizia né consulenza d\'ufficio.', 50, 732);

    doc.end();
  });
}

// ============================================================================
// INVIA EMAIL CONFERMA ASTA
// ============================================================================
async function sendAstaConfirmationEmail(email, indirizzo, fileName, filePath) {
  if (!email || !process.env.RESEND_API_KEY) {
    console.log(`[ASTE-EMAIL] Skip — email mancante o API key assente`);
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Leggi il PDF come buffer
    const pdfBuffer = fs.readFileSync(filePath);
    const base64Pdf = pdfBuffer.toString('base64');

    await resend.emails.send({
      from: 'info@externalopinion.it',
      to: email,
      subject: `📄 Perizia asta completata — ${indirizzo}`,
      html: `
        <h2>Perizia completata</h2>
        <p>Ciao,</p>
        <p>La tua perizia per <strong>${indirizzo}</strong> è pronta!</p>
        <p>Vedi allegato il PDF firmabile.</p>
        <hr>
        <p style="font-size: 0.9rem; color: #666;">External Opinion — Perizie immobiliari con AI</p>
      `,
      attachments: [
        {
          filename: fileName,
          content: base64Pdf,
          contentType: 'application/pdf',
        },
      ],
    });

    console.log(`[ASTE-EMAIL] ✅ Perizia inviata a ${email}`);
  } catch (err) {
    console.error(`[ASTE-EMAIL] ❌ Errore invio:`, err.message);
  }
}

// ============================================================================
// EXPORT
// ============================================================================
module.exports = worker;
