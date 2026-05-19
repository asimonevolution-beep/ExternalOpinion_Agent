/**
 * EXTERNAL OPINION — WORKER SCRAPER V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 * 
 * Responsabilità:
 * - Puppeteer/Playwright scraping
 * - PDF download
 * - Document retrieval
 * - Memory capped
 * - Rate limited
 */

const { Worker } = require('bullmq');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const prisma = require('./db');
const { recordJobEvent } = require('./orchestrator');

const WORKER_ID = `scraper-${crypto.randomBytes(4).toString('hex')}`;

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const worker = new Worker('scrapeQueue', async (job) => {
  const { jobId, url } = job.data;
  const startTime = Date.now();

  try {
    console.log(`[SCRAPER ${WORKER_ID}] Processing Job: ${jobId}`);
    
    await recordJobEvent(jobId, 'SCRAPE_STARTED', { url }, WORKER_ID);

    // ===== SCRAPING LOGIC =====
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Timeout per pagina
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(15000);

    // Navigate
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Estrai testo
    const testoGrezzo = await page.evaluate(() => document.body.innerText);

    // Estrai metadati
    const metadata = await page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    }));

    // Screenshot per audit
    const screenshotBuffer = await page.screenshot({ type: 'png' });
    const screenshotHash = crypto
      .createHash('sha256')
      .update(screenshotBuffer)
      .digest('hex');

    await browser.close();

    const durationMs = Date.now() - startTime;

    await recordJobEvent(
      jobId,
      'SCRAPE_COMPLETED',
      {
        urlProcessed: url,
        textLength: testoGrezzo.length,
        screenshotHash,
      },
      WORKER_ID,
      durationMs
    );

    // Restituisci al next worker
    return {
      jobId,
      urlOriginale: url,
      testoGrezzo,
      metadata,
      screenshotHash,
    };
  } catch (err) {
    console.error(`[SCRAPER ${WORKER_ID}] Error for Job ${jobId}:`, err.message);

    await recordJobEvent(
      jobId,
      'JOB_FAILED',
      { error: err.message, stage: 'SCRAPE' },
      WORKER_ID
    );

    throw err;
  }
}, {
  connection: redisConnection,
  concurrency: 2, // Memory-capped
});

worker.on('completed', (job) => {
  console.log(`[SCRAPER ${WORKER_ID}] ✓ Completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(
    `[SCRAPER ${WORKER_ID}] ✗ Failed (attempt ${job.attemptsMade}): ${job.id}`,
    err.message
  );
});

console.log(`[SCRAPER ${WORKER_ID}] Ready to process scrapeQueue`);

module.exports = worker;
