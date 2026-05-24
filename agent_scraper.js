const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { URL } = require('url');

// PDF magic bytes: %PDF — evita dipendenza da file-type (ESM-only)
function isPdfBuffer(buf) {
  return buf && buf.length >= 4 &&
    buf[0] === 0x25 && buf[1] === 0x50 &&
    buf[2] === 0x44 && buf[3] === 0x46;
}

puppeteerExtra.use(StealthPlugin());

const browserOptions = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-gpu',
  ],
};

async function dismissCookieBanners(page) {
  try {
    await page.evaluate(() => {
      const buttonText = /(accetta|consenti|accept|accept all|ok|chiudi|close|rifiuta|cookie)/i;
      const elements = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]'));
      elements.forEach((el) => {
        const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim();
        if (buttonText.test(text)) {
          el.click();
        }
      });
    });
    await page.waitForTimeout(1000);
  } catch (err) {
    // Ignora fallimenti non critici
  }
}

async function findPdfCandidate(page) {
  return page.evaluate(() => {
    const keywords = ['perizia', 'planimetria', 'planimetrie', 'allegati', 'allegato'];
    const nodes = Array.from(document.querySelectorAll('a[href], button, input[type="button"], input[type="submit"], [role="button"]'));
    const candidates = [];

    nodes.forEach((node, index) => {
      const text = (node.innerText || node.value || node.getAttribute('aria-label') || node.title || '').trim().toLowerCase();
      const href = node.tagName === 'A' ? node.href : node.getAttribute('href');
      const isPdf = href && href.toLowerCase().includes('.pdf');
      const matchesKeyword = keywords.some((keyword) => text.includes(keyword) || (href && href.toLowerCase().includes(keyword)));
      if (isPdf || matchesKeyword) {
        candidates.push({ href: href || null, selector: `[data-ep-candidate="${index}"]` });
      }
    });

    return candidates;
  });
}

async function scrapeUrl(url) {
  const browser = await puppeteerExtra.launch(browserOptions);
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1366, height: 768 });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await dismissCookieBanners(page);

  const directPdf = url.match(/\.pdf(?:\?|$)/i);
  let buffer = null;
  let pdfUrl = url;
  let fileName = 'documento.pdf';

  if (directPdf) {
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    buffer = await response.buffer();
  } else {
    const candidates = await findPdfCandidate(page);
    for (const candidate of candidates) {
      if (candidate.href) {
        pdfUrl = candidate.href.startsWith('http') ? candidate.href : new URL(candidate.href, url).href;
        const response = await page.goto(pdfUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        buffer = await response.buffer();
        if (buffer) break;
      }
    }

    if (!buffer && candidates.length > 0) {
      const candidate = candidates[0];
      if (candidate.selector) {
        buffer = await page.click(candidate.selector).then(() => page.waitForResponse((response) => response.headers()['content-type']?.includes('pdf'), { timeout: 12000 })).then((res) => res.buffer());
      }
    }
  }

  await browser.close();

  if (!buffer) {
    throw new Error('Impossibile scaricare un PDF valido dalla pagina.');
  }

  if (!isPdfBuffer(buffer) || buffer.length < 20480) {
    throw new Error('Contenuto non valido o file troppo piccolo.');
  }

  try {
    const urlPath = new URL(pdfUrl).pathname;
    fileName = urlPath ? urlPath.split('/').pop() : fileName;
  } catch (_) {}

  return {
    buffer,
    url: pdfUrl,
    fileName,
  };
}

module.exports = {
  scrapeUrl,
};
