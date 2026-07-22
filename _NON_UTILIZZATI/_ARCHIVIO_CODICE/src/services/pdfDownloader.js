const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const { URL } = require('url');
const config = require('../config');
const { ensureDirectory, writeFile } = require('../utils/fs');

const sanitizeFilename = (name) =>
  name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 200);

const validateUrl = (urlString) => {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch (err) {
    throw new Error('URL non valido.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Sono ammessi solo URL con schema http o https.');
  }

  if (config.whitelistHosts.length && !config.whitelistHosts.includes(parsed.hostname.toLowerCase())) {
    throw new Error('Host non consentito per motivi di sicurezza.');
  }

  return parsed;
};

const normalizeFinalUrl = (response) => {
  const finalUrl = response.request?.res?.responseUrl || response.config?.url;
  if (!finalUrl) {
    return null;
  }
  return new URL(finalUrl);
};

const ensurePdfResponse = (response, sourceUrl) => {
  const contentType = response.headers['content-type'] || '';
  const finalUrl = normalizeFinalUrl(response) || new URL(sourceUrl);

  if (config.whitelistHosts.length && !config.whitelistHosts.includes(finalUrl.hostname.toLowerCase())) {
    throw new Error('Redirect finale verso host non consentito.');
  }

  const isPdfContentType = /pdf/i.test(contentType);
  const hasPdfExtension = /\.pdf(?:\?|$)/i.test(finalUrl.pathname);

  if (!isPdfContentType && !hasPdfExtension) {
    throw new Error('Il contenuto scaricato non sembra essere un PDF.');
  }
};

const downloadPdf = async (sourceUrl, destinationFolder) => {
  const url = validateUrl(sourceUrl);
  await ensureDirectory(destinationFolder);

  const response = await axios.get(url.href, {
    responseType: 'arraybuffer',
    timeout: config.downloadTimeoutMs,
    maxRedirects: 5,
    headers: { 'User-Agent': 'ExternalOpinionAgent/1.0' },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  ensurePdfResponse(response, url.href);

  const fileName = sanitizeFilename(path.basename(url.pathname) || 'downloaded.pdf');
  const targetPath = path.join(destinationFolder, `URL_${Date.now()}_${fileName}`);
  await writeFile(targetPath, response.data);

  return targetPath;
};

const fetchPageAndDownloadPdfs = async (pageUrl, destinationFolder) => {
  const url = validateUrl(pageUrl);
  await ensureDirectory(destinationFolder);

  const response = await axios.get(url.href, {
    timeout: config.downloadTimeoutMs,
    maxRedirects: 5,
    headers: { 'User-Agent': 'ExternalOpinionAgent/1.0' },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const html = response.data;
  const $ = cheerio.load(html);
  const pdfUrls = [];

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) {
      return;
    }

    try {
      const absoluteUrl = new URL(href, url.href).href;
      if (/\.pdf(?:\?|$)/i.test(absoluteUrl)) {
        pdfUrls.push(absoluteUrl);
      }
    } catch {
      // ignora URL non validi
    }
  });

  if (pdfUrls.length === 0) {
    throw new Error('Nessun PDF trovato sulla pagina.');
  }

  const downloadedFiles = [];
  for (const pdfUrl of pdfUrls) {
    const fileName = sanitizeFilename(path.basename(new URL(pdfUrl).pathname) || 'documento.pdf');
    const targetPath = path.join(destinationFolder, `LINK_${Date.now()}_${fileName}`);
    const pdfResponse = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: config.downloadTimeoutMs,
      maxRedirects: 5,
      headers: { 'User-Agent': 'ExternalOpinionAgent/1.0' },
      validateStatus: (status) => status >= 200 && status < 400,
    });

    ensurePdfResponse(pdfResponse, pdfUrl);
    await writeFile(targetPath, pdfResponse.data);
    downloadedFiles.push(targetPath);
  }

  return downloadedFiles;
};

const downloadResourcesFromUrl = async (url, destinationFolder) => {
  if (/\.pdf(?:\?|$)/i.test(url)) {
    const downloaded = await downloadPdf(url, destinationFolder);
    return [downloaded];
  }

  return fetchPageAndDownloadPdfs(url, destinationFolder);
};

module.exports = {
  downloadPdf,
  fetchPageAndDownloadPdfs,
  downloadResourcesFromUrl,
};