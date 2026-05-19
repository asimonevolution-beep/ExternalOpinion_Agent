/**
 * EXTERNAL OPINION — PORTAL CRAWLER AUTONOMO
 *
 * Scansiona ogni notte i portali di aste giudiziarie italiani.
 * Usa axios + cheerio (leggero, nessun Chrome da scaricare).
 * Puppeteer disponibile solo come fallback opzionale.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const prisma = require('./db');

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
};

// ============================================================================
// PORTALI
// ============================================================================

const PORTALS = [
  {
    id: 'pvp_giustizia',
    name: 'PVP Giustizia',
    searchUrl: 'https://pvp.giustizia.it/pvp/it/ricerca_avanzata.page?tipoRicerca=IMMOBILI&categoria=IMMOBILE',
    type: 'official',
    rateLimit: 5000,
  },
  {
    id: 'astegiudiziarie',
    name: 'Aste Giudiziarie',
    searchUrl: 'https://www.astegiudiziarie.it/aste-giudiziarie/immobili',
    type: 'private',
    rateLimit: 3000,
  },
  {
    id: 'ivg_modena',
    name: 'IVG Modena',
    searchUrl: 'https://www.ivgmodena.it/inserzioni?categoria=Immobili',
    type: 'ivg',
    rateLimit: 3000,
  },
  {
    id: 'ivg_milano',
    name: 'IVG Milano',
    searchUrl: 'https://www.ivgmilano.it/inserzioni?categoria=Immobili',
    type: 'ivg',
    rateLimit: 3000,
  },
];

// ============================================================================
// SCRAPERS
// ============================================================================

async function scrapePortal(portal) {
  const auctions = [];
  try {
    const resp = await axios.get(portal.searchUrl, {
      headers: HTTP_HEADERS,
      timeout: 20000,
      maxRedirects: 5,
    });
    const $ = cheerio.load(resp.data);

    // Selettori generici per portali aste italiani
    const selectors = [
      '.annuncio', '.lotto', '.inserzione', '.listing-item',
      '.property-item', '.asta-item', 'article.item',
      '[class*="annuncio"]', '[class*="lotto"]', '[class*="inserzione"]',
    ];

    let items = [];
    for (const sel of selectors) {
      items = $(sel).toArray();
      if (items.length > 0) break;
    }

    items.forEach(el => {
      const $el = $(el);
      const link = $el.find('a').first();
      const href = link.attr('href');
      if (!href) return;

      const url = href.startsWith('http') ? href : `${new URL(portal.searchUrl).origin}${href}`;
      const title = $el.find('h1,h2,h3,h4,[class*="titol"]').first().text().trim();
      const priceText = $el.find('[class*="prezzo"],[class*="price"],[class*="importo"],[class*="base"]').first().text().trim();
      const cityText = $el.find('[class*="citta"],[class*="comune"],[class*="luogo"],[class*="localita"]').first().text().trim();

      auctions.push({ url, title: title || null, basePrice: priceText || null, city: cityText || null });
    });

    // Fallback: cerca tutti i link con keyword asta
    if (auctions.length === 0) {
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().toLowerCase();
        if (
          (href.includes('/inserzioni/') || href.includes('/lotto/') || href.includes('/asta/') || href.includes('/immobile/')) &&
          !href.includes('#')
        ) {
          const url = href.startsWith('http') ? href : `${new URL(portal.searchUrl).origin}${href}`;
          auctions.push({ url, title: $(el).text().trim() || null, basePrice: null, city: null });
        }
      });
    }
  } catch (err) {
    console.error(`[CRAWLER] Errore ${portal.name}: ${err.message}`);
  }
  return auctions;
}

// ============================================================================
// DATABASE
// ============================================================================

function parsePrice(raw) {
  if (!raw) return null;
  const match = raw.replace(/\./g, '').replace(',', '.').match(/\d+\.?\d*/);
  return match ? parseFloat(match[0]) : null;
}

async function saveDiscoveredAuctions(auctions, portalId) {
  let saved = 0, skipped = 0;
  for (const auction of auctions) {
    if (!auction.url || !auction.url.startsWith('http')) continue;
    try {
      const existing = await prisma.discoveredAuction.findUnique({ where: { url: auction.url } });
      if (existing) { skipped++; continue; }
      await prisma.discoveredAuction.create({
        data: {
          portalSource: portalId,
          url: auction.url,
          title: auction.title,
          city: auction.city,
          basePrice: parsePrice(auction.basePrice),
          rawData: JSON.stringify(auction),
          status: 'NEW',
        },
      });
      saved++;
    } catch (err) {
      if (!err.message.includes('Unique')) {
        console.error(`[CRAWLER] DB error: ${err.message}`);
      }
    }
  }
  return { saved, skipped };
}

// ============================================================================
// CODA ANALISI
// ============================================================================

async function queueNewAuctionsForAnalysis(limit = 5) {
  const newAuctions = await prisma.discoveredAuction.findMany({
    where: { status: 'NEW' },
    orderBy: { discoveredAt: 'asc' },
    take: limit,
  });

  console.log(`[CRAWLER] ${newAuctions.length} aste da analizzare`);
  let queued = 0;

  for (const auction of newAuctions) {
    try {
      const { createAnalysisPipeline } = require('./dag-orchestrator');
      await createAnalysisPipeline({
        url: auction.url,
        email: process.env.ADMIN_REVIEW_EMAIL || 'a.simonevolution@gmail.com',
        tier: 'TIER_1_SCREENING_69',
        source: 'AUTONOMOUS_CRAWLER',
      });
      await prisma.discoveredAuction.update({
        where: { id: auction.id },
        data: { status: 'QUEUED', queuedAt: new Date() },
      });
      queued++;
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[CRAWLER] Errore accodamento ${auction.url}: ${err.message}`);
    }
  }
  return queued;
}

// ============================================================================
// MAIN
// ============================================================================

async function runCrawler(options = {}) {
  const { portals = PORTALS, maxPerPortal = 20, autoQueue = true } = options;
  const results = { discovered: 0, queued: 0, errors: [] };

  console.log(`[CRAWLER] Avvio — ${new Date().toISOString()}`);

  for (const portal of portals) {
    console.log(`[CRAWLER] Scansione: ${portal.name}`);
    const auctions = await scrapePortal(portal);
    const limited = auctions.slice(0, maxPerPortal);
    const { saved, skipped } = await saveDiscoveredAuctions(limited, portal.id);
    results.discovered += saved;
    console.log(`[CRAWLER] ${portal.name}: ${saved} nuove, ${skipped} già presenti`);
    await new Promise(r => setTimeout(r, portal.rateLimit));
  }

  if (autoQueue && results.discovered > 0) {
    results.queued = await queueNewAuctionsForAnalysis(5);
  }

  console.log(`[CRAWLER] Completato: ${results.discovered} scoperte, ${results.queued} accodate`);
  return results;
}

module.exports = { runCrawler, queueNewAuctionsForAnalysis, PORTALS };
