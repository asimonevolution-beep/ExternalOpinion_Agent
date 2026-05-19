/**
 * EXTERNAL OPINION — SERVER V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 * 
 * Express server con:
 * - DAG orchestrator (BullMQ FlowProducer)
 * - Security hardening (Helmet, CSP, rate limiting)
 * - Observability stack (Prometheus, Sentry)
 * - Healthcheck endpoints
 * - API endpoints aggiornati per V18.3
 */

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

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

// ============================================================================
// APP INITIALIZATION
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// Sentry early init
initSentry(app);

// Security hardening
securityMiddleware(app);

// Standard middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(compression());
app.use(morgan('combined'));

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// ============================================================================
// API ROUTES
// ============================================================================

const apiRouter = express.Router();

/**
 * POST /api/analyze — Create analysis job (non-blocking with DAG)
 */
apiRouter.post(
  '/analyze',
  analyzeApiLimiter,
  async (req, res) => {
    const { urlAsta, email, token, service, zonaDati = {}, tier = 'TIER_2_ADVISORY_150' } = req.body;

    try {
      // Validazione
      if (!urlAsta) {
        return res.status(400).json({
          success: false,
          error: 'urlAsta è obbligatorio',
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

      // Crea Job (atomic transaction)
      const jobRecord = await createJob({
        url: urlAsta,
        email,
        token,
        service,
        zonaDati,
      });

      console.log(`[API] Job created: ${jobRecord.id}`);

      // ===== CREA DAG PIPELINE =====
      await createAnalysisPipeline(jobRecord.id, jobRecord.payload, tier);

      // HTTP 202 ACCEPTED - Job enqueued
      return res.status(202).json({
        success: true,
        jobId: jobRecord.id,
        status: 'PENDING',
        createdAt: jobRecord.createdAt,
        pollingUrl: `/api/jobs/${jobRecord.id}`,
        checkoutUrl: `/api/jobs/${jobRecord.id}/checkout`,
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
 * GET /api/jobs/:jobId — Poll job status
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
 * POST /api/jobs/:jobId/checkout — Initiate Stripe payment
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

      // Crea Stripe session
      const checkoutSession = await createCheckoutSession(jobId, tier, email);

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
 * GET /api/checkout/:sessionId — Get payment status
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

// Mount API router
app.use('/api', apiRouter);

// Mount Stripe webhook
app.use('/api/stripe', stripeRouter);

// ============================================================================
// ADMIN ROUTES — Pannello revisione per Simone
// ============================================================================

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'ext-opinion-admin-2025';

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

const {
  addToReviewQueue,
  approveReport,
  rejectReport,
  getPendingReviews,
  getReviewByJobId,
} = require('./review-queue');

const { runCrawler, queueNewAuctionsForAnalysis } = require('./portal-crawler');

// GET /admin/review — lista report in attesa
app.get('/admin/review', requireAdmin, async (req, res) => {
  try {
    const pending = await getPendingReviews();
    res.json({ success: true, count: pending.length, items: pending });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /admin/review/:jobId — singolo report
app.get('/admin/review/:jobId', requireAdmin, async (req, res) => {
  try {
    const review = await getReviewByJobId(req.params.jobId);
    if (!review) return res.status(404).json({ error: 'Not found' });

    // Serve la pagina HTML di revisione
    const aiReport = JSON.parse(review.aiReport || '{}');
    res.send(`<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8">
<title>Revisione Report — ${req.params.jobId}</title>
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
<h1>📋 Revisione Report</h1>
<p><strong>Job ID:</strong> ${review.jobId}</p>
<p><strong>Stato:</strong> <span class="status ${review.status}">${review.status}</span></p>
<p><strong>Creato:</strong> ${new Date(review.createdAt).toLocaleString('it-IT')}</p>
<h2>Report AI:</h2>
<div class="report">${JSON.stringify(aiReport, null, 2)}</div>
<form id="reviewForm">
  <label><strong>Note revisione (opzionale):</strong></label>
  <textarea id="notes" placeholder="Aggiungi note professionali, correzioni, osservazioni...">${review.reviewerNotes || ''}</textarea>
  <div style="margin-top:1rem;">
    <button type="button" class="btn approve" onclick="submitReview('approve')">✅ Approva e invia al cliente</button>
    <button type="button" class="btn reject" onclick="submitReview('reject')">❌ Rifiuta</button>
  </div>
</form>
<script>
async function submitReview(action) {
  const notes = document.getElementById('notes').value;
  const r = await fetch('/admin/review/${req.params.jobId}/' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': '${ADMIN_TOKEN}' },
    body: JSON.stringify({ notes })
  });
  const d = await r.json();
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
    await approveReport(req.params.jobId, req.body.notes || '');
    res.json({ success: true, message: 'Report approvato e cliente notificato' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /admin/review/:jobId/reject
app.post('/admin/review/:jobId/reject', requireAdmin, async (req, res) => {
  try {
    await rejectReport(req.params.jobId, req.body.notes || 'Rifiutato');
    res.json({ success: true, message: 'Report rifiutato' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /admin/crawler/run — lancia crawler manuale
app.post('/admin/crawler/run', requireAdmin, async (req, res) => {
  res.json({ success: true, message: 'Crawler avviato in background' });
  runCrawler({ maxPerPortal: req.body.maxPerPortal || 10 })
    .then(r => console.log('[ADMIN] Crawler completato:', r))
    .catch(e => console.error('[ADMIN] Crawler error:', e.message));
});

// GET /admin/crawler/status — aste scoperte
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

// SPA fallback — serve index.html per qualsiasi route non-API
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
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║   EXTERNAL OPINION — V18.3             ║
║   Distributed Risk Intelligence        ║
║════════════════════════════════════════╝
║ Server running on port: ${PORT}              │
║ Environment: ${process.env.NODE_ENV || 'development'}        │
║ DAG Orchestrator: ACTIVE               │
║ Portal Crawler: SCHEDULED (02:00 UTC)  │
║ Security: Hardened                    │
║ Observability: Prometheus/Sentry       │
╚════════════════════════════════════════╝
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
    } catch (err) {
      console.warn('[CRON] node-cron non disponibile:', err.message);
    }

  } catch (err) {
    console.error('[FATAL]', err);
    process.exit(1);
  }
}

start();

module.exports = app;
