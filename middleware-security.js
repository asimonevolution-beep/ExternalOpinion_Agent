/**
 * EXTERNAL OPINION — SECURITY & OBSERVABILITY MIDDLEWARE V18.3
 * Direzione Tecnica: Geometra Simone Azzali
 * 
 * Features:
 * - Helmet.js security
 * - CSP strict mode
 * - Rate limiting
 * - Prometheus metrics
 * - Sentry error tracking
 * - OpenTelemetry distributed tracing
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const prometheus = require('prom-client');
const Sentry = require('@sentry/node');
const { trace, context } = require('@opentelemetry/api');

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

function securityMiddleware(app) {
  // Helmet.js - HTTP headers hardening
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https://api.stripe.com'],
          frameSrc: ["'none'", 'https://js.stripe.com'],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 anno
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  console.log('[SECURITY] Helmet.js configured');
}

// ============================================================================
// RATE LIMITING
// ============================================================================

const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120, // 2 req/sec per IP
  message: 'Troppe richieste da questo IP, riprova più tardi',
  standardHeaders: true,
  legacyHeaders: false,
});

const analyzeApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // finestra 15 minuti
  max: 10, // 10 analisi per finestra per IP/token
  keyGenerator: (req) => req.body?.token || req.ip,
  message: 'Limite di analisi raggiunto',
});

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 checkout per finestra
  keyGenerator: (req) => req.ip,
  message: 'Troppi tentativi di checkout',
});

// ============================================================================
// PROMETHEUS METRICS
// ============================================================================

// Counter: richieste per endpoint
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Counter: job completions
const jobCompletionCounter = new prometheus.Counter({
  name: 'jobs_completed_total',
  help: 'Total number of completed jobs',
  labelNames: ['status', 'tier'],
});

// Gauge: worker status
const workerGauge = new prometheus.Gauge({
  name: 'workers_active',
  help: 'Number of active workers',
  labelNames: ['queue_name'],
});

// Counter: errors
const errorCounter = new prometheus.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['service', 'error_type'],
});

// ============================================================================
// METRICS MIDDLEWARE
// ============================================================================

function metricsMiddleware(app) {
  // Registra metrics di Express
  app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      httpRequestDuration
        .labels(req.method, req.route?.path || req.path, res.statusCode)
        .observe(duration);
    });

    next();
  });

  // Endpoint Prometheus — protetto da ADMIN_TOKEN
  app.get('/metrics', (req, res, next) => {
    const token = req.headers['x-admin-token'] || req.query.token;
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }, async (req, res) => {
    res.set('Content-Type', prometheus.register.contentType);
    res.end(await prometheus.register.metrics());
  });

  console.log('[METRICS] Prometheus configured');
}

// ============================================================================
// SENTRY ERROR TRACKING
// ============================================================================

function initSentry(app) {
  if (!process.env.SENTRY_DSN) {
    console.log('[SENTRY] DSN non configurato — Sentry disabilitato');
    return;
  }
  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 1.0,
    });
    if (Sentry.Handlers && Sentry.Handlers.requestHandler) {
      app.use(Sentry.Handlers.requestHandler());
    }
    console.log('[SENTRY] Error tracking configured');
  } catch (err) {
    console.warn('[SENTRY] Inizializzazione fallita (versione incompatibile):', err.message);
  }
}

function sentryErrorHandler(app) {
  if (!process.env.SENTRY_DSN) return;
  try {
    if (Sentry.Handlers && Sentry.Handlers.errorHandler) {
      app.use(Sentry.Handlers.errorHandler());
    }
  } catch (err) {
    console.warn('[SENTRY] Error handler non disponibile:', err.message);
  }
}

// ============================================================================
// OPENTELEMETRY DISTRIBUTED TRACING
// ============================================================================

const tracer = trace.getTracer('external-opinion-tracer', '1.0.0');

async function withTracing(operationName, fn) {
  const span = tracer.startSpan(operationName);

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn();
      span.setStatus({ code: 0 }); // OK
      return result;
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: 2, message: err.message }); // ERROR
      throw err;
    } finally {
      span.end();
    }
  });
}

// ============================================================================
// HEALTHCHECK ENDPOINTS
// ============================================================================

function healthCheckEndpoints(app) {
  // Liveness probe (Kubernetes)
  app.get('/health/live', (req, res) => {
    res.status(200).json({
      status: 'alive',
      version: 'v3-f0ea437',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness probe
  app.get('/health/ready', async (req, res) => {
    const result = { database: 'unknown', redis: 'unknown', timestamp: new Date().toISOString() };
    let ok = true;

    // Check DB
    try {
      await require('./db').$queryRaw`SELECT 1`;
      result.database = 'connected';
    } catch (err) {
      result.database = `error: ${err.message.slice(0, 120)}`;
      ok = false;
    }

    // Check Redis via ioredis
    try {
      const Redis = require('ioredis');
      const { getRedisConnection } = require('./redis-connection');
      const conn = getRedisConnection();
      const ioredis = conn.url
        ? new Redis(conn.url, { lazyConnect: true, connectTimeout: 3000, maxRetriesPerRequest: 0, enableOfflineQueue: false })
        : new Redis({ ...conn, lazyConnect: true, connectTimeout: 3000, maxRetriesPerRequest: 0, enableOfflineQueue: false });
      await ioredis.connect();
      await ioredis.ping();
      await ioredis.quit();
      result.redis = 'connected';
    } catch (err) {
      result.redis = `error: ${err.message.slice(0, 80)}`;
      ok = false;
    }

    return res.status(ok ? 200 : 503).json({ status: ok ? 'ready' : 'not_ready', ...result });
  });

  // Metrics endpoint
  app.get('/health/metrics', async (req, res) => {
    try {
      const metrics = await prometheus.register.metrics();
      res.set('Content-Type', prometheus.register.contentType);
      res.end(metrics);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log('[HEALTH] Healthcheck endpoints configured');
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  securityMiddleware,
  globalLimiter,
  analyzeApiLimiter,
  checkoutLimiter,
  metricsMiddleware,
  initSentry,
  sentryErrorHandler,
  withTracing,
  healthCheckEndpoints,
  prometheus: {
    httpRequestDuration,
    jobCompletionCounter,
    workerGauge,
    errorCounter,
  },
};
