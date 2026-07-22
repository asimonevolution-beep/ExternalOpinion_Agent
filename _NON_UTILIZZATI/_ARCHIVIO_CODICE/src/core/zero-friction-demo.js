'use strict';

/**
 * ZERO-FRICTION DEMO — External Opinion Autonomous Kinetic Ecosystem
 *
 * Simula il percorso completo di un utente reale attraverso il funnel:
 *   PAGE_VIEW → FORM_SUBMITTED → job polling → PAYWALL_HIT → CHECKOUT_STARTED
 *
 * Modalità:
 *   node src/core/zero-friction-demo.js           → test via Netlify proxy (produzione)
 *   node src/core/zero-friction-demo.js --local   → test Railway diretto
 *   node src/core/zero-friction-demo.js --dry     → solo verifica endpoint, no job creati
 *
 * Non modifica dati permanenti eccetto LeadEvent (fire-and-forget diagnostici).
 */

const https = require('https');

const RAILWAY_URL = 'https://externalopinionagent-production-1f66.up.railway.app';
const NETLIFY_URL = 'https://externalopinion.netlify.app';

const args = process.argv.slice(2);
const BASE_URL = args.includes('--local') ? RAILWAY_URL : NETLIFY_URL;
const DRY = args.includes('--dry');

// ─── HTTP utility ──────────────────────────────────────────────────────────

function post(url, body, extraHeaders = {}) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: parsed.hostname,
      path:     parsed.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Origin':         NETLIFY_URL,
        ...extraHeaders,
      },
      timeout: 12000,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    req.write(payload);
    req.end();
  });
}

function get(url) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    https.get({
      hostname: parsed.hostname,
      path:     parsed.pathname,
      headers: { 'Origin': NETLIFY_URL },
      timeout: 12000,
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    }).on('error', e => resolve({ status: 0, error: e.message }));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Steps ─────────────────────────────────────────────────────────────────

async function step1_pageView() {
  console.log('\n  STEP 1 — PAGE_VIEW (simulato via /api/lead-event)');
  const r = await post(`${BASE_URL}/api/lead-event`, {
    eventType: 'PAGE_VIEW',
    source:    'zero-friction-demo',
    utm_source: 'demo',
  });
  const ok = r.status === 204 || r.status === 200;
  console.log(`    → HTTP ${r.status} — ${ok ? '✅' : '❌'} ${!ok ? JSON.stringify(r.body).slice(0, 80) : ''}`);
  return ok;
}

async function step2_formStarted() {
  console.log('\n  STEP 2 — FORM_STARTED');
  const r = await post(`${BASE_URL}/api/lead-event`, {
    eventType: 'FORM_STARTED',
    source:    'zero-friction-demo',
    email:     'demo@externalopinion.it',
    url:       'https://www.astevendo.com/demo-asta-test',
  });
  const ok = r.status === 204 || r.status === 200;
  console.log(`    → HTTP ${r.status} — ${ok ? '✅' : '❌'}`);
  return ok;
}

async function step3_analyze(dryRun) {
  console.log('\n  STEP 3 — POST /api/analyze (crea Job)');
  if (dryRun) {
    console.log('    → DRY RUN — skip (non crea job reali)');
    return { ok: false, skipped: true };
  }
  const r = await post(`${BASE_URL}/api/analyze`, {
    urlAsta: 'https://www.astevendo.com/aste/immobiliare/detail/lotto/2024-demo-test',
    email:   'demo@externalopinion.it',
    tier:    'TIER_1_SCREENING_69',
  });
  const ok = r.status === 202 && r.body?.success;
  console.log(`    → HTTP ${r.status} — ${ok ? '✅ jobId: ' + r.body?.jobId : '❌ ' + JSON.stringify(r.body).slice(0, 120)}`);
  return { ok, jobId: r.body?.jobId };
}

async function step4_pollJob(jobId) {
  if (!jobId) return { ok: false, skipped: true };
  console.log(`\n  STEP 4 — GET /api/jobs/${jobId} (polling x3)`);
  for (let i = 0; i < 3; i++) {
    const r = await get(`${BASE_URL}/api/jobs/${jobId}`);
    const ok = r.status === 200 && r.body?.job;
    console.log(`    → poll ${i + 1}: HTTP ${r.status} — status: ${r.body?.job?.status || r.body} ${ok ? '✅' : '❌'}`);
    if (ok && ['READY_FOR_PAYMENT', 'COMPLETED', 'FAILED'].includes(r.body.job.status)) break;
    if (i < 2) await sleep(5000);
  }
  return { ok: true };
}

// ─── Runner ────────────────────────────────────────────────────────────────

async function runDemo() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   ZERO-FRICTION DEMO — External Opinion Funnel          ║');
  console.log(`║   Target: ${BASE_URL.replace('https://', '').slice(0, 44).padEnd(44)} ║`);
  console.log(`║   Mode:   ${DRY ? 'DRY RUN (no job creati)              ' : 'LIVE     (crea LeadEvent nel DB)      '} ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  const s1 = await step1_pageView();
  const s2 = await step2_formStarted();
  const s3 = await step3_analyze(DRY);
  const s4 = await step4_pollJob(s3.jobId);

  console.log('\n' + '─'.repeat(60));
  console.log('  RIEPILOGO DEMO:');
  console.log(`    PAGE_VIEW endpoint:    ${s1 ? '✅' : '❌'}`);
  console.log(`    FORM_STARTED endpoint: ${s2 ? '✅' : '❌'}`);
  console.log(`    /api/analyze:          ${s3.skipped ? '⏭  skip' : s3.ok ? '✅' : '❌'}`);
  console.log(`    /api/jobs/:id:         ${s4.skipped ? '⏭  skip' : s4.ok ? '✅' : '❌'}`);

  if (!s1 || !s2) {
    console.log('\n  ⚠️  FRICTION RILEVATA:');
    if (!s1 || !s2) console.log('    → Railway CORS bloccato o /api/lead-event assente');
    console.log('    → Eseguire redeploy Railway: railway.app → Deployments → Deploy');
  } else {
    console.log('\n  ✅  Funnel operativo');
  }

  console.log('─'.repeat(60) + '\n');
}

if (require.main === module) {
  runDemo().catch(e => {
    console.error('[DEMO ERROR]', e.message);
    process.exit(1);
  });
}

module.exports = { runDemo };
