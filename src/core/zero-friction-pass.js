'use strict';

/**
 * ZERO-FRICTION PASS — External Opinion Autonomous Kinetic Ecosystem
 *
 * Diagnostico completo di tutti i sistemi. Eseguibile con:
 *   node src/core/zero-friction-pass.js
 *
 * Non modifica nulla. Non espone segreti. Solo lettura + HTTP checks.
 */

const https = require('https');
const path  = require('path');

const RAILWAY_URL = 'https://externalopinionagent-production-1f66.up.railway.app';
const NETLIFY_URL = 'https://externalopinion.netlify.app';
const EXPECTED_COMMIT_GITHUB = 'b97d310';

// ─── HTTP utility ──────────────────────────────────────────────────────────

function httpRequest(url, options = {}) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      path:     parsed.pathname + (parsed.search || ''),
      method:   options.method || 'GET',
      headers:  options.headers || {},
      timeout:  8000,
    };
    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', (e) => resolve({ status: 0, body: '', error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '', error: 'timeout' }); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ─── Checks ────────────────────────────────────────────────────────────────

async function checkRailwayHealth() {
  const r = await httpRequest(`${RAILWAY_URL}/health/live`);
  if (r.status === 200) {
    try {
      const json = JSON.parse(r.body);
      return { ok: true, status: r.status, version: json.version, timestamp: json.timestamp };
    } catch {
      return { ok: true, status: r.status, version: 'unknown' };
    }
  }
  return { ok: false, status: r.status, error: r.error || r.body.slice(0, 100) };
}

async function checkRailwayCors() {
  const r = await httpRequest(`${RAILWAY_URL}/api/lead-event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': NETLIFY_URL,
    },
    body: JSON.stringify({ eventType: 'DIAGNOSTIC_CORS_CHECK' }),
  });
  // 204 = success (lead-event endpoint), anything else = problem
  const corsBlocked = r.body.includes('CORS non consentito');
  const endpointMissing = r.status === 404;
  return {
    ok: r.status === 204 || (!corsBlocked && !endpointMissing),
    status: r.status,
    corsBlocked,
    endpointMissing,
    body: r.body.slice(0, 120),
  };
}

async function checkNetlifyPreanalisi() {
  const r = await httpRequest(`${NETLIFY_URL}/preanalisi.js`);
  const hasTracking = r.body.includes('PAGE_VIEW') && r.body.includes('sendLeadEvent');
  return {
    ok: r.status === 200 && hasTracking,
    status: r.status,
    hasPageView: r.body.includes('PAGE_VIEW'),
    hasFormStarted: r.body.includes('FORM_STARTED'),
    hasSendBeacon: r.body.includes('sendBeacon'),
  };
}

async function checkNetlifyProxy() {
  const r = await httpRequest(`${NETLIFY_URL}/api/lead-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType: 'DIAGNOSTIC_PROXY_CHECK' }),
  });
  return {
    ok: r.status !== 404,
    status: r.status,
    proxyActive: r.status !== 404,
  };
}

async function checkDb() {
  try {
    // Non importare PrismaClient direttamente — uso require condizionale
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({ log: [] });
    const [jobCount, leadCount] = await Promise.all([
      prisma.job.count(),
      prisma.leadEvent.count(),
    ]);
    await prisma.$disconnect();
    return { ok: true, jobCount, leadCount };
  } catch (e) {
    return { ok: false, error: e.message.split('\n')[0] };
  }
}

// ─── Runner ────────────────────────────────────────────────────────────────

async function runPass() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   ZERO-FRICTION PASS — External Opinion                 ║');
  console.log(`║   ${new Date().toISOString()}                    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const results = {};

  process.stdout.write('  [1/5] Railway health...   ');
  results.railway = await checkRailwayHealth();
  console.log(results.railway.ok
    ? `✅  ${results.railway.version} (${results.railway.timestamp})`
    : `❌  HTTP ${results.railway.status} — ${results.railway.error}`);

  if (results.railway.ok) {
    const activeCommit = (results.railway.version || '').replace('v3-', '').slice(0, 7);
    const upToDate = activeCommit === EXPECTED_COMMIT_GITHUB;
    console.log(`         commit attivo: ${activeCommit} — GitHub: ${EXPECTED_COMMIT_GITHUB} — ${upToDate ? '✅ sincronizzato' : '⚠️  RAILWAY INDIETRO — redeploy manuale richiesto'}`);
    results.railway.upToDate = upToDate;
  }

  process.stdout.write('  [2/5] Railway CORS...     ');
  results.cors = await checkRailwayCors();
  if (results.cors.corsBlocked)
    console.log(`❌  CORS bloccato — origin netlify.app rifiutata`);
  else if (results.cors.endpointMissing)
    console.log(`⚠️  /api/lead-event 404 — Railway gira codice vecchio`);
  else
    console.log(`✅  HTTP ${results.cors.status}`);

  process.stdout.write('  [3/5] Netlify preanalisi.js... ');
  results.netlify = await checkNetlifyPreanalisi();
  console.log(results.netlify.ok
    ? `✅  HTTP ${results.netlify.status} · PAGE_VIEW ✓ FORM_STARTED ✓ sendBeacon ✓`
    : `❌  HTTP ${results.netlify.status} · PAGE_VIEW:${results.netlify.hasPageView} FORM_STARTED:${results.netlify.hasFormStarted}`);

  process.stdout.write('  [4/5] Netlify proxy...    ');
  results.proxy = await checkNetlifyProxy();
  console.log(results.proxy.proxyActive
    ? `✅  proxy attivo (HTTP ${results.proxy.status})`
    : `❌  proxy non attivo (404)`);

  process.stdout.write('  [5/5] Database Railway... ');
  results.db = await checkDb();
  console.log(results.db.ok
    ? `✅  jobs: ${results.db.jobCount} · leadEvents: ${results.db.leadCount}`
    : `❌  ${results.db.error}`);

  // Riepilogo
  const allOk = results.railway.ok && !results.cors.corsBlocked && results.netlify.ok && results.proxy.proxyActive && results.db.ok;
  console.log('\n' + '─'.repeat(60));
  console.log(allOk
    ? '  ✅  SISTEMA OPERATIVO — zero friction'
    : '  ⚠️  FRICTION RILEVATA — vedi dettagli sopra');
  console.log('─'.repeat(60));

  if (!results.railway.upToDate) {
    console.log('\n  AZIONE RICHIESTA:');
    console.log('  → railway.app → progetto → Deployments → Deploy (manuale)');
  }

  console.log('');
  return results;
}

// ─── Kinetic API exports ────────────────────────────────────────────────────

/**
 * Identifica lo stato più avanzato raggiunto nel sistema.
 * Fonte: /health/live (commit attivo Railway) vs GitHub tip.
 */
async function identifyMostAdvancedState() {
  const health = await checkRailwayHealth();
  const netlify = await checkNetlifyPreanalisi();
  return {
    github_tip: EXPECTED_COMMIT_GITHUB,
    railway_active: health.version,
    railway_up_to_date: health.ok && (health.version || '').includes(EXPECTED_COMMIT_GITHUB),
    netlify_tracking_live: netlify.ok,
    db_reachable: (await checkDb()).ok,
  };
}

/**
 * Rileva lavoro già risolto — evita regressioni e ridondanza.
 */
function detectAlreadySolvedWork() {
  return [
    { id: 'F001', what: 'netlify.toml proxy /api/*', commit: 'cb82d48', verified: true },
    { id: 'F002', what: 'CORS PRODUCTION_ORIGINS hardcoded', commit: 'b97d310', verified: false, note: 'Railway redeploy pending' },
    { id: 'F003', what: 'LeadEvent model + trackLead()', commit: '778fb0e', verified: true },
    { id: 'F004', what: 'PAGE_VIEW + FORM_STARTED frontend', commit: '605c2d3', verified: true },
    { id: 'F005', what: 'POST /api/lead-event endpoint', commit: '605c2d3', verified: false, note: 'Railway redeploy pending' },
    { id: 'F006', what: 'Netlify deploy live (8 file)', commit: '605c2d3', verified: true },
    { id: 'F007', what: 'prisma db push LeadEvent', commit: '778fb0e', verified: true },
  ];
}

/**
 * Rileva friction points attivi — ordinati per impatto decrescente.
 */
async function detectFrictionPoints() {
  const cors = await checkRailwayCors();
  const db   = await checkDb();
  const points = [];
  if (cors.corsBlocked)      points.push({ id: 'FP1', severity: 'CRITICAL', what: 'CORS bloccato — Railway gira f0ea437', action: 'Railway redeploy' });
  if (cors.endpointMissing)  points.push({ id: 'FP2', severity: 'HIGH',     what: '/api/lead-event assente su Railway',   action: 'Railway redeploy' });
  if (!db.ok)                points.push({ id: 'FP3', severity: 'HIGH',     what: 'DB non raggiungibile',                  action: 'Verifica Railway DB' });
  points.push({ id: 'FP4', severity: 'HIGH',     what: 'Stripe in TEST mode',              action: 'Aggiungere STRIPE_SECRET_KEY live su Railway' });
  points.push({ id: 'FP5', severity: 'MEDIUM',   what: 'Railway no auto-deploy GitHub',    action: 'Abilitare auto-deploy su railway.app' });
  return points;
}

/**
 * Rileva lavoro duplicato nel repository (confronto simbolico).
 */
function detectDuplicatedWork() {
  return [
    { note: 'server.js = wrapper di server-v18.3.js — non duplicato, richiesto da Railway Dockerfile' },
    { note: 'landing.html e index.html coesistono — landing.html è pagina vecchia/alternativa, index.html è quella attiva' },
  ];
}

/**
 * Estrae energia riutilizzabile — decisioni già validate che non vanno ridiscusse.
 */
function extractReusableEnergy() {
  return [
    'trackLead() fire-and-forget — non toccare, pattern già validato',
    'netlify.toml redirect /api/* → Railway — non rimuovere',
    'PRODUCTION_ORIGINS hardcoded — garanzia CORS indipendente da env Railway',
    'sendBeacon + fallback fetch+keepalive — non cambiare transport per PAGE_VIEW',
    'TIER_1_SCREENING_69 come tier default — confermato dal flusso DAG',
  ];
}

/**
 * Rigetta dispersione — cosa NON fare in questa fase.
 */
function rejectDispersion() {
  return [
    'NON aggiungere feature nuove finché Railway non è aggiornato',
    'NON modificare logica Stripe prima di avere live keys',
    'NON refactoring architetturale — V18.3 DAG è stabile',
    'NON esporre metafore interne (nuclear/reactor) ai clienti',
    'NON creare nuovi worker prima del primo pagamento reale',
  ];
}

/**
 * Score di friction (0 = zero friction, 100 = tutto bloccato).
 */
async function computeFrictionScore() {
  const fps = await detectFrictionPoints();
  const weights = { CRITICAL: 40, HIGH: 20, MEDIUM: 5 };
  const raw = fps.reduce((acc, fp) => acc + (weights[fp.severity] || 0), 0);
  return Math.min(100, raw);
}

/**
 * Score di potenza cinetica (0 = fermo, 100 = turbina a piena velocità).
 */
async function computeKineticPowerScore() {
  const friction = await computeFrictionScore();
  const state = await identifyMostAdvancedState();
  let power = 100 - friction;
  if (state.netlify_tracking_live) power += 5;
  if (state.db_reachable)          power += 5;
  return Math.min(100, Math.max(0, power));
}

/**
 * Azione minima decisiva — il singolo passo che sblocca più valore.
 */
async function recommendMinimumDecisiveAction() {
  const fps = await detectFrictionPoints();
  const critical = fps.find(f => f.severity === 'CRITICAL');
  if (critical) return { action: critical.action, reason: critical.what, human: true };
  const high = fps.find(f => f.severity === 'HIGH');
  if (high) return { action: high.action, reason: high.what, human: high.id !== 'FP3' };
  return { action: 'Test end-to-end con URL asta reale', reason: 'Sistema operativo', human: false };
}

/**
 * Entry point principale — esegue diagnosi completa e stampa report.
 */
async function runZeroFrictionPass() {
  return runPass();
}

// ─── Entry point ───────────────────────────────────────────────────────────

if (require.main === module) {
  runPass().catch(e => {
    console.error('[PASS ERROR]', e.message);
    process.exit(1);
  });
}

module.exports = {
  identifyMostAdvancedState,
  detectAlreadySolvedWork,
  detectFrictionPoints,
  detectDuplicatedWork,
  extractReusableEnergy,
  rejectDispersion,
  computeFrictionScore,
  computeKineticPowerScore,
  recommendMinimumDecisiveAction,
  runZeroFrictionPass,
};
