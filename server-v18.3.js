'use strict';
require('events').EventEmitter.defaultMaxListeners = 50;
require('dotenv').config();
const express     = require('express');
const path        = require('path');
const cors        = require('cors');
const compression = require('compression');
const morgan      = require('morgan');
// ============================================================================
// STARTUP ENV VALIDATION
// ============================================================================

(function checkEnv() {
  const missing = [];
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DATABASE_PRIVATE_URL)
    missing.push('DATABASE_URL — Prisma non si connetterà al database PostgreSQL');
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST)
    missing.push('REDIS_URL — BullMQ userà 127.0.0.1:6379 (solo sviluppo locale)');
  if (!process.env.ANTHROPIC_API_KEY)
    missing.push('ANTHROPIC_API_KEY — Le analisi AI falliranno con 401');
  if (missing.length > 0) {
    console.warn('[ENV] Variabili mancanti o non configurate in produzione:');
    missing.forEach(v => console.warn('  WARN:', v));
  }
})();

// ============================================================================
// SECURITY & OBSERVABILITY IMPORTS
// ============================================================================

const {
  securityMiddleware,
  globalLimiter,
  analyzeApiLimiter,
  checkoutLimiter,
  metricsMiddleware,
  initSentry,
  sentryErrorHandler,
  healthCheckEndpoints,
} = require('./middleware-security');

// ============================================================================
// DAG & ORCHESTRATOR IMPORTS
// ============================================================================

const {
  createAnalysisPipeline,
} = require('./dag-orchestrator');

const {
  validateClientToken,
  createJob,
  getJob,
  updateJobStatus,
} = require('./orchestrator');

const {
  createCheckoutSession,
  getSessionStatus,
  router: stripeRouter,
} = require('./stripe-webhook-handler');

const {
  startSubscriber,
  getSSERouter,
} = require('./realtime-hub');

const {
  hashInput,
  validateVerdict,
  verdictValidationMiddleware,
} = require('./src/engines/edv');

const { trackLead } = require('./lead-tracker');

// ============================================================================
// APP INITIALIZATION
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3000;

// Global handlers per evitare crash da eccezioni non gestite
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// Sentry early init
initSentry(app);

// Trust proxy (Nginx in front of Express)
app.set('trust proxy', 1);

// Security hardening
securityMiddleware(app);

// Standard middleware
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS non consentito'));
    }
  },
  credentials: true,
}));
app.use(compression());
app.use(morgan('combined'));

// Stripe webhook — deve ricevere il body RAW prima di express.json()
app.use('/api/stripe', stripeRouter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Global rate limiter
app.use(globalLimiter);

// Serve frontend statico
app.use(express.static(path.join(__dirname, 'public')));

// Metrics collection
metricsMiddleware(app);

// ============================================================================
// HEALTHCHECK ENDPOINTS
// ============================================================================

healthCheckEndpoints(app);

// Versione deploy â€” per diagnostica
// Versione dinamica da git HEAD o variabile Railway
const { execSync } = require('child_process');
const GIT_HASH = (() => { try { return execSync('git rev-parse --short HEAD', { stdio: 'pipe' }).toString().trim(); } catch(_) { return process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0,7) || 'unknown'; } })();
const BUILD_TIME = new Date().toISOString();
app.get('/api/version', (req, res) => res.json({
  version: GIT_HASH,
  built: BUILD_TIME,
  node: process.version,
  env: process.env.NODE_ENV || 'development',
  db: process.env.DATABASE_URL ? 'configured' : 'MISSING — aggiungi PostgreSQL su Railway',
  redis: process.env.REDIS_URL ? 'configured' : 'local 127.0.0.1',
}));

// Setup checker — mostra cosa manca per far funzionare la produzione
app.get('/api/setup', (req, res) => {
  const checks = [
    { name: 'DATABASE_URL', ok: !!process.env.DATABASE_URL, fix: 'Railway dashboard → Add PostgreSQL service → viene impostata automaticamente' },
    { name: 'REDIS_URL', ok: !!process.env.REDIS_URL, fix: 'Railway dashboard → Add Redis service → viene impostata automaticamente' },
    { name: 'ANTHROPIC_API_KEY', ok: !!process.env.ANTHROPIC_API_KEY, fix: 'console.anthropic.com → API Keys → copia chiave' },
    { name: 'STRIPE_SECRET_KEY', ok: !!process.env.STRIPE_SECRET_KEY, fix: 'dashboard.stripe.com → Developers → API keys' },
    { name: 'STRIPE_WEBHOOK_SECRET', ok: !!process.env.STRIPE_WEBHOOK_SECRET, fix: 'Stripe → Webhooks → endpoint: /api/stripe/webhook → copia signing secret' },
    { name: 'ADMIN_TOKEN', ok: !!process.env.ADMIN_TOKEN, fix: 'Imposta una stringa casuale sicura (min 32 chars)' },
    { name: 'SMTP_HOST', ok: !!process.env.SMTP_HOST, fix: 'Gmail: smtp.gmail.com | SMTP_PORT=587 | SMTP_USER=tua@gmail.com | SMTP_PASS=app-password (Google → Sicurezza → Password app)' },
  ];
  const allOk = checks.every(c => c.ok);
  res.status(allOk ? 200 : 503).json({
    ready: allOk,
    checks: checks.map(c => ({ name: c.name, status: c.ok ? '✅ OK' : '❌ MANCANTE', fix: c.ok ? null : c.fix })),
    hint: allOk ? 'Produzione pronta!' : 'Imposta le variabili mancanti su Railway → Settings → Variables',
  });
});

// ============================================================================
// API ROUTES
// ============================================================================

const apiRouter = express.Router();

const { runDeterministicInference, buildNarrativeAndFindings } = require('./src/engines/core-engine-v13.4');

/**
 * POST /api/v1/preanalisi — Free pre-screening (frontend public form)
 * Core Engine v13.4.0, zero AI, no auth required.
 */
apiRouter.post('/v1/preanalisi', analyzeApiLimiter, (req, res) => {
  try {
    const { tipo, zona, prezzo, mq, anno, stato, note, plan } = req.body;
    if (!zona || !prezzo || !mq || prezzo < 1000 || mq < 10) {
      return res.status(400).json({ success: false, error: 'Campi obbligatori: zona, prezzo, mq' });
    }
    const payload = { tipo, zona, prezzo: Number(prezzo), mq: Number(mq), anno, stato, note: note || '', plan };
    const inference = runDeterministicInference(payload);
    const { narrative, findings } = buildNarrativeAndFindings(payload, inference);
    return res.json({ success: true, ...inference, narrative, findings, engine: 'core-engine-v13.4.0' });
  } catch (err) {
    console.error('[PREANALISI]', err.message);
    return res.status(500).json({ success: false, error: 'Errore interno' });
  }
});

/**
 * POST /api/analyze â€” Create analysis job (non-blocking with DAG)
 */
apiRouter.post(
  '/analyze',
  analyzeApiLimiter,
  async (req, res) => {
    const { urlAsta, email, token, service, zonaDati = {}, tier = 'TIER_1_CASCADE_79' } = req.body;

    try {
      // Validazione
      if (!urlAsta) {
        return res.status(400).json({
          success: false,
          error: 'urlAsta Ã¨ obbligatorio',
        });
      }

      // Token validation (opzionale)
      if (token) {
        try {
          await validateClientToken(token, service);
        } catch (err) {
          return res.status(401).json({
            success: false,
            error: err.message,
          });
        }
      }

      // Hash deterministico dell'input per audit trail / idempotency
      const inputHash = hashInput({ urlAsta, email, service, tier, zonaDati });

      // Traccia il lead PRIMA della creazione del Job (anche se createJob fallisce)
      trackLead({
        eventType: 'FORM_SUBMITTED',
        email,
        url: urlAsta,
        tier,
        ip: req.ip,
        source: req.get('referer') || 'direct',
        metadata: { service, inputHash },
      });

      // Crea Job (atomic transaction)
      const jobRecord = await createJob({
        url: urlAsta,
        email,
        token,
        service,
        zonaDati,
      });

      console.log(`[API] Job created: ${jobRecord.id} | inputHash: ${inputHash}`);

      // Traccia il job creato (collega jobId al lead)
      trackLead({
        eventType: 'JOB_CREATED',
        email,
        url: urlAsta,
        tier,
        jobId: jobRecord.id,
        ip: req.ip,
        source: req.get('referer') || 'direct',
      });

      // ===== CREA DAG PIPELINE =====
      await createAnalysisPipeline(jobRecord.id, jobRecord.payload, tier);

      // HTTP 202 ACCEPTED - Job enqueued
      return res.status(202).json({
        success: true,
        jobId: jobRecord.id,
        inputHash,
        status: 'PENDING',
        createdAt: jobRecord.createdAt,
        pollingUrl: `/api/jobs/${jobRecord.id}`,
        checkoutUrl: `/api/jobs/${jobRecord.id}/checkout`,
        streamUrl: `/api/stream/${jobRecord.id}`,
      });
    } catch (err) {
      console.error(`[API] Error creating job:`, err.message);
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

/**
 * GET /api/jobs/:jobId â€” Poll job status
 */
apiRouter.get('/jobs/:jobId', async (req, res) => {
  const { jobId } = req.params;

  try {
    const jobRecord = await getJob(jobId);

    if (!jobRecord) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    const responseData = {
      success: true,
      job: {
        id: jobRecord.id,
        status: jobRecord.status,
        createdAt: jobRecord.createdAt,
        updatedAt: jobRecord.updatedAt,
        url: jobRecord.url,
      },
    };

    // Includi immobile data se completato
    if (jobRecord.immobile) {
      responseData.immobile = {
        id: jobRecord.immobile.id,
        status: jobRecord.immobile.status,
        coherenceIndex: jobRecord.immobile.coherenceIndex,
        roi: jobRecord.immobile.roi,
        roiConveniente: jobRecord.immobile.roiConveniente,
        datiComputati: jobRecord.immobile.datiComputati,
        hashReport: jobRecord.immobile.hashReport,
        pagato: jobRecord.immobile.pagato,
        livelloCommerciale: jobRecord.immobile.livelloCommerciale,
      };
    }

    // Includi audit events
    if (jobRecord.jobEvents?.length > 0) {
      responseData.events = jobRecord.jobEvents.map((evt) => ({
        type: evt.eventType,
        timestamp: evt.timestamp,
        workerId: evt.workerId,
      }));
    }

    return res.json(responseData);
  } catch (err) {
    console.error(`[API] Error retrieving job:`, err.message);
    return res.status(500).json({
      success: false,
      error: 'Error retrieving job',
    });
  }
});

/**
 * GET /api/jobs/:jobId/report — Download PDF report
 * Accesso libero se job COMPLETED; in produzione aggiungere gate pagamento
 */
apiRouter.get('/jobs/:jobId/report', async (req, res) => {
  const { jobId } = req.params;
  try {
    const jobRecord = await getJob(jobId);
    if (!jobRecord) return res.status(404).json({ success: false, error: 'Job non trovato' });
    if (jobRecord.status !== 'COMPLETED' && jobRecord.status !== 'REPORT_READY') {
      return res.status(202).json({ success: false, error: 'Report non ancora pronto', status: jobRecord.status });
    }

    const pdfPath = path.join(__dirname, 'src', 'workers', 'OUTPUT_REPORT', `report_${jobId}.pdf`);
    if (!require('fs').existsSync(pdfPath)) {
      return res.status(404).json({ success: false, error: 'File PDF non trovato su disco' });
    }

    const filename = `ExternalOpinion_${jobId.substring(0, 8)}.pdf`;
    return res.download(pdfPath, filename);
  } catch (err) {
    console.error('[API] Error serving report:', err.message);
    return res.status(500).json({ success: false, error: 'Errore nel recupero del report' });
  }
});

/**
 * POST /api/jobs/:jobId/checkout â€” Initiate Stripe payment
 */
apiRouter.post(
  '/jobs/:jobId/checkout',
  checkoutLimiter,
  async (req, res) => {
    const { jobId } = req.params;
    const { tier, email } = req.body;

    try {
      // Validazione tier
      const validTiers = [
        'TIER_1_CASCADE_79',
        'TIER_1_SCREENING_69',
        'TIER_1_ENTRY_89',
        'TIER_2_ADVISORY_150',
        'TIER_3_PREMIUM_690',
        'TIER_4_ENTERPRISE_API',
      ];

      if (!validTiers.includes(tier)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tier',
        });
      }

      // Verifica job
      const jobRecord = await getJob(jobId);
      if (!jobRecord) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
        });
      }

      // Traccia il raggiungimento del paywall
      const jobPayload = (() => { try { return JSON.parse(jobRecord.payload || '{}'); } catch { return {}; } })();
      trackLead({
        eventType: 'PAYWALL_HIT',
        email:  email || jobPayload.email,
        url:    jobPayload.url || jobPayload.urlAsta,
        tier,
        jobId,
        ip: req.ip,
      });

      // Crea Stripe session
      const checkoutSession = await createCheckoutSession(jobId, tier, email);

      // Traccia apertura checkout Stripe
      trackLead({
        eventType: 'CHECKOUT_STARTED',
        email:  email || jobPayload.email,
        url:    jobPayload.url || jobPayload.urlAsta,
        tier,
        jobId,
        ip: req.ip,
        metadata: { sessionId: checkoutSession.id },
      });

      return res.json({
        success: true,
        sessionId: checkoutSession.id,
        checkoutUrl: checkoutSession.url,
        amount: checkoutSession.amount_total / 100,
        tier,
      });
    } catch (err) {
      console.error(`[API] Error creating checkout:`, err.message);
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

/**
 * GET /api/checkout/:sessionId â€” Get payment status
 */
apiRouter.get('/checkout/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const sessionStatus = await getSessionStatus(sessionId);

    return res.json({
      success: true,
      session: sessionStatus,
      isPaid: sessionStatus.status === 'paid',
    });
  } catch (err) {
    console.error(`[API] Error retrieving session:`, err.message);
    return res.status(500).json({
      success: false,
      error: 'Error retrieving payment status',
    });
  }
});

/**
 * POST /api/lead-event — Tracciamento frontend (PAGE_VIEW, FORM_STARTED, ecc.)
 * Fire-and-forget: risponde sempre 204, non blocca il frontend.
 */
apiRouter.post('/lead-event', async (req, res) => {
  res.sendStatus(204); // risponde subito, senza aspettare il DB
  const { eventType, source, email, url, tier,
          utm_source, utm_medium, utm_campaign } = req.body || {};
  if (!eventType) return;
  trackLead({
    eventType: String(eventType).slice(0, 64),
    email:  email  || null,
    url:    url    || null,
    tier:   tier   || null,
    ip:     req.ip || null,
    source: source || null,
    metadata: {
      utm_source:   utm_source   || null,
      utm_medium:   utm_medium   || null,
      utm_campaign: utm_campaign || null,
    },
  });
});

// Mount API router
app.use('/api', apiRouter);

// Demo paywall routes — mock analyze + notifica ntfy
app.use('/api/demo', require('./demo-router'));

// Mount SSE real-time hub — stream aggiornamenti verso portali e dispositivi
app.use('/api', getSSERouter());

// ============================================================================
// ADMIN ROUTES â€” Pannello revisione per Simone
// ============================================================================

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  console.error('[FATAL] ADMIN_TOKEN non configurato — le route /admin sono disabilitate');
}

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(503).json({ error: 'Admin non configurato' });
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!token || token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// GET /admin/review â€” lista report in attesa
app.get('/admin/review', requireAdmin, async (req, res) => {
  try {
    const { getPendingReviews } = require('./review-queue');
    const pending = await getPendingReviews();
    res.json({ success: true, count: pending.length, items: pending });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /admin/review/:jobId â€” singolo report
app.get('/admin/review/:jobId', requireAdmin, async (req, res) => {
  try {
    const { getReviewByJobId } = require('./review-queue');
    const review = await getReviewByJobId(req.params.jobId);
    if (!review) return res.status(404).json({ error: 'Not found' });

    // Serve la pagina HTML di revisione
    const aiReport = JSON.parse(review.aiReport || '{}');
    res.send(`<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8">
<title>Revisione Report â€” ${req.params.jobId}</title>
<style>
  body { font-family: monospace; background: #f5f0e8; color: #1a1612; padding: 2rem; max-width: 900px; margin: 0 auto; }
  h1 { border-bottom: 2px solid #1a1612; padding-bottom: 0.5rem; }
  .report { background: #fff; padding: 1.5rem; border: 1px solid #ccc; white-space: pre-wrap; font-size: 13px; max-height: 500px; overflow: auto; }
  textarea { width: 100%; height: 120px; padding: 0.5rem; font-family: monospace; margin-top: 1rem; }
  .btn { padding: 0.8rem 1.5rem; border: none; cursor: pointer; font-weight: bold; margin-right: 1rem; }
  .approve { background: #1e8449; color: #fff; }
  .reject { background: #c0392b; color: #fff; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
  .PENDING { background: #f0ad4e; } .APPROVED { background: #1e8449; color:#fff; } .REJECTED { background: #c0392b; color:#fff; }
</style></head><body>
<h1>ðŸ“‹ Revisione Report</h1>
<p><strong>Job ID:</strong> ${review.jobId}</p>
<p><strong>Stato:</strong> <span class="status ${review.status}">${review.status}</span></p>
<p><strong>Creato:</strong> ${new Date(review.createdAt).toLocaleString('it-IT')}</p>
<h2>Report AI:</h2>
<div class="report">${JSON.stringify(aiReport, null, 2)}</div>
<form id="reviewForm">
  <label><strong>Note revisione (opzionale):</strong></label>
  <textarea id="notes" placeholder="Aggiungi note professionali, correzioni, osservazioni...">${review.reviewerNotes || ''}</textarea>
  <div style="margin-top:1rem;">
    <button type="button" class="btn approve" onclick="submitReview('approve')">âœ… Approva e invia al cliente</button>
    <button type="button" class="btn reject" onclick="submitReview('reject')">âŒ Rifiuta</button>
  </div>
</form>
<script>
async function submitReview(action) {
  const notes = document.getElementById('notes').value;
  const token = sessionStorage.getItem('adminToken') || prompt('Admin token:');
  if (!token) return;
  sessionStorage.setItem('adminToken', token);
  const r = await fetch('/admin/review/${req.params.jobId}/' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify({ notes })
  });
  const d = await r.json();
  if (r.status === 401) { sessionStorage.removeItem('adminToken'); alert('Token non valido'); return; }
  alert(d.success ? 'Fatto!' : 'Errore: ' + d.error);
  if (d.success) location.reload();
}
</script></body></html>`);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /admin/review/:jobId/approve
app.post('/admin/review/:jobId/approve', requireAdmin, async (req, res) => {
  try {
    const { approveReport } = require('./review-queue');
    await approveReport(req.params.jobId, req.body.notes || '');
    res.json({ success: true, message: 'Report approvato e cliente notificato' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /admin/review/:jobId/reject
app.post('/admin/review/:jobId/reject', requireAdmin, async (req, res) => {
  try {
    const { rejectReport } = require('./review-queue');
    await rejectReport(req.params.jobId, req.body.notes || 'Rifiutato');
    res.json({ success: true, message: 'Report rifiutato' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /admin/crawler/run â€” lancia crawler manuale
app.post('/admin/crawler/run', requireAdmin, async (req, res) => {
  res.json({ success: true, message: 'Crawler avviato in background' });
  const { runCrawler } = require('./portal-crawler');
  runCrawler({ maxPerPortal: req.body.maxPerPortal || 10 })
    .then(r => console.log('[ADMIN] Crawler completato:', r))
    .catch(e => console.error('[ADMIN] Crawler error:', e.message));
});

// GET /admin/crawler/status â€” aste scoperte
app.get('/admin/crawler/status', requireAdmin, async (req, res) => {
  try {
    const prismaClient = require('./db');
    const stats = await prismaClient.discoveredAuction.groupBy({
      by: ['status'],
      _count: true,
    });
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /admin/simulate-payment/:jobId — solo in development, simula pagamento Stripe
if (process.env.NODE_ENV !== 'production') {
  app.post('/admin/simulate-payment/:jobId', requireAdmin, async (req, res) => {
    try {
      const { jobId } = req.params;
      const prismaClient = require('./db');
      const jobRecord = await prismaClient.job.findUnique({ where: { id: jobId } });
      if (!jobRecord) return res.status(404).json({ error: 'Job non trovato' });
      if (jobRecord.status !== 'READY_FOR_PAYMENT' && jobRecord.status !== 'SCORED') {
        return res.status(400).json({ error: `Job in stato ${jobRecord.status} — deve essere READY_FOR_PAYMENT` });
      }
      const email = JSON.parse(jobRecord.payload || '{}').email || req.body.email || 'test@externalopinion.it';
      const tier = req.body.tier || 'TIER_1_SCREENING_69';
      await prismaClient.immobile.update({
        where: { jobId },
        data:  { pagato: true, livelloCommerciale: tier },
      });
      const { getFlowProducer } = require('./dag-orchestrator');
      await getFlowProducer().add({
        name: `notifyJob-sim-${jobId}`,
        queueName: 'notificationQueue',
        data: { jobId, email, tier },
        opts: { attempts: 2, backoff: { type: 'exponential', delay: 3000 } },
        children: [{
          name: `reportJob-sim-${jobId}`,
          queueName: 'reportRenderQueue',
          data: { jobId, tier },
          opts: { attempts: 2 },
        }],
      });
      console.log(`[ADMIN] Pagamento simulato per ${jobId} — report+notify in coda`);
      res.json({ success: true, jobId, email, tier, message: 'Pagamento simulato — report PDF in generazione, email in arrivo' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

// ============================================================================
// ADMIN STATS DASHBOARD
// ============================================================================

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const prismaClient = require('./db');
    const now = new Date();
    const since24h = new Date(now - 24 * 60 * 60 * 1000);
    const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
      totalJobs,
      jobsUltimi30g,
      jobsUltime24h,
      jobsPerStatus,
      jobsPagati,
      avgCoherence,
      topUrls,
    ] = await Promise.all([
      prismaClient.job.count(),
      prismaClient.job.count({ where: { createdAt: { gte: since30d } } }),
      prismaClient.job.count({ where: { createdAt: { gte: since24h } } }),
      prismaClient.job.groupBy({ by: ['status'], _count: true }),
      prismaClient.immobile.count({ where: { pagato: true } }),
      prismaClient.immobile.aggregate({ _avg: { coherenceIndex: true } }),
      prismaClient.job.groupBy({
        by: ['url'],
        _count: true,
        orderBy: { _count: { url: 'desc' } },
        take: 5,
      }),
    ]);

    const revenueStimata = jobsPagati * 79;
    const statusMap = {};
    jobsPerStatus.forEach(s => { statusMap[s.status] = s._count; });

    // Modelli AI usati (da metadata degli eventi)
    const aiModels = await prismaClient.jobEvent.findMany({
      where: { eventType: 'LLM_PARSE_COMPLETED', timestamp: { gte: since30d } },
      select: { metadata: true },
      take: 500,
    });
    const modelStats = {};
    aiModels.forEach(e => {
      try {
        const meta = JSON.parse(e.metadata || '{}');
        const m = meta.model || 'unknown';
        modelStats[m] = (modelStats[m] || 0) + 1;
      } catch (_) {}
    });

    res.json({
      timestamp: now.toISOString(),
      pipeline: {
        totale: totalJobs,
        ultimi30giorni: jobsUltimi30g,
        ultime24ore: jobsUltime24h,
        perStatus: statusMap,
        coherenceMedia: Math.round((avgCoherence._avg.coherenceIndex || 0) * 10) / 10,
      },
      monetizzazione: {
        jobPagati: jobsPagati,
        revenueStimata: `€${revenueStimata}`,
        conversionRate: totalJobs > 0 ? `${Math.round((jobsPagati / totalJobs) * 100)}%` : '0%',
      },
      ai: {
        modelsUsed: modelStats,
        modelloPreferito: Object.entries(modelStats).sort((a,b) => b[1]-a[1])[0]?.[0] || 'claude-haiku',
        fallbackChain: ['claude-haiku', 'gemini-2.0-flash', 'qwen-plus', 'gpt-4-turbo', 'ollama'],
      },
      topUrls: topUrls.map(u => ({ url: u.url.slice(0, 80), count: u._count })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/ai-status — stato configurazione backend AI
app.get('/api/admin/ai-status', requireAdmin, (req, res) => {
  const backends = [
    { nome: 'Claude (Anthropic)', key: 'ANTHROPIC_API_KEY',  modello: 'claude-haiku-4-5-20251001', costo: '$0.0013/analisi', primario: true  },
    { nome: 'Gemini (Google)',    key: 'GOOGLE_API_KEY',      modello: 'gemini-2.0-flash',          costo: '$0.0001/analisi', primario: false },
    { nome: 'Qwen (Alibaba)',     key: 'DASHSCOPE_API_KEY',   modello: 'qwen-plus',                 costo: '$0.0006/analisi', primario: false },
    { nome: 'OpenAI (GPT-4)',     key: 'OPENAI_API_KEY',      modello: 'gpt-4-turbo',               costo: '$0.02/analisi',   primario: false },
    { nome: 'Ollama (Locale)',    key: null,                   modello: process.env.OLLAMA_MODEL || 'llama3', costo: 'Gratuito', primario: false },
  ];
  const stato = backends.map(b => ({
    nome: b.nome, modello: b.modello,
    configurato: b.key ? !!process.env[b.key] : false,
    primario: b.primario, costo: b.costo,
  }));
  const attivi = stato.filter(b => b.configurato || b.nome.includes('Ollama')).length;
  res.json({
    backends: stato,
    attivi,
    fallbackChain: stato.filter(b => b.configurato).map(b => b.modello),
  });
});

// ============================================================================
// AI REGISTRY — stato live di tutte le AI e percorsi del progetto
// GET /api/ai-registry (pubblico — nessun dato sensibile)
// ============================================================================

app.get('/api/ai-registry', (req, res) => {
  try {
    const { getSummary, getLiveStatus, PIPELINES, PROJECT_PATHS, EXTERNAL_CONNECTIONS } = require('./ai-paths-registry');
    const summary = getSummary();
    const live    = getLiveStatus();

    const models = Object.values(live).map(m => ({
      id:           m.id,
      label:        m.label,
      provider:     m.provider,
      model:        m.model,
      role:         m.role,
      active:       m.active,
      configStatus: m.configStatus,
      costUsdPer1k: m.costUsdPer1k,
      avgLatencyMs: m.avgLatencyMs,
      tiers:        m.tiers,
      description:  m.description,
    }));

    res.json({
      summary,
      models,
      pipelines:   PIPELINES,
      projectPaths: PROJECT_PATHS,
      connections:  EXTERNAL_CONNECTIONS,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// CASCADE F7 ENGINE — Verdetto istantaneo per risposta DM
// POST /api/verdict
// Body: { damage: 0-1, docQuality: 0-1, marketStress: 0-1, prezzoBase?: €, superficieMq?: m² }
// ============================================================================

app.post('/api/verdict', (req, res) => {
  const {
    damage       = 0.5,
    docQuality   = 0.5,
    marketStress = 0.5,
    prezzoBase   = 0,
    superficieMq = 0,
  } = req.body;

  const d  = Math.min(1, Math.max(0, Number(damage)));
  const dq = Math.min(1, Math.max(0, Number(docQuality)));
  const ms = Math.min(1, Math.max(0, Number(marketStress)));

  const risk     = (d * 0.3) + (dq * 0.3) + (ms * 0.4);
  const riskPct  = Math.round(risk * 100);

  let decision, colore, azione;
  if (risk < 0.30) {
    decision = 'PROCEDERE';  colore = 'VERDE';  azione = 'Acquisto consigliato con riserva tecnica';
  } else if (risk < 0.60) {
    decision = 'NEGOZIARE';  colore = 'GIALLO'; azione = 'Negoziare ribasso o chiedere garanzie';
  } else {
    decision = 'EVITARE';    colore = 'ROSSO';  azione = 'Rischio elevato — sconsigliato salvo analisi approfondita';
  }

  const edv = Math.round(79 - (20 + (risk * 30)));

  const esposizioneBassa  = prezzoBase > 0 ? Math.round(prezzoBase * 0.05) : null;
  const esposizioneAlta   = prezzoBase > 0 ? Math.round(prezzoBase * 0.15 + (d * prezzoBase * 0.10)) : null;
  const prezzoMq          = (prezzoBase > 0 && superficieMq > 0) ? Math.round(prezzoBase / superficieMq) : null;

  res.json({
    success:  true,
    verdict: {
      decision,
      colore,
      riskScore:    riskPct,
      azione,
      edv,
      esposizione:  esposizioneBassa ? { min: `€${esposizioneBassa}`, max: `€${esposizioneAlta}` } : null,
      prezzoMq:     prezzoMq ? `€${prezzoMq}/m²` : null,
      checkoutUrl:  '/api/analyze (invia URL asta per analisi completa)',
    },
    motore:   'F7 CASCADE v1.0',
    tier:     'TIER_1_CASCADE_79',
  });
});

// ============================================================================
// EDV — Validazione struttura verdict (quality gate pipeline)
// POST /api/validate-verdict
// Body: { colore, riskScore?, coherenceIndex?, roi? }
// ============================================================================

app.post('/api/validate-verdict', verdictValidationMiddleware, (req, res) => {
  res.json({ success: true, message: 'Verdict strutturalmente valido' });
});

// ============================================================================
// ADMIN — Cleanup job stuck in OCR_DONE (LLM fallito) [legacy]
// POST /api/admin/jobs/cleanup-stuck
// ============================================================================

app.post('/api/admin/jobs/cleanup-stuck', requireAdmin, async (req, res) => {
  try {
    const prismaClient = require('./db');
    const { action = 'list' } = req.body;

    const stuckJobs = await prismaClient.job.findMany({
      where:  { status: 'OCR_DONE' },
      select: { id: true, url: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    if (action === 'list') {
      return res.json({ count: stuckJobs.length, jobs: stuckJobs });
    }

    if (action === 'reset') {
      const updated = await prismaClient.job.updateMany({
        where: { status: 'OCR_DONE' },
        data:  { status: 'PENDING' },
      });
      return res.json({ success: true, reset: updated.count, message: `${updated.count} job rimessi in PENDING` });
    }

    if (action === 'delete') {
      const ids = stuckJobs.map(j => j.id);
      await prismaClient.jobEvent.deleteMany({ where: { jobId: { in: ids } } });
      await prismaClient.job.deleteMany({ where: { status: 'OCR_DONE' } });
      return res.json({ success: true, deleted: ids.length });
    }

    res.status(400).json({ error: 'action deve essere: list | reset | delete' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// ADMIN — Watchdog: rileva e riavvia TUTTI i job bloccati
// GET  /api/admin/watchdog        — snapshot senza modifiche
// POST /api/admin/watchdog        — esegue restart { dryRun?: bool }
// ============================================================================

app.get('/api/admin/watchdog', requireAdmin, async (req, res) => {
  try {
    const { getStuckJobsSnapshot, STUCK_THRESHOLDS } = require('./job-watchdog');
    const snapshot = await getStuckJobsSnapshot();
    const total = Object.values(snapshot).reduce((s, arr) => s + arr.length, 0);
    res.json({ stuck: total, byStatus: snapshot, thresholds: STUCK_THRESHOLDS, ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/watchdog', requireAdmin, async (req, res) => {
  try {
    const { runWatchdog } = require('./job-watchdog');
    const { dryRun = false, maxRetry = 3 } = req.body;
    const report = await runWatchdog({ dryRun, maxRetry });
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// ADMIN — Test AI consensus in tempo reale
// POST /api/admin/ai-test
// Body: { testo?: string, models?: ['claude','gemini',...] }
// ============================================================================

app.post('/api/admin/ai-test', requireAdmin, async (req, res) => {
  try {
    const { runConsensus } = require('./ai-consensus-hub');
    const {
      testo = 'Perizia immobile di test. Stato: buono. Nessuna difformità rilevata. Valore stimato 250000 euro. Confidence alta.',
      models,
    } = req.body;

    const startMs = Date.now();
    const result = await runConsensus(testo, {
      jobId:    null,
      models:   models || ['claude', 'gemini', 'qwen'],
      minModels: 1,
      streaming: false,
    });

    res.json({
      success:     true,
      durationMs:  Date.now() - startMs,
      consensus:   result.consensus,
      data:        result.data,
      ts:          result.timestamp,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// ADMIN — Notifiche vendite recenti (fallback se email non configurata)
// GET /api/admin/vendite
// ============================================================================

app.get('/api/admin/vendite', requireAdmin, async (req, res) => {
  try {
    const prismaClient = require('./db');
    const vendite = await prismaClient.immobile.findMany({
      where:   { pagato: true },
      include: { job: { select: { id: true, url: true, status: true, createdAt: true } } },
      orderBy: { job: { createdAt: 'desc' } },
      take:    50,
    });

    const totale = vendite.length * 79;
    res.json({
      success:  true,
      count:    vendite.length,
      revenue:  `€${totale}`,
      target:   '€1000 (13 vendite)',
      progress: `${vendite.length}/13 (${Math.round((vendite.length/13)*100)}%)`,
      vendite:  vendite.map(v => ({
        jobId:          v.jobId,
        url:            v.job?.url?.slice(0, 80),
        status:         v.job?.status,
        semaforo:       v.status,
        coherence:      v.coherenceIndex,
        roi:            v.roi,
        data:           v.job?.createdAt,
        reportUrl:      `/api/jobs/${v.jobId}/report`,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// PAGINA ASTE — form checkout
// ============================================================================
app.get('/aste', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'aste.html'));
});

// ============================================================================
// SPA fallback — serve index.html per qualsiasi route non-API
// ============================================================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

sentryErrorHandler(app);

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// ============================================================================
// SERVER START
// ============================================================================

async function start() {
  try {
    // ============================================================
    // AVVIO WORKER BULLMQ (in-process, single Railway dyno)
    // ============================================================
    // WORKER_SUBSET=scraper,ocr,llm,scoring limita i worker caricati
    // (utile su Redis Cloud free tier con max 8 connessioni)
    const allWorkerModules = [
      './src/workers/worker-scraper',
      './src/workers/worker-ocr',
      './src/workers/worker-llm',
      './src/workers/worker-scoring',
      './src/workers/worker-report',
      './src/workers/worker-notify',
      './src/workers/worker-review',
    ];
    const subset = process.env.WORKER_SUBSET;
    const workerModules = subset
      ? allWorkerModules.filter(m => subset.split(',').some(s => m.includes(s.trim())))
      : allWorkerModules;
    if (subset) console.log(`[WORKERS] Subset attivo: ${subset}`);
    for (const mod of workerModules) {
      try {
        require(mod);
        console.log(`[WORKERS] Avviato: ${mod}`);
      } catch (err) {
        console.error(`[WORKERS] Errore avvio ${mod}: ${err.message}`);
      }
    }

    app.listen(PORT, () => {
      // Avvia il subscriber Redis per il broadcast SSE real-time
      startSubscriber();
      console.log(`
â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
â•‘   EXTERNAL OPINION â€” V18.3             â•‘
â•‘   Distributed Risk Intelligence        â•‘
â•‘â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
â•‘ Server running on port: ${PORT}              â”‚
â•‘ Environment: ${process.env.NODE_ENV || 'development'}        â”‚
â•‘ DAG Orchestrator: ACTIVE               â”‚
â•‘ Portal Crawler: SCHEDULED (02:00 UTC)  â”‚
â•‘ Security: Hardened                    â”‚
â•‘ Observability: Prometheus/Sentry       â”‚
â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      `);
    });

    // Crawler autonomo ogni notte alle 02:00 UTC
    try {
      const cron = require('node-cron');
      cron.schedule('0 2 * * *', async () => {
        console.log('[CRON] Avvio crawler notturno...');
        try {
          const { runCrawler } = require('./portal-crawler');
          const result = await runCrawler({ maxPerPortal: 20 });
          console.log('[CRON] Crawler completato:', result);
        } catch (err) {
          console.error('[CRON] Crawler error:', err.message);
        }
      });
      console.log('[CRON] Scheduler crawler attivo — esecuzione alle 02:00 UTC ogni notte');

      // Reset mensile statistiche: primo giorno del mese alle 03:00 UTC
      cron.schedule('0 3 1 * *', async () => {
        console.log('[CRON] Reset mensile statistiche...');
        try {
          const prismaClient = require('./db');
          // Archivia snapshot mensile prima del reset
          const snapshot = await prismaClient.job.groupBy({ by: ['status'], _count: true });
          const totalPagati = await prismaClient.immobile.count({ where: { pagato: true } });
          console.log(`[CRON] Snapshot mese: ${JSON.stringify(snapshot)} | Pagati: ${totalPagati}`);
          // Pulizia log eventi vecchi di 90 giorni
          const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          const deleted = await prismaClient.jobEvent.deleteMany({
            where: { timestamp: { lt: cutoff } },
          });
          console.log(`[CRON] Reset mensile completato — ${deleted.count} eventi vecchi rimossi`);
        } catch (err) {
          console.error('[CRON] Reset mensile error:', err.message);
        }
      });
      console.log('[CRON] Reset mensile attivo — esecuzione il 1° del mese alle 03:00 UTC');

      // Watchdog job bloccati — ogni 10 minuti
      cron.schedule('*/10 * * * *', async () => {
        try {
          const { runWatchdog } = require('./job-watchdog');
          const report = await runWatchdog({ dryRun: false, maxRetry: 3 });
          if (report.restarted > 0) {
            console.log(`[CRON WATCHDOG] ${report.restarted} job riavviati, ${report.stuck} bloccati trovati`);
          }
        } catch (err) {
          console.error('[CRON WATCHDOG] Error:', err.message);
        }
      });
      console.log('[CRON] Watchdog attivo — scansione job bloccati ogni 10 minuti');

    } catch (err) {
      console.warn('[CRON] node-cron non disponibile:', err.message);
    }

  } catch (err) {
    console.error('[FATAL]', err);
    process.exit(1);
  }
}

start();

// ============================================================================
// GRACEFUL SHUTDOWN — chiude connessioni Redis prima di uscire
// evita zombie connections su Redis Cloud che causano "max clients reached"
// ============================================================================
async function shutdown(signal) {
  console.log(`[SHUTDOWN] ${signal} ricevuto — chiusura connessioni in corso...`);
  try {
    const { getSharedRedis } = require('./redis-connection');
    await getSharedRedis().quit();
    console.log('[SHUTDOWN] Redis condiviso chiuso.');
  } catch (_) {}
  try {
    const prisma = require('./db');
    await prisma.$disconnect();
    console.log('[SHUTDOWN] Prisma disconnesso.');
  } catch (_) {}
  console.log('[SHUTDOWN] Uscita pulita.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = app;
