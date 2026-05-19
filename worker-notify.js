/**
 * EXTERNAL OPINION — WORKER NOTIFY V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 * 
 * Responsabilità:
 * - Email notifications
 * - WhatsApp messages
 * - Webhook callbacks
 * - Status notifications
 */

const { Worker } = require('bullmq');
const crypto = require('crypto');
const prisma = require('./db');
const { recordJobEvent } = require('./orchestrator');

const WORKER_ID = `notify-${crypto.randomBytes(4).toString('hex')}`;

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const worker = new Worker('notificationQueue', async (job) => {
  const { jobId, notificationType, recipient, reportHash, calcoliScoring } =
    job.data;
  const startTime = Date.now();

  try {
    console.log(
      `[NOTIFY ${WORKER_ID}] Processing notification for Job: ${jobId}`
    );

    await recordJobEvent(
      jobId,
      'NOTIFICATION_STARTED',
      { type: notificationType, recipient },
      WORKER_ID
    );

    // ===== SEND NOTIFICATIONS =====
    if (notificationType === 'email') {
      await sendEmailNotification(jobId, recipient, reportHash, calcoliScoring);
    } else if (notificationType === 'whatsapp') {
      await sendWhatsAppNotification(jobId, recipient, reportHash, calcoliScoring);
    } else if (notificationType === 'webhook') {
      await sendWebhookNotification(jobId, recipient, reportHash, calcoliScoring);
    }

    const durationMs = Date.now() - startTime;

    await recordJobEvent(
      jobId,
      'NOTIFICATION_SENT',
      { type: notificationType },
      WORKER_ID,
      durationMs
    );

    return {
      jobId,
      notificationType,
      status: 'SENT',
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error(
      `[NOTIFY ${WORKER_ID}] Error notifying ${jobId}:`,
      err.message
    );

    await recordJobEvent(
      jobId,
      'NOTIFICATION_FAILED',
      { error: err.message, type: notificationType },
      WORKER_ID
    );

    throw err;
  }
}, {
  connection: redisConnection,
  concurrency: 8,
});

// ============================================================================
// NOTIFICATION HANDLERS
// ============================================================================

async function sendEmailNotification(jobId, email, reportHash, calcoliScoring) {
  // Placeholder: Integrare nodemailer o SendGrid
  console.log(
    `[EMAIL] Invio report a ${email} (Hash: ${reportHash.substring(0, 16)}...)`
  );

  // Esempio con nodemailer:
  // const transporter = nodemailer.createTransport(...);
  // await transporter.sendMail({
  //   to: email,
  //   subject: `Report ${jobId} - ${calcoliScoring.semaforo}`,
  //   html: `<p>Coherence Index: ${calcoliScoring.coherenceIndex}</p>...`
  // });
}

async function sendWhatsAppNotification(
  jobId,
  phone,
  reportHash,
  calcoliScoring
) {
  // Placeholder: Integrare Twilio
  console.log(
    `[WHATSAPP] Invio notifica a ${phone} (Job: ${jobId})`
  );

  // Esempio con Twilio:
  // const twilio = require('twilio');
  // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({
  //   body: `Report ${jobId}: ${calcoliScoring.semaforo}`,
  //   from: process.env.TWILIO_PHONE,
  //   to: phone
  // });
}

async function sendWebhookNotification(
  jobId,
  webhookUrl,
  reportHash,
  calcoliScoring
) {
  // Placeholder: Integrare webhook callback
  console.log(
    `[WEBHOOK] Invio callback a ${webhookUrl} (Job: ${jobId})`
  );

  // Esempio:
  // const axios = require('axios');
  // await axios.post(webhookUrl, {
  //   jobId,
  //   reportHash,
  //   coherenceIndex: calcoliScoring.coherenceIndex,
  //   roi: calcoliScoring.roi,
  //   semaforo: calcoliScoring.semaforo
  // }, {
  //   headers: { 'X-Signature': crypto.createHmac('sha256', process.env.WEBHOOK_SECRET).update(JSON.stringify({jobId})).digest('hex') }
  // });
}

worker.on('completed', (job) => {
  console.log(`[NOTIFY ${WORKER_ID}] ✓ Completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(
    `[NOTIFY ${WORKER_ID}] ✗ Failed (attempt ${job.attemptsMade}): ${job.id}`,
    err.message
  );
});

console.log(`[NOTIFY ${WORKER_ID}] Ready to process notificationQueue`);

module.exports = worker;
