/**
 * Helper: connessione Redis compatibile con Railway (REDIS_URL) e configurazione manuale.
 * BullMQ v2 richiede opzioni ioredis (host/port/password), NON { url: "..." }.
 *
 * getRedisConnection() → opzioni plain per Worker BullMQ (ogni Worker ha bisogno di
 *   connessioni proprie, non condivisibili).
 *
 * getSharedRedis() → istanza IORedis singleton da riutilizzare per le Queue e FlowProducer:
 *   tutte le Queue che ricevono la stessa istanza condividono una sola connessione TCP,
 *   risolvendo il problema "ERR max number of clients reached" su piani Redis Cloud free.
 */

function getRedisOptions() {
  if (process.env.REDIS_URL) {
    try {
      const u = new URL(process.env.REDIS_URL);
      const rawPort = u.port;
      const port = parseInt(rawPort, 10);
      const conn = {
        host: u.hostname,
        port: Number.isFinite(port) && port > 0 ? port : 6379,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
      if (u.password) conn.password = decodeURIComponent(u.password);
      if (u.username && u.username !== 'default') conn.username = u.username;
      return conn;
    } catch (_) {}
  }

  const rawPort = process.env.REDIS_PORT || process.env.REDISPORT || '6379';
  const port = parseInt(rawPort, 10);
  const conn = {
    host: process.env.REDIS_HOST || process.env.REDISHOST || '127.0.0.1',
    port: Number.isFinite(port) && port > 0 ? port : 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
  const pass = process.env.REDIS_PASSWORD || process.env.REDISPASSWORD;
  if (pass) conn.password = pass;
  return conn;
}

// Backward compat per Worker BullMQ
function getRedisConnection() {
  return getRedisOptions();
}

// Singleton IORedis condiviso tra tutte le Queue e FlowProducer
let _sharedRedis = null;
function getSharedRedis() {
  if (!_sharedRedis) {
    const IORedis = require('ioredis');
    // skipVersionCheck: BullMQ legge questa proprietà da instance.options per bypassare
    // il controllo Redis >= 5.0 (utile con Redis 3.x locale in sviluppo)
    _sharedRedis = new IORedis({
      ...getRedisOptions(),
      skipVersionCheck: true,
      // Keepalive 30s — permette al server Redis di rilevare connessioni morte
      // anche dopo un kill -9 (che non invia FIN TCP)
      keepAlive: 30000,
      // Auto-disconnect dopo 60s idle — libera connessioni zombie su Redis Cloud
      connectTimeout: 10000,
      lazyConnect: false,
    });
    _sharedRedis.on('error', (err) => {
      // Log silenzioso — BullMQ riprova automaticamente
      if (!err.message.includes('ENOTFOUND') && !err.message.includes('ECONNREFUSED')) {
        console.error('[REDIS SHARED] Errore:', err.message);
      }
    });
  }
  return _sharedRedis;
}

// Restituisce la REDIS_URL raw se disponibile (per health check)
function getRedisUrl() {
  return process.env.REDIS_URL || null;
}

module.exports = { getRedisConnection, getSharedRedis, getRedisUrl };
