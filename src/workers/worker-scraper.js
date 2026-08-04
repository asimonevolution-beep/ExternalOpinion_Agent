/**
 * EXTERNAL OPINION — WORKER SCRAPER V18.4
 * Direzione Tecnica: Geometra Simone Azzali
 *
 * Strategia:
 * 1. Se URL è PDF → pdf-parse (testo completo perizia, confidence 0.85+)
 * 2. HTML primario: axios/cheerio (no Chrome richiesto)
 * 3. HTML fallback: Puppeteer (se disponibile)
 */

const { Worker } = require('bullmq');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const prisma = require('../../db');
const { recordJobEvent } = require('../../orchestrator');

const WORKER_ID = `scraper-${crypto.randomBytes(4).toString('hex')}`;

const { getSharedRedis } = require('../../redis-connection');
const redisConnection = getSharedRedis();

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5',
};

function isPrivateAddress(address) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, '');
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (net.isIP(normalized) !== 4) return false;
  const [a, b] = normalized.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || a >= 224;
}

function validatePublicHttpUrl(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw new Error('URL asta non valido'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Sono ammessi solo URL http/https');
  if (parsed.username || parsed.password) throw new Error('URL con credenziali non ammesso');
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || isPrivateAddress(hostname)) {
    throw new Error('URL verso rete locale o riservata non ammesso');
  }
  return parsed.toString();
}

function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
      return callback(new Error('Destinazione di rete privata non ammessa'));
    }
    if (options?.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
}

const safeHttpAgent = new http.Agent({ lookup: safeLookup });
const safeHttpsAgent = new https.Agent({ lookup: safeLookup });

function isPdfUrl(url, contentType) {
  if (contentType && contentType.includes('application/pdf')) return true;
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith('.pdf');
  } catch { return false; }
}

async function scrapeWithPdf(url) {
  const pdfParse = require('pdf-parse');
  const resp = await axios.get(url, {
    headers: { ...HTTP_HEADERS, Accept: 'application/pdf,*/*' },
    responseType: 'arraybuffer',
    timeout: 30000,
    maxRedirects: 5,
  });
  const data = await pdfParse(Buffer.from(resp.data));
  const testoGrezzo = data.text.replace(/\s+/g, ' ').trim();
  const numPages = data.numpages;
  return { testoGrezzo, title: `Perizia PDF (${numPages} pagine)`, numPages, httpStatus: resp.status };
}

async function scrapeWithAxios(url) {
  const resp = await axios.get(url, {
    headers: HTTP_HEADERS,
    timeout: 20000,
    maxRedirects: 5,
    validateStatus: () => true,
    responseType: 'arraybuffer',
    httpAgent: safeHttpAgent,
    httpsAgent: safeHttpsAgent,
  });
  const contentType = resp.headers['content-type'] || '';
  if (isPdfUrl(url, contentType)) {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(Buffer.from(resp.data));
    const testoGrezzo = data.text.replace(/\s+/g, ' ').trim();
    return { testoGrezzo, title: `Perizia PDF (${data.numpages} pagine)`, numPages: data.numpages, httpStatus: resp.status, isPdf: true };
  }
  const html = Buffer.from(resp.data).toString('utf-8');
  const $ = cheerio.load(html || '');
  $('script, style, nav, footer, header, aside').remove();
  const testoGrezzo = $('body').text().replace(/\s+/g, ' ').trim();
  const title = $('title').text().trim();
  return { testoGrezzo, title, httpStatus: resp.status, isPdf: false };
}

const worker = new Worker('scrapeQueue', async (job) => {
  const { jobId, url } = job.data;
  const startTime = Date.now();

  try {
    console.log(`[SCRAPER ${WORKER_ID}] Processing Job: ${jobId}`);
    // Diagnostica esplicita: un url assente significa che il produttore della coda
    // (DAG o watchdog) non l'ha passato in job.data — non un url malformato.
    if (!url) {
      throw new Error(`url assente in job.data (chiavi presenti: ${Object.keys(job.data || {}).join(', ') || 'nessuna'})`);
    }
    const safeUrl = validatePublicHttpUrl(url);
    await recordJobEvent(jobId, 'SCRAPE_STARTED', { url: safeUrl }, WORKER_ID);

    let testoGrezzo = '';
    let metadata = { title: '', url: safeUrl, timestamp: new Date().toISOString() };
    let scraperUsed = 'axios';

    // Rilevamento PDF da URL prima di fare la richiesta
    const looksLikePdf = isPdfUrl(safeUrl, null);
    if (looksLikePdf) {
      console.log(`[SCRAPER ${WORKER_ID}] URL PDF rilevato — estrazione testo con pdf-parse`);
    }

    // Primario: axios (con rilevamento PDF interno)
    try {
      const result = await scrapeWithAxios(safeUrl);
      testoGrezzo = result.testoGrezzo;
      metadata.title = result.title;
      metadata.httpStatus = result.httpStatus;
      if (result.isPdf || looksLikePdf) {
        scraperUsed = 'pdf-parse';
        metadata.numPages = result.numPages;
        console.log(`[SCRAPER ${WORKER_ID}] PDF estratto: ${result.numPages} pagine, ${testoGrezzo.length} caratteri`);
      }
    } catch (axiosErr) {
      // Il fallback browser e intenzionalmente escluso: consentirebbe a redirect o
      // JavaScript della pagina di raggiungere servizi privati della piattaforma.
      throw new Error(`Scraping fallito: ${axiosErr.message}`);
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
      urlProcessed: safeUrl,
      textLength: testoGrezzo.length,
      scraperUsed,
      textHash,
    }, WORKER_ID, durationMs);

    return { jobId, urlOriginale: safeUrl, testoGrezzo, metadata, screenshotHash: textHash };
  } catch (err) {
    console.error(`[SCRAPER ${WORKER_ID}] Error for Job ${jobId}:`, err.message);
    await recordJobEvent(jobId, 'JOB_FAILED', { error: err.message, stage: 'SCRAPE' }, WORKER_ID);
    throw err;
  }
}, {
  connection: redisConnection,
  concurrency: 2,
});

worker.on('error', (err) => console.error('[WORKER ERROR] worker-scraper.js:', err.message));
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
