'use strict';

const API_BASE = '';
let currentJobId = null;
let currentEmail = '';

const STATUS_STEP = {
  PENDING: null,
  SCRAPING: 'scrape', SCRAPE_DONE: 'scrape',
  OCR_DONE: 'ocr',
  LLM_DONE: 'llm', EXTRACTION_DONE: 'llm',
  SCORED: 'scoring', READY_FOR_PAYMENT: 'scoring', COMPLETED: 'scoring',
};
const STEP_ORDER = ['scrape', 'ocr', 'llm', 'scoring'];
const STEP_PROGRESS = { scrape: 20, ocr: 45, llm: 75, scoring: 100 };

function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(el => { if (el.isIntersecting) el.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

function initScrollToButtons() {
  document.querySelectorAll('[data-scroll-to]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.scrollTo);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function aggiornaSteps(status) {
  const currentStep = STATUS_STEP[status];
  if (!currentStep) return;
  const idx = STEP_ORDER.indexOf(currentStep);
  STEP_ORDER.forEach((s, i) => {
    const el = document.getElementById('step-' + s);
    if (!el) return;
    const icon = el.querySelector('.step-icon');
    if (i < idx)      { el.className = 'pipe-step done';   icon.textContent = '✓'; }
    else if (i === idx){ el.className = 'pipe-step active'; icon.textContent = '●'; }
    else               { el.className = 'pipe-step';        icon.textContent = '○'; }
  });
  document.getElementById('progress-bar').style.width = (STEP_PROGRESS[currentStep] || 0) + '%';
}

async function avviaAnalisi() {
  const urlAsta = document.getElementById('urlAsta').value.trim();
  const email   = document.getElementById('emailInput').value.trim();
  if (!urlAsta || !email)          { mostraErrore('Inserisci URL asta e email.'); return; }
  if (!urlAsta.startsWith('http')) { mostraErrore('URL non valido. Deve iniziare con https://'); return; }
  if (!email.includes('@'))        { mostraErrore('Email non valida.'); return; }

  currentEmail = email;
  document.getElementById('btnAnalizza').disabled = true;
  document.getElementById('btnAnalizza').textContent = 'Avvio...';
  document.getElementById('form-box').style.display     = 'none';
  document.getElementById('progress-box').style.display = 'block';
  document.getElementById('result-box').style.display   = 'none';
  document.getElementById('error-box').style.display    = 'none';

  ['scrape', 'ocr', 'llm', 'scoring'].forEach(s => {
    const el = document.getElementById('step-' + s);
    if (el) { el.className = 'pipe-step'; el.querySelector('.step-icon').textContent = '○'; }
  });
  document.getElementById('progress-bar').style.width = '5%';

  try {
    const res  = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urlAsta, email, tier: 'TIER_1_SCREENING_69' }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Errore server');
    currentJobId = data.jobId;
    pollRisultato(currentJobId);
  } catch (err) {
    mostraErrore('Servizio temporaneamente non disponibile. Riprova tra pochi minuti.');
    console.error(err.message);
    resetForm();
  }
}

// ── Polling tollerante alle reti instabili ───────────────────────────────────
const POLL_BASE_MS     = 3000;            // intervallo normale tra un poll e l'altro
const POLL_MAX_MS      = 15000;           // intervallo massimo durante il backoff
const REQ_TIMEOUT_MS   = 12000;           // timeout della singola richiesta
const POLL_DEADLINE_MS = 6 * 60 * 1000;   // durata massima complessiva dell'analisi

// Avviso discreto in pagina (creato al volo, nessuna modifica all'HTML necessaria)
function mostraAvvisoRete(mostra, msg) {
  let el = document.getElementById('net-warning');
  if (!mostra) { if (el) el.style.display = 'none'; return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'net-warning';
    el.style.cssText = 'margin-top:14px;padding:9px 13px;border-radius:8px;'
      + 'background:#fef3c7;color:#92400e;font-size:14px;text-align:center;';
    const box = document.getElementById('progress-box');
    if (box) box.appendChild(el);
  }
  el.textContent = msg || 'Connessione instabile, continuo a riprovare automaticamente…';
  el.style.display = 'block';
}

function pollRisultato(jobId) {
  const deadline = Date.now() + POLL_DEADLINE_MS;
  let attesa     = POLL_BASE_MS;   // intervallo corrente (cresce in backoff)
  let erroriRete = 0;              // fallimenti di rete consecutivi
  let attivo     = true;
  let timer      = null;
  let inFlight   = false;          // evita poll paralleli

  const onOffline = () => mostraAvvisoRete(true, 'Sei offline. Riprendo appena torna la connessione…');
  const onOnline  = () => { attesa = POLL_BASE_MS; erroriRete = 0; clearTimeout(timer); tick(); };
  window.addEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);

  function stop() {
    attivo = false;
    clearTimeout(timer);
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('online', onOnline);
    mostraAvvisoRete(false);
  }

  function schedule() {
    if (!attivo) return;
    clearTimeout(timer);
    timer = setTimeout(tick, attesa);
  }

  async function tick() {
    if (!attivo || inFlight) return;

    if (Date.now() > deadline) {
      stop();
      mostraErrore("L'analisi sta richiedendo troppo tempo. Riprova più tardi: se hai già pagato riceverai comunque il report via email.");
      resetForm();
      return;
    }
    // Offline: non interrogo il server, aspetto l'evento 'online' per ripartire
    if (navigator.onLine === false) {
      mostraAvvisoRete(true, 'Sei offline. Riprendo appena torna la connessione…');
      return;
    }

    inFlight = true;
    const ctrl = new AbortController();
    const reqTimeout = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${jobId}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      // Richiesta riuscita → la rete è tornata stabile: azzero backoff e avviso
      erroriRete = 0;
      attesa     = POLL_BASE_MS;
      mostraAvvisoRete(false);

      if (!data.job) { schedule(); return; }
      aggiornaSteps(data.job.status);

      if (['COMPLETED', 'READY_FOR_PAYMENT', 'SCORED'].includes(data.job.status)) {
        stop();
        document.getElementById('progress-bar').style.width = '100%';
        setTimeout(() => mostraRisultato(data.job, data.immobile), 600);
        return;
      }
      if (data.job.status === 'FAILED') {
        stop();
        const raw = data.job.error || '';
        let msg = 'Analisi non completata. Riprova o contatta info@externalopinion.it.';
        if (raw.includes('ENOTFOUND') || raw.includes('ECONNREFUSED') || raw.includes('Scraping fallito'))
          msg = "Non riesco ad accedere all'URL inserito. Verifica che il link sia corretto e pubblicamente accessibile, poi riprova.";
        else if (raw.includes('timeout') || raw.includes('ETIMEDOUT'))
          msg = "Il sito dell'asta ha risposto troppo lentamente. Riprova tra qualche minuto.";
        else if (raw.includes('confidence') || raw.includes('Confidence'))
          msg = "Dati insufficienti nell'annuncio per produrre un'analisi affidabile. Prova con un URL che contenga la perizia estimativa allegata.";
        mostraErrore(msg);
        resetForm();
        return;
      }
      schedule();
    } catch (_) {
      // Errore di rete / timeout / abort: NON è un fallimento dell'analisi.
      // Ritento con backoff progressivo senza interrompere il job sul server.
      erroriRete++;
      attesa = Math.min(attesa + POLL_BASE_MS, POLL_MAX_MS);
      if (erroriRete >= 2) mostraAvvisoRete(true);
      schedule();
    } finally {
      clearTimeout(reqTimeout);
      inFlight = false;
    }
  }

  tick();
}

function mostraRisultato(job, immobile) {
  document.getElementById('progress-box').style.display = 'none';
  document.getElementById('result-box').style.display   = 'block';

  const status    = (immobile && immobile.status) || 'GIALLO';
  const colorMap  = { VERDE: '#1E8449', GIALLO: '#D4AC0D', ROSSO: '#C0392B' };
  const labelMap  = { VERDE: 'Verde — Coerente', GIALLO: 'Giallo — Attenzione', ROSSO: 'Rosso — Criticità Elevata' };
  const descMap   = {
    VERDE: "L'immobile non presenta criticità rilevanti. Puoi procedere con consapevolezza.",
    GIALLO: "Alcune anomalie rilevate. Il report completo indica cosa verificare prima di firmare.",
    ROSSO: "Rischi tecnici o normativi significativi. Fortemente consigliato approfondire prima di procedere.",
  };
  const bannerBg  = status === 'VERDE' ? '#f0faf3' : status === 'ROSSO' ? '#fdf2f0' : '#fefce8';

  document.getElementById('semaforo-banner').style.background = bannerBg;
  document.getElementById('semaforo-dot').style.background    = colorMap[status] || colorMap.GIALLO;
  document.getElementById('semaforo-label').textContent       = labelMap[status] || status;
  document.getElementById('semaforo-desc').textContent        = descMap[status]  || '';

  const coerenza = immobile && immobile.coherenceIndex != null
    ? Math.round(immobile.coherenceIndex) + '%' : '—';
  const roi = immobile && immobile.roi != null
    ? (immobile.roi * 100).toFixed(1) + '%' : '—';
  const valore = immobile && immobile.valoreAttuale
    ? '€ ' + (immobile.valoreAttuale >= 1000
        ? Math.round(immobile.valoreAttuale / 1000) + 'k'
        : Math.round(immobile.valoreAttuale))
    : '—';

  document.getElementById('m-coerenza').textContent = coerenza;
  document.getElementById('m-roi').textContent       = roi;
  document.getElementById('m-valore').textContent    = valore;
  document.getElementById('result-box').scrollIntoView({ behavior: 'smooth' });
}

async function avviaPagamento() {
  if (!currentJobId) return;
  document.getElementById('btnPaga').textContent = 'Reindirizzamento...';
  document.getElementById('btnPaga').disabled    = true;
  try {
    const emailVal = currentEmail || document.getElementById('emailInput').value.trim();
    const res  = await fetch(`${API_BASE}/api/jobs/${currentJobId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'TIER_1_SCREENING_69', email: emailVal }),
    });
    const data = await res.json();
    if (data.checkoutUrl) { window.location.href = data.checkoutUrl; }
    else throw new Error(data.error || 'Errore checkout');
  } catch (err) {
    mostraErrore('Errore pagamento: ' + err.message);
    document.getElementById('btnPaga').textContent = 'Sblocca Report Completo — € 69 →';
    document.getElementById('btnPaga').disabled    = false;
  }
}

function mostraErrore(msg) {
  document.getElementById('error-box').style.display    = 'block';
  document.getElementById('error-msg').textContent      = msg;
  document.getElementById('progress-box').style.display = 'none';
}

function resetForm() {
  document.getElementById('form-box').style.display    = 'block';
  document.getElementById('btnAnalizza').disabled      = false;
  document.getElementById('btnAnalizza').textContent   = 'Avvia Screening → € 69';
  document.getElementById('progress-bar').style.width  = '0';
}

// ── Lead tracking ──────────────────────────────────────────────────────────

function getUtmParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source:   p.get('utm_source')   || undefined,
    utm_medium:   p.get('utm_medium')   || undefined,
    utm_campaign: p.get('utm_campaign') || undefined,
  };
}

function sendLeadEvent(payload) {
  try {
    navigator.sendBeacon
      ? navigator.sendBeacon('/api/lead-event', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
      : fetch('/api/lead-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
  } catch (_) {}
}

function initLeadTracking() {
  // PAGE_VIEW — al caricamento
  sendLeadEvent({ eventType: 'PAGE_VIEW', source: 'landing', ...getUtmParams() });

  // FORM_STARTED — prima volta che l'utente tocca URL o email
  let formStartedSent = false;
  function onFormStart() {
    if (formStartedSent) return;
    formStartedSent = true;
    const email = document.getElementById('emailInput').value.trim() || undefined;
    const url   = document.getElementById('urlAsta').value.trim()    || undefined;
    sendLeadEvent({ eventType: 'FORM_STARTED', source: 'landing', email, url, ...getUtmParams() });
  }
  ['urlAsta', 'emailInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input',  onFormStart, { once: false });
      el.addEventListener('focus',  onFormStart, { once: true  });
    }
  });
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
  initScrollToButtons();
  initLeadTracking();
  document.getElementById('btnAnalizza').addEventListener('click', avviaAnalisi);
  document.getElementById('btnPaga').addEventListener('click', avviaPagamento);
});
