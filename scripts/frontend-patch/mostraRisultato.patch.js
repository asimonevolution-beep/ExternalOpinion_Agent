function mostraRisultato(job, immobile) {
  document.getElementById('progress-box').style.display = 'none';
  document.getElementById('result-box').style.display   = 'block';

  const imm       = immobile || {};
  const esito     = imm.esitoCliente || null;
  const status    = imm.giudizioNonPossibile ? 'NON_VALUTABILE' : (imm.status || 'GIALLO');
  const colorMap  = { VERDE: '#1E8449', GIALLO: '#D4AC0D', ROSSO: '#C0392B', NON_VALUTABILE: '#7a7a7a' };
  const labelMap  = { VERDE: 'Verde — Scenario favorevole', GIALLO: 'Giallo — Da verificare prima di offrire', ROSSO: 'Rosso — Scenario critico', NON_VALUTABILE: 'Giudizio non possibile' };
  const bannerBg  = status === 'VERDE' ? '#f0faf3' : status === 'ROSSO' ? '#fdf2f0' : status === 'NON_VALUTABILE' ? '#f3f3f3' : '#fefce8';

  document.getElementById('semaforo-banner').style.background = bannerBg;
  document.getElementById('semaforo-dot').style.background    = colorMap[status] || colorMap.GIALLO;
  document.getElementById('semaforo-label').textContent       = (esito && esito.titolo) || labelMap[status] || status;
  document.getElementById('semaforo-desc').textContent        = (esito && esito.sottotitolo) || '';

  // Dettaglio dell'esito: ogni frase arriva dal calcolo sul server.
  let det = document.getElementById('esito-dettaglio');
  if (!det) {
    det = document.createElement('div');
    det.id = 'esito-dettaglio';
    det.style.cssText = 'max-width:420px;margin:0.9rem auto 0;text-align:left;font-size:0.8rem;line-height:1.55;color:#3a3a3a;';
    document.getElementById('semaforo-desc').insertAdjacentElement('afterend', det);
  }
  det.textContent = '';
  const aggiungi = (tag, testo, stile) => {
    const el = document.createElement(tag);
    el.textContent = testo;
    if (stile) el.style.cssText = stile;
    det.appendChild(el);
    return el;
  };
  if (esito) {
    (esito.frasi || []).forEach((f) => aggiungi('p', f, 'margin:0 0 0.45rem;'));
    if (esito.punti && esito.punti.length) {
      aggiungi('p', 'Da verificare nei documenti:', 'margin:0.7rem 0 0.3rem;font-weight:700;');
      const ul = document.createElement('ul');
      ul.style.cssText = 'margin:0 0 0.5rem 1.1rem;padding:0;';
      esito.punti.forEach((p) => { const li = document.createElement('li'); li.textContent = p; li.style.marginBottom = '0.25rem'; ul.appendChild(li); });
      det.appendChild(ul);
    }
    if (esito.azione) aggiungi('p', 'Cosa fare: ' + esito.azione, 'margin:0.6rem 0 0;font-weight:700;');
  }

  const fmtEuro = (v) => '€ ' + Math.round(v).toLocaleString('it-IT');
  const fmtPerc = (v) => Number(v).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  const setMetrica = (id, valore, etichetta) => {
    const el = document.getElementById(id);
    el.textContent = valore;
    const lab = el.parentElement && el.parentElement.querySelector('.metric-label');
    if (lab && etichetta) lab.textContent = etichetta;
  };

  setMetrica('m-coerenza', imm.coherenceIndex != null ? Math.round(imm.coherenceIndex) + '%' : '—', 'Coerenza documenti');
  const roiPerc = imm.roiPercentuale != null ? imm.roiPercentuale : (imm.roi != null ? imm.roi * 100 : null);
  setMetrica('m-roi', roiPerc != null ? fmtPerc(roiPerc) : '—', 'Margine al prezzo base');
  setMetrica('m-valore', imm.valoreAttuale ? fmtEuro(imm.valoreAttuale) : '—', 'Stima del perito');

  // Senza perizia non si vende il report: prima serve il documento.
  const cta = document.getElementById('btnPaga').closest('.result-cta-box');
  if (cta) cta.style.display = status === 'NON_VALUTABILE' ? 'none' : '';

  document.getElementById('result-box').scrollIntoView({ behavior: 'smooth' });
}

// Ritorno all'esito dal link dell'email: index-legacy.html?job=<id>
document.addEventListener('DOMContentLoaded', () => {
  const j = new URLSearchParams(window.location.search).get('job');
  if (j && /^[0-9a-f-]{36}$/i.test(j)) {
    currentJobId = j;
    document.getElementById('form-box').style.display = 'none';
    document.getElementById('progress-box').style.display = 'block';
    pollRisultato(j);
  }
});
