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
  const allegati = trovaAllegatiPdf($, url);
  $('script, style, nav, footer, header, aside').remove();
  const testoGrezzo = $('body').text().replace(/\s+/g, ' ').trim();
  const title = $('title').text().trim();
  return { testoGrezzo, title, httpStatus: resp.status, isPdf: false, allegati };
}


// ============================================================================
// ALLEGATI PDF DELLA PAGINA ANNUNCIO (aste e annunci immobiliari)
// ============================================================================
// Le pagine d'asta (IVG, astegiudiziarie, PVP) espongono il testo dell'annuncio
// e collegano la perizia come PDF. Senza scaricarla il motore lavorava sul solo
// annuncio e produceva un giudizio senza documenti tecnici.

const MAX_ALLEGATI = 6;
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_TESTO_ALLEGATI = 200000;

const ESCLUSI_ALLEGATI = /manuale|privacy|trattamento dati|autodichiarazione|presa visione|modulo|informativa|istruzioni|cookie|condizioni generali|termini e condizioni|regolamento del sito|listino servizi/i;

function classificaAllegato(testo, href) {
  // Il testo del link decide; l'indirizzo serve solo se il link non ha testo
  // (molti portali usano il percorso /allegato/ per qualsiasi documento).
  const t = (testo && testo.trim() ? testo : href).toLowerCase();
  if (ESCLUSI_ALLEGATI.test(t)) return null;
  if (/allegato\s*[a-z]?\b.*perizia/.test(t)) return 'ALLEGATO_PERIZIA';
  if (/perizia|stima|relazione|ctu|elaborato peritale/.test(t)) return 'PERIZIA';
  if (/avviso/.test(t)) return 'AVVISO';
  if (/ordinanza/.test(t)) return 'ORDINANZA';
  if (/planimetri/.test(t)) return 'PLANIMETRIA';
  // Documenti tipici delle compravendite e degli annunci privati (07/11/2026):
  // l'analisi non riguarda solo le aste giudiziarie.
  if (/\bape\b|attestato.*prestazione|certificazione energetica|classe energetica/.test(t)) return 'APE';
  if (/visura|catast/.test(t)) return 'VISURA';
  if (/capitolato|computo|preventivo lavori/.test(t)) return 'CAPITOLATO';
  if (/scheda tecnica|scheda immobile|dossier|brochure|valutazione|analisi|conformit|agibilit|abitabilit|condominio|regolamento condominiale/.test(t)) return 'DOCUMENTO_TECNICO';
  return 'ALTRO';
}

const PRIORITA_ALLEGATI = { PERIZIA: 1, ALLEGATO_PERIZIA: 2, AVVISO: 3, ORDINANZA: 4, PLANIMETRIA: 5, APE: 6, VISURA: 7, DOCUMENTO_TECNICO: 8, CAPITOLATO: 9, ALTRO: 10 };

function trovaAllegatiPdf($, baseUrl) {
  const visti = new Set();
  const allegati = [];
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    const testo = ($(el).text() || $(el).attr('title') || '').replace(/\s+/g, ' ').trim();
    let assoluto;
    try { assoluto = new URL(href, baseUrl).toString(); } catch { return; }
    const sembraPdf = /\.pdf(\?|#|$)/i.test(assoluto) || /\/allegato\//i.test(assoluto);
    if (!sembraPdf || visti.has(assoluto)) return;
    const tipo = classificaAllegato(testo, assoluto);
    // I PDF non riconosciuti entrano comunque, con priorita' piu' bassa:
    // su un annuncio privato anche un PDF senza etichetta chiara puo' contenere dati utili.
    if (!tipo) return;
    visti.add(assoluto);
    allegati.push({ tipo, url: assoluto, etichetta: testo.slice(0, 120) });
  });
  allegati.sort((a, b) => PRIORITA_ALLEGATI[a.tipo] - PRIORITA_ALLEGATI[b.tipo]);
  return allegati.slice(0, MAX_ALLEGATI);
}

async function scaricaTestoPdf(url) {
  const safeUrl = validatePublicHttpUrl(url);
  const resp = await axios.get(safeUrl, {
    headers: { ...HTTP_HEADERS, Accept: 'application/pdf,*/*' },
    responseType: 'arraybuffer',
    timeout: 30000,
    maxRedirects: 5,
    maxContentLength: MAX_PDF_BYTES,
    httpAgent: safeHttpAgent,
    httpsAgent: safeHttpsAgent,
  });
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(Buffer.from(resp.data));
  return { testo: data.text.replace(/\s+/g, ' ').trim(), pagine: data.numpages, bytes: resp.data.byteLength };
}

async function leggiAllegati(allegati) {
  const documenti = [];
  const blocchi = [];
  let totale = 0;
  for (const allegato of allegati) {
    const voce = { tipo: allegato.tipo, url: allegato.url, etichetta: allegato.etichetta };
    try {
      const { testo, pagine, bytes } = await scaricaTestoPdf(allegato.url);
      voce.pagine = pagine;
      voce.bytes = bytes;
      voce.caratteri = testo.length;
      voce.esito = testo.length >= 300 ? 'LETTO' : 'TESTO_ASSENTE';
      if (voce.esito === 'LETTO' && totale < MAX_TESTO_ALLEGATI) {
        const quota = testo.slice(0, MAX_TESTO_ALLEGATI - totale);
        totale += quota.length;
        blocchi.push(`=== DOCUMENTO: ${allegato.tipo} (${pagine} pagine) — ${allegato.url} ===\n${quota}`);
      }
    } catch (err) {
      voce.esito = 'ERRORE';
      voce.errore = err.message;
    }
    documenti.push(voce);
  }
  return { documenti, testoAllegati: blocchi.join('\n\n') };
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
    // Documenti caricati dal cliente nell'app (07/11/2026): entrano nell'analisi.
    // Con il segnaposto documenti:// la richiesta e' fatta solo di documenti.
    const soloDocumenti = String(url).startsWith('documenti://');
    const immobilePre = await prisma.immobile.findUnique({ where: { jobId } });
    const datiPre = (() => { try { return JSON.parse(immobilePre?.datiComputati || '{}'); } catch { return {}; } })();
    const caricati = Array.isArray(datiPre.documentiCaricati) ? datiPre.documentiCaricati : [];

    const safeUrl = soloDocumenti ? url : validatePublicHttpUrl(url);
    await recordJobEvent(jobId, 'SCRAPE_STARTED', { url: safeUrl, documentiCaricati: caricati.length }, WORKER_ID);

    let testoGrezzo = '';
    let metadata = { title: '', url: safeUrl, timestamp: new Date().toISOString() };
    let scraperUsed = soloDocumenti ? 'documenti-caricati' : 'axios';

    if (!soloDocumenti) {

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
        // Un PDF caricato direttamente è il documento tecnico fornito dal cliente.
        metadata.documenti = [{
          tipo: 'PERIZIA', url: safeUrl, pagine: result.numPages, caratteri: testoGrezzo.length,
          esito: testoGrezzo.length >= 300 ? 'LETTO' : 'TESTO_ASSENTE',
        }];
        console.log(`[SCRAPER ${WORKER_ID}] PDF estratto: ${result.numPages} pagine, ${testoGrezzo.length} caratteri`);
      } else {
        const allegati = result.allegati || [];
        const { documenti, testoAllegati } = await leggiAllegati(allegati);
        metadata.documenti = documenti;
        if (testoAllegati) {
          testoGrezzo = `=== PAGINA ANNUNCIO — ${safeUrl} ===\n${testoGrezzo}\n\n${testoAllegati}`;
          scraperUsed = 'axios+pdf-allegati';
        }
        console.log(`[SCRAPER ${WORKER_ID}] Allegati trovati ${allegati.length}, letti ${documenti.filter((d) => d.esito === 'LETTO').length}: ${documenti.map((d) => `${d.tipo}=${d.esito}`).join(', ') || 'nessuno'}`);
      }
      metadata.periziaLetta = (metadata.documenti || []).some((d) => d.tipo === 'PERIZIA' && d.esito === 'LETTO');
    } catch (axiosErr) {
      // Il fallback browser e intenzionalmente escluso: consentirebbe a redirect o
      // JavaScript della pagina di raggiungere servizi privati della piattaforma.
      throw new Error(`Scraping fallito: ${axiosErr.message}`);
    }
    }

    if (caricati.length) {
      const blocchi = caricati
        .filter((d) => d.testo)
        .map((d) => `=== DOCUMENTO CARICATO DAL CLIENTE: ${d.nome}${d.pagine ? ` (${d.pagine} pagine)` : ''} ===\n${d.testo}`);
      if (blocchi.length) {
        testoGrezzo = testoGrezzo
          ? `${testoGrezzo}\n\n${blocchi.join('\n\n')}`
          : blocchi.join('\n\n');
        if (!soloDocumenti) scraperUsed += '+documenti-caricati';
      }
      metadata.documenti = [
        ...(metadata.documenti || []),
        ...caricati.map(({ nome, categoria, pagine, caratteri, esito }) => ({
          tipo: 'CARICATO', url: nome, categoria, pagine, caratteri, esito,
        })),
      ];
      metadata.periziaLetta = metadata.periziaLetta || caricati.some((d) => d.esito === 'LETTO');
      console.log(`[SCRAPER ${WORKER_ID}] Documenti caricati dal cliente: ${caricati.length}, letti ${caricati.filter((d) => d.esito === 'LETTO').length}`);
    }
    if (soloDocumenti && !testoGrezzo) {
      // Solo foto o PDF scansionati: nessun testo automatico. Il flusso prosegue e
      // il controllo di confidenza porta il caso alla revisione di Simone, che ha
      // gia' ricevuto gli originali su Telegram.
      testoGrezzo = `Documenti caricati dal cliente senza testo leggibile automaticamente: ${caricati.map((d) => d.nome).join(', ')}.`;
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
      periziaLetta: metadata.periziaLetta,
      documenti: (metadata.documenti || []).map(({ tipo, url, pagine, caratteri, esito, errore }) => ({ tipo, url, pagine, caratteri, esito, errore })),
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
module.exports.trovaAllegatiPdf = trovaAllegatiPdf;
module.exports.classificaAllegato = classificaAllegato;
