/**
 * EXTERNAL OPINION — REALTIME HUB V1.0
 * Direzione Tecnica: Geometra Simone Azzali
 *
 * Bus di messaggi Redis Pub/Sub → SSE verso tutti i portali e dispositivi.
 *
 * Architettura:
 *   Worker  ─publish→  Redis channel "job:{jobId}"  ─subscribe→  SSE client
 *   Worker  ─publish→  Redis channel "global"       ─subscribe→  Admin dashboard
 *
 * Endpoints:
 *   GET /api/stream/:jobId          — stream aggiornamenti job (cliente)
 *   GET /api/stream/admin/live      — stream globale per dashboard admin (X-Admin-Token)
 */

const express = require('express');
const IORedis = require('ioredis');
const { getRedisOptions } = require('./redis-connection');

// ============================================================================
// CONNESSIONE SUBSCRIBER (separata dal shared per evitare conflitti BullMQ)
// ============================================================================

let _subscriber = null;

function getSubscriber() {
  if (!_subscriber) {
    const IORedis = require('ioredis');
    _subscriber = new IORedis({ ...getRedisOptions(), lazyConnect: false });
    _subscriber.on('error', (err) => {
      if (!err.message.includes('ENOTFOUND') && !err.message.includes('ECONNREFUSED')) {
        console.error('[REALTIME] Redis subscriber error:', err.message);
      }
    });
  }
  return _subscriber;
}

let _publisher = null;

function getPublisher() {
  if (!_publisher) {
    const IORedis = require('ioredis');
    _publisher = new IORedis({ ...getRedisOptions(), lazyConnect: false });
    _publisher.on('error', (err) => {
      if (!err.message.includes('ENOTFOUND') && !err.message.includes('ECONNREFUSED')) {
        console.error('[REALTIME] Redis publisher error:', err.message);
      }
    });
  }
  return _publisher;
}

// ============================================================================
// REGISTRO CLIENT SSE
// ============================================================================

// jobId → Set<{ res, connectedAt }>
const jobClients = new Map();

// Set<{ res, connectedAt }> — admin dashboard
const adminClients = new Set();

// ============================================================================
// PUBLISH — chiamato dai worker/orchestrator
// ============================================================================

/**
 * Pubblica un evento su Redis per un job specifico.
 * Viene chiamato da recordJobEvent() in orchestrator.js.
 */
async function publishJobEvent(jobId, eventType, metadata = {}) {
  try {
    const pub = getPublisher();
    const payload = JSON.stringify({
      jobId,
      eventType,
      metadata,
      ts: Date.now(),
    });
    // Canale per job specifico + canale globale admin
    await Promise.all([
      pub.publish(`job:${jobId}`, payload),
      pub.publish('global', payload),
    ]);
  } catch (err) {
    // Non blocca il worker se Redis non è disponibile
    console.warn('[REALTIME] publish fallito:', err.message);
  }
}

/**
 * Pubblica un evento AI parziale (usato da ai-consensus-hub mentre i modelli rispondono).
 */
async function publishAIProgress(jobId, aiEvent) {
  try {
    const pub = getPublisher();
    const payload = JSON.stringify({
      jobId,
      eventType: 'AI_MODEL_RESPONSE',
      metadata: aiEvent,
      ts: Date.now(),
    });
    await Promise.all([
      pub.publish(`job:${jobId}`, payload),
      pub.publish('global', payload),
    ]);
  } catch (_) {}
}

// ============================================================================
// SUBSCRIBE — avvia una volta sola al boot del server
// ============================================================================

let _subscribed = false;

function startSubscriber() {
  if (_subscribed) return;
  _subscribed = true;

  const sub = getSubscriber();

  sub.psubscribe('job:*', 'global', (err) => {
    if (err) {
      console.error('[REALTIME] psubscribe error:', err.message);
    } else {
      console.log('[REALTIME] Redis subscriber attivo — canali: job:*, global');
    }
  });

  // Ogni messaggio Redis viene inoltrato agli SSE client corretti
  sub.on('pmessage', (_pattern, channel, message) => {
    try {
      const event = JSON.parse(message);

      if (channel === 'global') {
        // Broadcast a tutti i client admin
        for (const client of adminClients) {
          sendSSE(client.res, 'update', event);
        }
      }

      // Broadcast ai client del job specifico (channel = "job:{jobId}")
      const jobId = channel.startsWith('job:') ? channel.slice(4) : null;
      if (jobId && jobClients.has(jobId)) {
        for (const client of jobClients.get(jobId)) {
          sendSSE(client.res, 'update', event);
        }
      }
    } catch (_) {}
  });
}

// ============================================================================
// HELPERS SSE
// ============================================================================

function sendSSE(res, event, data) {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    // Forza flush su Node.js/Express (no buffering)
    if (typeof res.flush === 'function') res.flush();
  } catch (_) {}
}

function addJobClient(jobId, res) {
  const client = { res, connectedAt: Date.now() };
  if (!jobClients.has(jobId)) jobClients.set(jobId, new Set());
  jobClients.get(jobId).add(client);
  return client;
}

function removeJobClient(jobId, client) {
  const set = jobClients.get(jobId);
  if (set) {
    set.delete(client);
    if (set.size === 0) jobClients.delete(jobId);
  }
}

// ============================================================================
// SSE ROUTER
// ============================================================================

function getSSERouter() {
  const router = express.Router();

  // ── GET /stream/:jobId ────────────────────────────────────────────────────
  // Apre stream SSE per un job specifico. Qualsiasi client (browser, mobile, tablet)
  // può connettersi e ricevere aggiornamenti in tempo reale senza polling HTTP.
  router.get('/stream/:jobId', (req, res) => {
    const { jobId } = req.params;

    // Headers SSE standard (compatibili con tutti i browser moderni)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disabilita buffering Nginx
    res.flushHeaders();

    // Evento iniziale — conferma connessione
    sendSSE(res, 'connected', { jobId, ts: Date.now(), message: 'Stream attivo' });

    // Heartbeat ogni 25s per mantenere la connessione viva (proxy/firewall timeout)
    const heartbeat = setInterval(() => {
      try {
        res.write(':heartbeat\n\n');
        if (typeof res.flush === 'function') res.flush();
      } catch (_) { clearInterval(heartbeat); }
    }, 25000);

    const client = addJobClient(jobId, res);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeJobClient(jobId, client);
    });
  });

  // ── GET /stream/admin/live ────────────────────────────────────────────────
  // Stream globale per la dashboard admin — riceve TUTTI gli eventi di tutti i job.
  router.get('/stream/admin/live', (req, res) => {
    const adminToken = req.headers['x-admin-token'] || req.query.token;
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    sendSSE(res, 'connected', {
      ts: Date.now(),
      activeJobs: jobClients.size,
      message: 'Dashboard stream attivo',
    });

    const heartbeat = setInterval(() => {
      try {
        res.write(':heartbeat\n\n');
        if (typeof res.flush === 'function') res.flush();
      } catch (_) { clearInterval(heartbeat); }
    }, 25000);

    const client = { res, connectedAt: Date.now() };
    adminClients.add(client);

    // Invia snapshot stato corrente
    sendSSE(res, 'status', {
      connectedJobStreams: jobClients.size,
      adminClients: adminClients.size,
      ts: Date.now(),
    });

    req.on('close', () => {
      clearInterval(heartbeat);
      adminClients.delete(client);
    });
  });

  // ── GET /stream/admin/status ──────────────────────────────────────────────
  // Snapshot istantaneo (non-SSE) dei client connessi — per health check
  router.get('/stream/admin/status', (req, res) => {
    const adminToken = req.headers['x-admin-token'] || req.query.token;
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const jobsWithClients = [];
    for (const [jid, clients] of jobClients.entries()) {
      jobsWithClients.push({ jobId: jid, clients: clients.size });
    }

    res.json({
      ok: true,
      connectedJobStreams: jobClients.size,
      adminDashboards: adminClients.size,
      jobs: jobsWithClients,
      ts: Date.now(),
    });
  });

  return router;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  publishJobEvent,
  publishAIProgress,
  startSubscriber,
  getSSERouter,
};
