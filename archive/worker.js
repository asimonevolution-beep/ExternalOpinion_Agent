const { Worker, QueueScheduler, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const orchestrator = require('./orchestrator');
const db = require('./db');
const agentScraper = require('./agent_scraper');
const agentParser = require('./agent_parser');
const agentEstimator = require('./agent_estimator');
const twilio = require('twilio');

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const queueName = 'analysisQueue';
new QueueScheduler(queueName, { connection: redisConnection });
const queueEvents = new QueueEvents(queueName, { connection: redisConnection });
const twilioClient = process.env.TWILIO_SID && process.env.TWILIO_TOKEN ? twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN) : null;
const notifyNumber = process.env.TO_NUMBER;
const fromNumber = process.env.TWILIO_FROM;

async function sendWhatsAppNotification(message) {
  if (!twilioClient || !fromNumber || !notifyNumber) {
    console.log('[WORKER] WhatsApp non configurato, messaggio:', message);
    return;
  }

  try {
    await twilioClient.messages.create({
      body: message,
      from: fromNumber,
      to: notifyNumber,
    });
    console.log('[WORKER] WhatsApp inviato.');
  } catch (error) {
    console.error('[WORKER] Errore invio WhatsApp:', error.message);
  }
}

async function processJob(job) {
  const { jobId, payload } = job.data;
  const url = payload?.url;
  if (!jobId || !url) {
    throw new Error('Job payload incompleto: manca jobId o url.');
  }

  await orchestrator.updateJobStatus(jobId, 'PROCESSING');
  await orchestrator.logActivity('JOB_PROCESSING', { jobId, url });

  try {
    console.log(`[WORKER] Esecuzione job ${jobId} su ${url}`);
    const scrapeResult = await agentScraper.scrapeUrl(url);
    const parsedResult = await agentParser.parsePdfBuffer(scrapeResult.buffer);
    const estimation = await agentEstimator.estimate(parsedResult, parsedResult.technical.location || 'Modena');

    const resultPayload = {
      fileName: scrapeResult.fileName,
      url: scrapeResult.url,
      parsed: parsedResult,
      estimation,
    };

    await db.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        result: resultPayload,
        riskScore: estimation.riskScore,
        hiddenSavings: estimation.hiddenSavings?.avoidedCost || null,
        updatedAt: new Date(),
      },
    });

    await orchestrator.logActivity('JOB_COMPLETED', { jobId, url, riskScore: estimation.riskScore });

    await sendWhatsAppNotification(`✅ EXTERNAL OPINION: Job completato.\nJobId: ${jobId}\nURL: ${url}\nRischio: ${estimation.riskScore}/100\nHidden Savings: €${estimation.hiddenSavings?.avoidedCost?.toFixed(2) || 'N/D'}`);

    return resultPayload;
  } catch (error) {
    await db.job.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        error: { message: error.message, stack: error.stack },
        updatedAt: new Date(),
      },
    });
    await orchestrator.logActivity('JOB_FAILED', { jobId, url, error: error.message });
    console.error(`[WORKER] Job ${jobId} fallito:`, error);
    throw error;
  }
}

const worker = new Worker(
  queueName,
  async (job) => processJob(job),
  {
    connection: redisConnection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
    lockDuration: 600000,
    autorun: true,
  },
);

worker.on('completed', (job) => {
  console.log(`[WORKER] Job completato: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[WORKER] Job fallito: ${job?.id} -`, err?.message || err);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.warn(`[WORKER] Evento failed per job ${jobId}: ${failedReason}`);
});

queueEvents.on('completed', ({ jobId }) => {
  console.log(`[WORKER] Evento completed per job ${jobId}`);
});

console.log('[WORKER] Worker BullMQ in esecuzione, queue:', queueName);
