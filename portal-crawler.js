/**
 * EXTERNAL OPINION — PORTAL CRAWLER AUTONOMO
 *
 * Scansiona ogni notte i portali di aste giudiziarie italiani,
 * scopre nuove aste, le inserisce in coda per analisi AI automatica.
 *
 * Portali target:
 * - pvp.giustizia.it (portale ufficiale Ministero della Giustizia)
 * - astegiudiziarie.it
 * - aste.it
 */

const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const prisma = require('./db');

puppeteerExtra.use(StealthPlugin());

const BROWSER_OPTS = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
  ],
};

// ============================================================================
// PORTALI CONFIGURATI
// ============================================================================

const PORTALS = [
  {
    id: 'pvp_giustizia',
    name: 'PVP Giustizia',
    baseUrl: 'https://pvp.giustizia.it',
    searchUrl: 'https://pvp.giustizia.it/pvp/it/ricerca_avanzata.page?tipoRicerca=IMMOBILI',
    type: 'official',
    rateLimit: 4000,
  },
  {
    id: 'astegiudiziarie',
    name: 'Aste Giudiziarie',
    baseUrl: 'https://www.astegiudiziarie.it',
    searchUrl: 'https://www.astegiudiziarie.it/aste-giudiziarie/immobili',
    type: 'private',
    rateLimit: 3000,
  },
  {
    id: 'aste_it',
    name: 'Aste.it',
    baseUrl: 'https://www.aste.it',
    searchUrl: 'https://www.aste.it/aste/immobili',
    type: 'private',
    rateLimit: 3000,
  },
];

// ============================================================================
// SCRAPERS PER PORTALE
// ============================================================================

async function scrapePVP(page, portalUrl) {
  const auctions = [];
  try {
    await page.goto(portalUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await dismissCookies(page);

    // Estrai tutte le righe della tabella risultati
    const items = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(
        '.risultati-ricerca .lotto, .lotto-item, [class*="lotto"], .ricerca-result, tr.annuncio'
      ));
      return rows.map(row => {
        const link = row.querySelector('a[href*="lotto"], a[href*="immobile"], a[href*="pvp"]');
        const priceEl = row.querySelector('[class*="prezzo"], [class*="base"], .importo');
        const titleEl = row.querySelector('[class*="titolo"], [class*="descrizione"], h3, h4');
        const dateEl = row.querySelector('[class*="data"], time');
        const tribunaleEl = row.querySelector('[class*="tribunale"], [class*="tribunal"]');
        return {
          url: link ? link.href : null,
          title: titleEl ? titleEl.textContent.trim() : null,
          basePrice: priceEl ? priceEl.textContent.trim() : null,
          auctionDate: dateEl ? dateEl.textContent.trim() : null,
          tribunal: tribunaleEl ? tribunaleEl.textContent.trim() : null,
        };
      }).filter(a => a.url);
    });
    auctions.push(...items);
  } catch (err) {
    console.error(`[CRAWLER] PVP scrape error: ${err.message}`);
  }
  return auctions;
}

async function scrapePrivatePortal(page, portalUrl, portalId) {
  const auctions = [];
  try {
    await page.goto(portalUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await dismissCookies(page);

    const items = await page.evaluate(() => {
      // Selettori generici che funzionano su molti portali italiani
      const selectors = [
        '.annuncio', '.listing-item', '.property-item',
        '.asta-item', '[class*="annuncio"]', '[class*="lotto"]',
        'article.item', '.search-result', '.immobile-card',
      ];

      let rows = [];
      for (const sel of selectors) {
        rows = Array.from(document.querySelectorAll(sel));
        if (rows.length > 0) break;
      }

      return rows.map(row => {
        const link = row.querySelector('a');
        const priceEl = row.querySelector(
          '[class*="prezzo"], [class*="price"], [class*="importo"], [class*="base"]'
        );
        const titleEl = row.querySelector('h1, h2, h3, h4, [class*="titol"]');
        const locationEl = row.querySelector(
          '[class*="citta"], [class*="city"], [class*="comune"], [class*="luogo"]'
        );
        return {
          url: link ? link.href : null,
          title: titleEl ? titleEl.textContent.trim() : null,
          basePrice: priceEl ? priceEl.textContent.trim() : null,
          city: locationEl ? locationEl.textContent.trim() : null,
        };
      }).filter(a => a.url && a.url.startsWith('http'));
    });
    auctions.push(...items);
  } catch (err) {
    console.error(`[CRAWLER] ${portalId} scrape error: ${err.message}`);
  }
  return auctions;
}

// ============================================================================
// UTILITY
// ============================================================================

async function dismissCookies(page) {
  try {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      btns.forEach(btn => {
        const text = (btn.innerText || btn.value || '').toLowerCase();
        if (/accetta|accept|ok|consenti|chiudi/.test(text)) btn.click();
      });
    });
    await new Promise(r => setTimeout(r, 800));
  } catch (_) {}
}

function parsePrice(raw) {
  if (!raw) return null;
  const match = raw.replace(/\./g, '').replace(',', '.').match(/[\d]+\.?\d*/);
  return match ? parseFloat(match[0]) : null;
}

function parseDate(raw) {
  if (!raw) return null;
  const match = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (match) return new Date(`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`);
  return null;
}

// ============================================================================
// SALVATAGGIO NEL DATABASE
// ============================================================================

async function saveDiscoveredAuctions(auctions, portalId) {
  let saved = 0;
  let skipped = 0;

  for (const auction of auctions) {
    if (!auction.url) continue;
    try {
      await prisma.discoveredAuction.upsert({
        where: { url: auction.url },
        update: {},
        create: {
          portalSource: portalId,
          url: auction.url,
          title: auction.title,
          tribunal: auction.tribunal || null,
          city: auction.city || null,
          basePrice: parsePrice(auction.basePrice),
          auctionDate: parseDate(auction.auctionDate),
          rawData: JSON.stringify(auction),
          status: 'NEW',
        },
      });
      saved++;
    } catch (err) {
      if (err.code === 'P2002') {
        skipped++;
      } else {
        console.error(`[CRAWLER] DB error for ${auction.url}: ${err.message}`);
      }
    }
  }

  return { saved, skipped };
}

// ============================================================================
// CODA PER ANALISI AI
// ============================================================================

async function queueNewAuctionsForAnalysis(limit = 10) {
  const { createAnalysisPipeline } = require('./dag-orchestrator');

  const newAuctions = await prisma.discoveredAuction.findMany({
    where: { status: 'NEW' },
    orderBy: { discoveredAt: 'asc' },
    take: limit,
  });

  console.log(`[CRAWLER] Trovate ${newAuctions.length} aste da analizzare`);

  for (const auction of newAuctions) {
    try {
      const pipeline = await createAnalysisPipeline({
        url: auction.url,
        email: process.env.ADMIN_REVIEW_EMAIL || 'a.simonevolution@gmail.com',
        tier: 'TIER_1_SCREENING_69',
        source: 'AUTONOMOUS_CRAWLER',
        discoveredAuctionId: auction.id,
      });

      await prisma.discoveredAuction.update({
        where: { id: auction.id },
        data: {
          status: 'QUEUED',
          jobId: pipeline.jobId || null,
          queuedAt: new Date(),
        },
      });

      console.log(`[CRAWLER] Accodata: ${auction.url}`);

      // Rate limit tra un'asta e l'altra
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[CRAWLER] Errore accodamento ${auction.url}: ${err.message}`);
    }
  }

  return newAuctions.length;
}

// ============================================================================
// ENTRY POINT PRINCIPALE
// ============================================================================

async function runCrawler(options = {}) {
  const { portals = PORTALS, maxPerPortal = 20, autoQueue = true } = options;
  const results = { discovered: 0, queued: 0, errors: [] };

  console.log(`[CRAWLER] Avvio scansione — ${new Date().toISOString()}`);

  let browser;
  try {
    browser = await puppeteerExtra.launch(BROWSER_OPTS);

    for (const portal of portals) {
      console.log(`[CRAWLER] Scansione: ${portal.name}`);
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1366, height: 768 });

      let auctions = [];
      if (portal.id === 'pvp_giustizia') {
        auctions = await scrapePVP(page, portal.searchUrl);
      } else {
        auctions = await scrapePrivatePortal(page, portal.searchUrl, portal.id);
      }

      await page.close();

      // Limita per non sovraccaricare
      const limited = auctions.slice(0, maxPerPortal);
      const { saved, skipped } = await saveDiscoveredAuctions(limited, portal.id);
      results.discovered += saved;
      console.log(`[CRAWLER] ${portal.name}: ${saved} nuove, ${skipped} già presenti`);

      // Pausa tra portali
      await new Promise(r => setTimeout(r, portal.rateLimit));
    }
  } catch (err) {
    console.error(`[CRAWLER] Errore browser: ${err.message}`);
    results.errors.push(err.message);
  } finally {
    if (browser) await browser.close();
  }

  // Accoda le nuove aste per analisi AI
  if (autoQueue && results.discovered > 0) {
    results.queued = await queueNewAuctionsForAnalysis(5);
  }

  console.log(`[CRAWLER] Completato: ${results.discovered} scoperte, ${results.queued} accodate`);
  return results;
}

module.exports = { runCrawler, queueNewAuctionsForAnalysis, PORTALS };
