'use strict';

/**
 * Email dell'esito della pre-analisi gratuita.
 * Il modulo del sito promette "email per ricevere il verdetto": prima nessuna
 * email partiva (prova reale del 06/11/2026, job 1d5a5c1d).
 * Una copia va sempre all'indirizzo di revisione di Simone come avviso.
 */

const { sendEmailViaResend } = require('./resend-client');

const BASE_PUBBLICA = 'https://externalopinion.it';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function componiEmailVerdetto({ jobId, esito, urlAsta, semaforo }) {
  const colore = { VERDE: '#1E8449', GIALLO: '#B7950B', ROSSO: '#C0392B' }[semaforo] || '#555';
  const link = `${BASE_PUBBLICA}/index-legacy.html?job=${encodeURIComponent(jobId)}`;
  const frasi = (esito.frasi || []).map((f) => `<p style="margin:0 0 10px">${esc(f)}</p>`).join('');
  const punti = (esito.punti || []).length
    ? `<p style="margin:16px 0 6px;font-weight:bold">Da verificare nei documenti:</p><ul style="margin:0 0 12px 18px;padding:0">${esito.punti.map((p) => `<li style="margin-bottom:4px">${esc(p)}</li>`).join('')}</ul>`
    : '';
  const html = `<!doctype html><html lang="it"><body style="margin:0;background:#f4f1ea;font-family:Georgia,serif;color:#222">
<div style="max-width:560px;margin:0 auto;padding:28px 22px;background:#fff">
  <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a7a50;margin:0 0 18px">External Opinion · Esito della pre-analisi</p>
  <h1 style="font-size:22px;margin:0 0 6px;color:${colore}">${esc(esito.titolo)}</h1>
  <p style="margin:0 0 18px;color:#555">${esc(esito.sottotitolo || '')}</p>
  ${frasi}
  ${punti}
  ${esito.azione ? `<p style="margin:14px 0;font-weight:bold">Cosa fare: ${esc(esito.azione)}</p>` : ''}
  <p style="margin:22px 0"><a href="${link}" style="background:#B8892E;color:#1A1400;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:bold">Rivedi l'esito e sblocca il report completo</a></p>
  <p style="font-size:12px;color:#777;margin:18px 0 0">Immobile analizzato: <a href="${esc(urlAsta)}" style="color:#777">${esc(urlAsta)}</a></p>
  <p style="font-size:12px;color:#777;margin:8px 0 0">Parere tecnico a scopo informativo, non costituisce perizia. Geom. Simone Azzali — External Opinion.</p>
</div></body></html>`;
  return { subject: `Esito pre-analisi: ${esito.titolo}`, html };
}

async function inviaEmailVerdetto({ jobId, email, esito, urlAsta, semaforo }) {
  const { subject, html } = componiEmailVerdetto({ jobId, esito, urlAsta, semaforo });
  const esiti = {};
  if (email) esiti.cliente = await sendEmailViaResend({ to: email, subject, html });
  const admin = process.env.ADMIN_REVIEW_EMAIL;
  if (admin && admin !== email) {
    try {
      esiti.admin = await sendEmailViaResend({ to: admin, subject: `[Nuova pre-analisi] ${subject} — ${email || 'senza email'}`, html });
    } catch (err) {
      esiti.adminErrore = err.message;
    }
  }
  return esiti;
}

module.exports = { componiEmailVerdetto, inviaEmailVerdetto };
