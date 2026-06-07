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

async function pollRisultato(jobId) {
  let tentativi = 0;
  const intervallo = setInterval(async () => {
    tentativi++;
    if (tentativi > 80) {
      clearInterval(intervallo);
      mostraErrore('Timeout analisi. Riprova più tardi.');
      resetForm();
      return;
    }
    try {
      const res  = await fetch(`${API_BASE}/api/jobs/${jobId}`);
      const data = await res.json();
      if (!data.job) return;
      aggiornaSteps(data.job.status);
      if (['COMPLETED', 'READY_FOR_PAYMENT', 'SCORED'].includes(data.job.status)) {
        clearInterval(intervallo);
        document.getElementById('progress-bar').style.width = '100%';
        setTimeout(() => mostraRisultato(data.job, data.immobile), 600);
      } else if (data.job.status === 'FAILED') {
        clearInterval(intervallo);
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
      }
    } catch (_) {}
  }, 3000);
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
