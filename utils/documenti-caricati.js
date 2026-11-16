/**
 * Documenti caricati dal cliente nell'app (07/11/2026).
 * Il cliente carica PDF o foto direttamente dal modulo, come incolla un link:
 * - dai PDF estraiamo subito il testo e lo agganciamo alla richiesta
 *   (Immobile.datiComputati.documentiCaricati), cosi' entra nell'analisi;
 * - l'originale arriva a Simone su Telegram, sempre, in automatico;
 * - ogni caricamento lascia una traccia in JobEvent.
 */

const crypto = require('crypto');
const prisma = require('../db');
const { alertOwner } = require('./owner-alert');

const MAX_FILE_BYTES = 7 * 1024 * 1024;   // sta nel limite JSON 10 MB anche in base64
const MAX_DOCUMENTI = 8;
const MAX_TESTO_PER_DOC = 120000;
const FINESTRA_CARICAMENTO_MS = 6 * 60 * 60 * 1000; // solo per richieste recenti

const TIPI_AMMESSI = {
  'application/pdf': 'pdf',
  'image/jpeg': 'foto',
  'image/png': 'foto',
  'image/webp': 'foto',
  'image/heic': 'foto',
  'image/heif': 'foto',
};

class ErroreDocumento extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function nomeSicuro(nome) {
  return String(nome || 'documento').replace(/[^\w.\-àèéìòù ]+/gi, '_').slice(0, 120) || 'documento';
}

async function estraiTestoPdf(buffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  const testo = String(data.text || '').replace(/\s+/g, ' ').trim();
  return { testo: testo.slice(0, MAX_TESTO_PER_DOC), pagine: data.numpages || null };
}

async function inviaATelegram({ buffer, nome, mime, didascalia }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('Telegram non configurato');
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', didascalia.slice(0, 1000));
  form.append('document', new Blob([buffer], { type: mime }), nome);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`);
}

/**
 * Salva un documento caricato dal cliente.
 * @param {string} jobId
 * @param {{ nome: string, tipo: string, dati: string }} file  dati = base64 senza prefisso data:
 */
async function salvaDocumentoCaricato(jobId, file) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { immobile: true } });
  if (!job || !job.immobile) throw new ErroreDocumento('Richiesta non trovata', 404);
  if (Date.now() - new Date(job.createdAt).getTime() > FINESTRA_CARICAMENTO_MS) {
    throw new ErroreDocumento('Tempo per caricare documenti su questa richiesta scaduto. Avvia una nuova richiesta.', 409);
  }

  const mime = String(file?.tipo || '').toLowerCase();
  const categoria = TIPI_AMMESSI[mime];
  if (!categoria) throw new ErroreDocumento('Formato non supportato: carica un PDF o una foto (JPG, PNG).');

  const base64 = String(file?.dati || '').replace(/^data:[^,]*,/, '');
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) throw new ErroreDocumento('Il file è vuoto.');
  if (buffer.length > MAX_FILE_BYTES) throw new ErroreDocumento('Il file supera 7 MB: caricane una versione più leggera.');

  const dati = (() => { try { return JSON.parse(job.immobile.datiComputati || '{}'); } catch { return {}; } })();
  const giaCaricati = Array.isArray(dati.documentiCaricati) ? dati.documentiCaricati : [];
  if (giaCaricati.length >= MAX_DOCUMENTI) throw new ErroreDocumento(`Puoi caricare al massimo ${MAX_DOCUMENTI} documenti per richiesta.`);

  const nome = nomeSicuro(file?.nome);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (giaCaricati.some((d) => d.hash === hash)) {
    return { nome, duplicato: true, totale: giaCaricati.length };
  }

  let testo = '';
  let pagine = null;
  let esito = 'RICEVUTO';
  if (categoria === 'pdf') {
    try {
      ({ testo, pagine } = await estraiTestoPdf(buffer));
      esito = testo.length >= 300 ? 'LETTO' : 'TESTO_ASSENTE';
    } catch (err) {
      esito = 'ERRORE_LETTURA';
    }
  } else {
    esito = 'FOTO_DA_VEDERE'; // nessun OCR automatico: la guarda Simone
  }

  const voce = { nome, mime, categoria, pagine, caratteri: testo.length, esito, hash, testo, caricatoIl: new Date().toISOString() };

  // Rilegge e scrive in un'unica transazione per non perdere caricamenti paralleli
  const totale = await prisma.$transaction(async (tx) => {
    const imm = await tx.immobile.findUnique({ where: { jobId } });
    const d = (() => { try { return JSON.parse(imm.datiComputati || '{}'); } catch { return {}; } })();
    const lista = Array.isArray(d.documentiCaricati) ? d.documentiCaricati : [];
    lista.push(voce);
    await tx.immobile.update({ where: { jobId }, data: { datiComputati: JSON.stringify({ ...d, documentiCaricati: lista }) } });
    await tx.jobEvent.create({
      data: {
        jobId,
        eventType: 'DOCUMENT_UPLOADED',
        metadata: JSON.stringify({ nome, mime, dimensione: buffer.length, pagine, caratteri: testo.length, esito, hash }),
      },
    });
    return lista.length;
  });

  // L'originale a Simone, sempre (non blocca la risposta al cliente)
  const didascalia = `DOCUMENTO CARICATO\nJob: ${jobId}\nFile: ${nome} (${Math.round(buffer.length / 1024)} KB)\nEsito lettura: ${esito}${pagine ? ` - ${pagine} pagine` : ''}`;
  inviaATelegram({ buffer, nome, mime, didascalia })
    .catch((err) => {
      console.error('[DOCUMENTI] Inoltro Telegram fallito:', err.message);
      alertOwner({ title: 'DOCUMENTO CARICATO (file non inoltrato)', body: `${didascalia}\nErrore inoltro: ${err.message}`, priority: 'high', tags: 'page_facing_up' });
    });

  return { nome, esito, pagine, totale };
}

module.exports = { salvaDocumentoCaricato, ErroreDocumento, MAX_DOCUMENTI, MAX_FILE_BYTES };
