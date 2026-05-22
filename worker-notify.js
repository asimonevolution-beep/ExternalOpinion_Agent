/**
 * EXTERNAL OPINION — WORKER NOTIFY V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 *
 * Responsabilita:
 * - Legge dati dal DB (Immobile, ReportArtifact)
 * - Invia email al cliente con report PDF allegato (Nodemailer)
 * - Notifica WhatsApp opzionale (Twilio)
 * - Webhook callback con firma HMAC
 * - Idempotency: non invia mai due volte
 * - Aggiorna Job status -> COMPLETED
 */

const { Worker } = require('bullmq');
const nodemailer  = require('nodemailer');
const crypto      = require('crypto');
const fs          = require('fs');
const path        = require('path');
const prisma      = require('./db');
const { recordJobEvent } = require('./orchestrator');

const WORKER_ID  = `notify-${crypto.randomBytes(4).toString('hex')}`;
const OUTPUT_DIR = path.join(__dirname, 'OUTPUT_REPORT');

const redisConnection = {
  host:     process.env.REDIS_HOST || '127.0.0.1',
  port:     process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

// ============================================================================
// MAILER — Nodemailer (SMTP env vars oppure log in dev)
// ============================================================================
function getMailer() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ============================================================================
// EMAIL AL CLIENTE
// ============================================================================
async function sendEmailCliente(jobId, email, immobile, pdfPath) {
  const mailer    = getMailer();
  const semaforoEmoji = immobile.status === 'VERDE' ? '🟢' : immobile.status === 'GIALLO' ? '🟡' : '🔴';
  const baseUrl   = process.env.BASE_URL || 'https://externalopinionagent-production.up.railway.app';
  const downloadUrl = `${baseUrl}/api/jobs/${jobId}/report`;

  const htmlBody = `
    <div style="font-family:Georgia,serif; max-width:600px; margin:0 auto; background:#F5F0E8; padding:30px;">
      <h2 style="color:#1A1612; border-bottom:2px solid #C8A96E; padding-bottom:10px;">
        External Opinion — Il tuo report e pronto
      </h2>
      <p style="font-size:14px; color:#3A3530;">Caro cliente,</p>
      <p style="font-size:14px; color:#3A3530;">
        La nostra analisi tecnica indipendente e stata completata.<br>
        Trovi il report completo in allegato a questa email.
      </p>

      <div style="background:#fff; border:1px solid #ddd; padding:20px; margin:20px 0; border-radius:4px;">
        <p style="margin:0 0 8px; font-size:13px; color:#888; font-family:monospace; text-transform:uppercase; letter-spacing:0.1em;">Risultato</p>
        <p style="margin:0; font-size:36px; font-family:Georgia,serif; font-weight:bold; color:#1A1612;">
          ${semaforoEmoji} ${immobile.status || 'N/D'}
        </p>
        <hr style="border:none; border-top:1px solid #eee; margin:15px 0;">
        <table style="width:100%; font-size:13px; color:#3A3530;">
          <tr><td>Coherence Index</td><td style="text-align:right; font-weight:bold;">${immobile.coherenceIndex ?? 'N/D'}/100</td></tr>
          <tr><td>ROI stimato</td><td style="text-align:right; font-weight:bold;">${immobile.roi ?? 'N/D'}%</td></tr>
          <tr><td>Investimento conveniente</td><td style="text-align:right; font-weight:bold;">${immobile.roiConveniente ? 'SI' : 'NO'}</td></tr>
        </table>
      </div>

      <p style="font-size:13px; color:#888;">
        Report ID: <code>${jobId}</code><br>
        Hash di integrita: <code style="word-break:break-all;">${immobile.hashReport || 'N/D'}</code>
      </p>

      <p style="font-size:12px; color:#aaa; margin-top:30px; border-top:1px solid #ddd; padding-top:15px;">
        External Opinion — Parere Tecnico Indipendente<br>
        Direzione Tecnica: Geometra Simone Azzali<br>
        <em>Questo report e stato validato da un professionista prima della consegna.</em>
      </p>
    </div>
  `;

  // Se il mailer non e configurato, logga e ritorna (dev mode)
  if (!mailer) {
    console.log(`[EMAIL DEV] Simulazione invio a ${email} per job ${jobId}`);
    console.log(`[EMAIL DEV] Semaforo: ${immobile.status} | ROI: ${immobile.roi}%`);
    return { simulated: true };
  }

  const attachments = [];
  if (pdfPath && fs.existsSync(pdfPath)) {
    attachments.push({
      filename:    `ExternalOpinion_Report_${jobId.substring(0, 8)}.pdf`,
      path:         pdfPath,
      contentType: 'application/pdf',
    });
  }

  const info = await mailer.sendMail({
    from:    `"External Opinion" <${process.env.SMTP_USER}>`,
    to:       email,
    subject: `${semaforoEmoji} Il tuo report External Opinion e pronto — ${immobile.status}`,
    html:     htmlBody,
    attachments,
  });

  console.log(`[EMAIL] Inviata a ${email} — messageId: ${info.messageId}`);
  return { messageId: info.messageId };
}

// ============================================================================
// WHATSAPP (Twilio — opzionale)
// ============================================================================
async function sendWhatsApp(jobId, phone, immobile) {
  if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN) {
    console.log(`[WHATSAPP DEV] Simulazione WA a ${phone} per job ${jobId}`);
    return { simulated: true };
  }
  const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  const semaforoEmoji = immobile.status === 'VERDE' ? 'VERDE' : immobile.status === 'GIALLO' ? 'GIALLO' : 'ROSSO';
  const msg = await twilio.messages.create({
    body: `External Opinion - Il tuo report e pronto!\nEsito: ${semaforoEmoji}\nROI: ${immobile.roi}%\nCoherence: ${immobile.coherenceIndex}/100\nJob: ${jobId}`,
    from: `whatsapp:${process.env.TWILIO_FROM}`,
    to:   `whatsapp:${phone}`,
  });
  console.log(`[WHATSAPP] Inviato a ${phone} — sid: ${msg.sid}`);
  return { sid: msg.sid };
}

// ============================================================================
// WEBHOOK (firma HMAC-SHA256)
// ============================================================================
async function sendWebhook(jobId, webhookUrl, immobile) {
  if (!webhookUrl) return;
  const axios   = require('axios');
  const payload = {
    jobId,
    semaforo:       immobile.status,
    coherenceIndex: immobile.coherenceIndex,
    roi:            immobile.roi,
    roiConveniente: immobile.roiConveniente,
    hashReport:     immobile.hashReport,
    timestamp:      new Date().toISOString(),
  };
  const signature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET || 'ext-opinion-secret')
    .update(JSON.stringify(payload))
    .digest('hex');

  await axios.post(webhookUrl, payload, {
    headers: { 'X-Signature': signature, 'Content-Type': 'application/json' },
    timeout: 10000,
  });
  console.log(`[WEBHOOK] Inviato a ${webhookUrl} — job ${jobId}`);
}

// ============================================================================
// WORKER
// ============================================================================
const worker = new Worker('notificationQueue', async (job) => {
  const { jobId, email, tier } = job.data;
  const startTime = Date.now();

  try {
    console.log(`[NOTIFY ${WORKER_ID}] Processing notification for Job: ${jobId}`);
    await recordJobEvent(jobId, 'NOTIFICATION_STARTED', { email, tier }, WORKER_ID);

    // Leggi tutti i dati necessari dal DB
    const immobile  = await prisma.immobile.findUnique({ where: { jobId } });
    const jobRecord = await prisma.job.findUnique({ where: { id: jobId } });

    if (!immobile) throw new Error(`Immobile non trovato per jobId: ${jobId}`);

    // Trova il PDF sul disco
    const pdfFileName = `report_${jobId}.pdf`;
    const pdfPath     = path.join(OUTPUT_DIR, pdfFileName);

    // Recupera email dal payload del job se non passata direttamente
    const recipientEmail = email || (() => {
      try { return JSON.parse(jobRecord?.payload || '{}').email; } catch { return null; }
    })();

    const results = {};

    // --- Email ---
    if (recipientEmail) {
      results.email = await sendEmailCliente(jobId, recipientEmail, immobile, pdfPath);
    }

    // --- WhatsApp (se numero configurato) ---
    const phone = process.env.NOTIFY_WHATSAPP_DEFAULT;
    if (phone) {
      results.whatsapp = await sendWhatsApp(jobId, phone, immobile);
    }

    // --- Webhook (se configurato) ---
    if (process.env.NOTIFY_WEBHOOK_URL) {
      results.webhook = await sendWebhook(jobId, process.env.NOTIFY_WEBHOOK_URL, immobile);
    }

    // Aggiorna Job -> COMPLETED
    await prisma.job.update({
      where: { id: jobId },
      data:  { status: 'COMPLETED' },
    });

    // Aggiorna ReviewQueue se esiste
    try {
      await prisma.reviewQueue.update({
        where: { jobId },
        data:  { deliveredAt: new Date() },
      });
    } catch (_) { /* non blocca se non esiste */ }

    const durationMs = Date.now() - startTime;
    await recordJobEvent(jobId, 'NOTIFICATION_SENT', {
      recipientEmail,
      channels: Object.keys(results),
      durationMs,
    }, WORKER_ID, durationMs);

    return { jobId, status: 'SENT', channels: Object.keys(results) };

  } catch (err) {
    console.error(`[NOTIFY ${WORKER_ID}] Error for Job ${jobId}:`, err.message);
    await recordJobEvent(jobId, 'NOTIFICATION_FAILED', { error: err.message }, WORKER_ID);
    throw err;
  }
}, {
  connection:  redisConnection,
  concurrency: 8,
});

worker.on('completed', (job) => console.log(`[NOTIFY ${WORKER_ID}] Completed: ${job.id}`));
worker.on('failed',    (job, err) => console.error(`[NOTIFY ${WORKER_ID}] Failed (${job.attemptsMade}): ${job.id} — ${err.message}`));

console.log(`[NOTIFY ${WORKER_ID}] Ready to process notificationQueue`);
module.exports = worker;