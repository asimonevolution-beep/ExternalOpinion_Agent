/**
 * Avviso a Simone — SEMPRE attivo.
 * Ogni richiesta che arriva (riuscita, scartata o fallita) produce una notifica
 * sul telefono via ntfy e, in parallelo, su Telegram. I due canali sono
 * indipendenti: se uno cade, l'altro arriva comunque. La funzione non lancia mai
 * eccezioni, così un problema di notifica non blocca la richiesta del cliente.
 */

async function sendNtfy({ title, body, priority = 'high', tags = 'house' }) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) throw new Error('NTFY_TOPIC non configurato');
  const res = await fetch(`https://ntfy.sh/${topic}`, {
    method: 'POST',
    headers: {
      // Gli header HTTP accettano solo ASCII: tolgo accenti ed emoji dal titolo
      Title: String(title).normalize('NFD').replace(/[^\x20-\x7E]/g, ''),
      Priority: priority,
      Tags: tags,
    },
    body,
  });
  if (!res.ok) throw new Error(`ntfy HTTP ${res.status}`);
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('Telegram non configurato');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`);
}

/**
 * @param {object} a
 * @param {string} a.title     titolo breve
 * @param {string} a.body      dettagli (job, link, contatto, motivo)
 * @param {'min'|'low'|'default'|'high'|'urgent'} [a.priority]
 * @param {string} [a.tags]    tag ntfy (emoji shortcodes)
 * @returns {Promise<{ntfy:boolean, telegram:boolean}>}
 */
async function alertOwner({ title, body, priority = 'high', tags = 'house' }) {
  const [n, t] = await Promise.allSettled([
    sendNtfy({ title, body, priority, tags }),
    sendTelegram(`${title}\n${body}`),
  ]);
  const esito = { ntfy: n.status === 'fulfilled', telegram: t.status === 'fulfilled' };
  if (!esito.ntfy) console.error('[OWNER-ALERT] ntfy KO:', n.reason?.message);
  if (!esito.telegram) console.error('[OWNER-ALERT] Telegram KO:', t.reason?.message);
  if (!esito.ntfy && !esito.telegram) {
    console.error(`[OWNER-ALERT] NESSUN CANALE RAGGIUNTO — ${title} | ${body.replace(/\n/g, ' | ')}`);
  } else {
    console.log(`[OWNER-ALERT] inviato (ntfy=${esito.ntfy} telegram=${esito.telegram}) — ${title}`);
  }
  return esito;
}

module.exports = { alertOwner };
