/**
 * EXTERNAL OPINION — REVIEW QUEUE
 *
 * Human-in-the-loop: dopo ogni analisi AI il report entra in coda revisione.
 * Simone Azzali riceve email, entra nel pannello admin, approva o modifica.
 * Solo dopo approvazione il report viene consegnato al cliente.
 */

const prisma = require('./db');
const nodemailer = require('nodemailer');

// ============================================================================
// EMAIL NOTIFICHE
// ============================================================================

function getMailer() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function notifyReviewer(jobId, reportSummary, auctionUrl) {
  const adminEmail = process.env.ADMIN_REVIEW_EMAIL || 'a.simonevolution@gmail.com';
  const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : 'https://externalopinionagent-production.up.railway.app';

  const reviewUrl = `${baseUrl}/admin/review/${jobId}`;

  console.log(`[REVIEW] Notifica revisore per job ${jobId} → ${reviewUrl}`);

  const mailer = getMailer();
  if (!mailer) {
    console.log(`[REVIEW] SMTP non configurato — notifica solo log`);
    console.log(`[REVIEW] ⚡ Nuovo report da revisionare: ${reviewUrl}`);
    return;
  }

  try {
    await mailer.sendMail({
      from: `"External Opinion AI" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: `📋 Nuovo report da revisionare — ${auctionUrl?.slice(0, 60)}`,
      html: `
        <div style="font-family:monospace; max-width:600px; margin:0 auto; padding:20px;">
          <h2 style="color:#1A1612;">External Opinion — Report in attesa di revisione</h2>
          <p><strong>Job ID:</strong> ${jobId}</p>
          <p><strong>URL Asta:</strong> <a href="${auctionUrl}">${auctionUrl}</a></p>
          <hr/>
          <h3>Anteprima AI:</h3>
          <pre style="background:#f5f5f5; padding:15px; font-size:12px; overflow:auto;">${reportSummary?.slice(0, 800) || 'Nessuna anteprima'}</pre>
          <hr/>
          <p>
            <a href="${reviewUrl}" style="
              display:inline-block; background:#1A1612; color:#fff;
              padding:12px 24px; text-decoration:none; font-weight:bold;
            ">Apri pannello revisione →</a>
          </p>
          <p style="color:#888; font-size:11px;">
            Il report NON viene consegnato al cliente finché non approvi.
          </p>
        </div>
      `,
    });
    console.log(`[REVIEW] Email inviata a ${adminEmail}`);
  } catch (err) {
    console.error(`[REVIEW] Errore invio email: ${err.message}`);
  }
}

// ============================================================================
// GESTIONE CODA
// ============================================================================

async function addToReviewQueue(jobId, aiReport, auctionUrl) {
  try {
    const existing = await prisma.reviewQueue.findUnique({ where: { jobId } });
    if (existing) return existing;

    const entry = await prisma.reviewQueue.create({
      data: {
        jobId,
        aiReport: typeof aiReport === 'string' ? aiReport : JSON.stringify(aiReport),
        status: 'PENDING',
        notifiedAt: new Date(),
      },
    });

    await notifyReviewer(jobId, typeof aiReport === 'string' ? aiReport : JSON.stringify(aiReport, null, 2), auctionUrl);
    return entry;
  } catch (err) {
    console.error(`[REVIEW] Errore addToReviewQueue: ${err.message}`);
    throw err;
  }
}

async function approveReport(jobId, reviewerNotes = '') {
  const entry = await prisma.reviewQueue.update({
    where: { jobId },
    data: {
      status: 'APPROVED',
      reviewerNotes,
      reviewedAt: new Date(),
    },
  });

  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'READY_FOR_PAYMENT' },
  });

  console.log(`[REVIEW] Approvato: ${jobId}`);
  return entry;
}

async function rejectReport(jobId, reviewerNotes) {
  const entry = await prisma.reviewQueue.update({
    where: { jobId },
    data: {
      status: 'REJECTED',
      reviewerNotes,
      reviewedAt: new Date(),
    },
  });

  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'FAILED', error: `Rifiutato in revisione: ${reviewerNotes}` },
  });

  console.log(`[REVIEW] Rifiutato: ${jobId}`);
  return entry;
}

async function getPendingReviews() {
  return prisma.reviewQueue.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });
}

async function getReviewByJobId(jobId) {
  return prisma.reviewQueue.findUnique({ where: { jobId } });
}

async function markDelivered(jobId) {
  return prisma.reviewQueue.update({
    where: { jobId },
    data: { deliveredAt: new Date() },
  });
}

module.exports = {
  addToReviewQueue,
  approveReport,
  rejectReport,
  getPendingReviews,
  getReviewByJobId,
  markDelivered,
};
