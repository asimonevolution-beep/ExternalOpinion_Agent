const fs = require('fs');
const pdfParse = require('pdf-parse');

function normalizeNumber(value) {
  if (!value) return null;
  const cleaned = value.toString().replace(/[^0-9,\.]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractSingleMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function extractTechnicalData(text) {
  const lower = text.toLowerCase();

  const areaCatastale = extractSingleMatch(text, [
    /superficie catastale[:\s]*([0-9\.\,]+)\s*(?:mq|m2|metri quadri?)/i,
    /sup\.? catastale[:\s]*([0-9\.\,]+)\s*(?:mq|m2)/i,
  ]);
  const areaCommerciale = extractSingleMatch(text, [
    /superficie commerciale[:\s]*([0-9\.\,]+)\s*(?:mq|m2|metri quadri?)/i,
    /sup\.? commerciale[:\s]*([0-9\.\,]+)\s*(?:mq|m2)/i,
  ]);
  const generalAreas = text.match(/\d{1,3}(?:[\.,]\d{1,2})?\s*(?:mq|m2|metri quadri?)/gi) || [];

  const basePrice = extractSingleMatch(text, [
    /prezzo base d'?asta[:\s]*€?\s*([0-9\.\,]+)/i,
    /base d'?asta[:\s]*€?\s*([0-9\.\,]+)/i,
    /prezzo d'?asta[:\s]*€?\s*([0-9\.\,]+)/i,
    /€\s*([0-9]{1,3}(?:[\.\,][0-9]{3})*(?:[\.,][0-9]+)?)(?=[^\d]|$)/,
  ]);
  const ctuValue = extractSingleMatch(text, [
    /valore di stima ctu[:\s]*€?\s*([0-9\.\,]+)/i,
    /valore stimato ctu[:\s]*€?\s*([0-9\.\,]+)/i,
    /stima ctu[:\s]*€?\s*([0-9\.\,]+)/i,
    /valore perizia[:\s]*€?\s*([0-9\.\,]+)/i,
  ]);

  const yearBuilt = extractSingleMatch(text, [
    /anno costruzione[:\s]*(19|20)\d{2}/i,
    /costruzione[:\s]*(19|20)\d{2}/i,
  ]) || (text.match(/\b(19|20)\d{2}\b/g) || []).find((y) => parseInt(y, 10) <= new Date().getFullYear());

  const floor = extractSingleMatch(text, [
    /piano[:\s]*([\w\d°ª]+\s*piano)/i,
    /(piano terra|primo piano|secondo piano|terzo piano|quarto piano|quinto piano)/i,
    /al (\d+[ª°]? piano)/i,
  ]) || extractSingleMatch(text, [/piano[:\s]*(\d+)/i]);

  const propertyType = extractSingleMatch(text, [
    /unit[àa] immobiliare[:\s]*([a-zA-Z\s]+)/i,
    /tipo immobile[:\s]*([a-zA-Z\s]+)/i,
    /destinazione d'?uso[:\s]*([a-zA-Z\s]+)/i,
  ]) || extractSingleMatch(lower, [
    /\b(appartamento|ufficio|negozio|laboratorio|magazzino|box|autorimessa|villa|attico|bilocale|trilocale|loft)\b/i,
  ]);

  const occupancy = extractSingleMatch(lower, [
    /(libero|occupato da|occupato|inquilino|ex proprietario|abusivo|occupazione abusiva|occupazione)/i,
  ]);

  const address = extractSingleMatch(text, [
    /indirizzo[:\s]*([^\n\r]+)/i,
    /via[:\s]*([^,\n\r]+)/i,
    /piazza[:\s]*([^,\n\r]+)/i,
  ]);
  const comune = extractSingleMatch(text, [
    /comune di[:\s]*([A-Za-z\s]+)/i,
    /comune[:\s]*([A-Za-z\s]+)/i,
  ]);
  const provincia = extractSingleMatch(text, [
    /provincia di[:\s]*([A-Za-z\s]+)/i,
    /provincia[:\s]*([A-Za-z\s]+)/i,
  ]);

  const difformita = Array.from(new Set([...(text.match(/difformit[àa]|difformita|irregolarit[àa]|irregolarita|abus[oi]|sanabile|non sanabile|non sanabile/i) || [])].map((item) => item.trim())));
  const structuralIssues = Array.from(new Set([...(text.match(/umidit[àa]|infiltrazione|muffa|lesione|fessura|crepa|cedimento|dissesto|struttura|solaio|trave|impian(?:to|ti)|elettrico|idraulico|fognatura|canna fumaria|isolamento|termico/i) || [])].map((item) => item.trim())));
  const condominialArrearsMatch = extractSingleMatch(text, [
    /spese condominiali arretrate[:\s]*€?\s*([0-9\.\,]+)/i,
    /contributi condominiali arretrati[:\s]*€?\s*([0-9\.\,]+)/i,
    /debiti condominiali[:\s]*€?\s*([0-9\.\,]+)/i,
  ]);

  const sismicZone = extractSingleMatch(text, [
    /zona sismica[:\s]*([12])/i,
    /sismica[:\s]*([12])/i,
  ]);

  const summary = text.slice(0, 500).replace(/\s+/g, ' ').trim();

  return {
    areas: generalAreas.map((item) => item.trim()),
    areaCatastale: normalizeNumber(areaCatastale),
    areaCommerciale: normalizeNumber(areaCommerciale),
    basePrice: normalizeNumber(basePrice),
    ctuValue: normalizeNumber(ctuValue),
    yearBuilt: yearBuilt ? parseInt(yearBuilt, 10) : null,
    floor: floor ? floor.toString().replace(/\s+/g, ' ').trim() : null,
    propertyType: propertyType ? propertyType.toString().trim() : null,
    occupancyStatus: occupancy ? occupancy.toString().trim() : 'N/D',
    address: address ? address.toString().trim() : null,
    comune: comune ? comune.toString().trim() : null,
    provincia: provincia ? provincia.toString().trim() : null,
    difformita: difformita.length > 0 ? difformita : [],
    structuralIssues: structuralIssues.length > 0 ? structuralIssues : [],
    condominialArrears: normalizeNumber(condominialArrearsMatch) || 0,
    sismicZone: sismicZone ? sismicZone.toString().trim() : null,
    summary,
    rawText: text.replace(/\s+/g, ' ').trim(),
  };
}

async function parsePdfBuffer(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text || '';
  const technical = extractTechnicalData(text);

  return {
    pages: data.numpages,
    technical,
  };
}

async function parsePdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  return parsePdfBuffer(buffer);
}

module.exports = {
  parsePdfBuffer,
  parsePdf,
};
