/**
 * EXTERNAL OPINION — WORKER SCRAPER V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 *
 * Strategia: axios/cheerio come primario (no Chrome richiesto),
 * Puppeteer come fallback opzionale se disponibile.
 */

const { Worker } = require('bullmq');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const prisma = require('./db');
const { recordJobEvent } = require('./orchestrator');

const WORKER_ID = `scraper-${crypto.randomBytes(4).toString('hex')}`;

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5',
};

async function scrapeWithAxios(url) {
  const resp = await axios.get(url, {
    headers: HTTP_HEADERS,
    timeout: 20000,
    maxRedirects: 5,
  });
  const $ = cheerio.load(resp.data);
  // Rimuove script, stili e tag non utili
  $('script, style, nav, footer, header, aside').remove();
  const testoGrezzo = $('body').text().replace(/\s+/g, ' ').trim();
  const title = $('title').text().trim();
  return { testoGrezzo, title };
}

const worker = new Worker('scrapeQueue', async (job) => {
  const { jobId, url } = job.data;
  const startTime = Date.now();

  try {
    console.log(`[SCRAPER ${WORKER_ID}] Processing Job: ${jobId}`);
    await recordJobEvent(jobId, 'SCRAPE_STARTED', { url }, WORKER_ID);

    let testoGrezzo = '';
    let metadata = { title: '', url, timestamp: new Date().toISOString() };
    let scraperUsed = 'axios';

    // Primario: axios/cheerio (sempre disponibile su Railway)
    try {
      const result = await scrapeWithAxios(url);
      testoGrezzo = result.testoGrezzo;
      metadata.title = result.title;
    } catch (axiosErr) {
      console.warn(`[SCRAPER ${WORKER_ID}] axios failed: ${axiosErr.message}, tentativo Puppeteer...`);

      // Fallback: Puppeteer (solo se disponibile)
      try {
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        const page = await browser.newPage();
        page.setDefaultTimeout(15000);
        page.setDefaultNavigationTimeout(15000);
        await page.goto(url, { waitUntil: 'networkidle2' });
        testoGrezzo = await page.evaluate(() => document.body.innerText);
        metadata.title = await page.title();
        await browser.close();
        scraperUsed = 'puppeteer';
      } catch (puppErr) {
        throw new Error(`Scraping fallito: axios(${axiosErr.message}) puppeteer(${puppErr.message})`);
      }
    }

    const textHash = crypto.createHash('sha256').update(testoGrezzo).digest('hex');
    const durationMs = Date.now() - startTime;

    // Salva nel DB: datiComputati è il bus di comunicazione tra worker
    const immobile = await prisma.immobile.findUnique({ where: { jobId } });
    const datiAttuali = immobile?.datiComputati ? JSON.parse(immobile.datiComputati) : {};
    await prisma.immobile.update({
      where: { jobId },
      data: {
        datiComputati: JSON.stringify({
          ...datiAttuali,
          testoGrezzo,
          metadata,
          scraperUsed,
          textHash,
        }),
      },
    });
    await prisma.job.update({ where: { id: jobId }, data: { status: 'SCRAPING_DONE' } });

    await recordJobEvent(jobId, 'SCRAPE_COMPLETED', {
      urlProcessed: url,
      textLength: testoGrezzo.length,
      scraperUsed,
      textHash,
    }, WORKER_ID, durationMs);

    return { jobId, urlOriginale: url, testoGrezzo, metadata, screenshotHash: textHash };
  } catch (err) {
    console.error(`[SCRAPER ${WORKER_ID}] Error for Job ${jobId}:`, err.message);
    await recordJobEvent(jobId, 'JOB_FAILED', { error: err.message, stage: 'SCRAPE' }, WORKER_ID);
    throw err;
  }
}, {
  connection: redisConnection,
  concurrency: 2,
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
