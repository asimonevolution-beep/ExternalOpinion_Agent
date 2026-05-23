/**
 * Helper: connessione Redis compatibile con Railway (REDIS_URL) e configurazione manuale.
 * BullMQ v2 richiede opzioni ioredis (host/port/password), NON { url: "..." }.
 */

function getRedisConnection() {
  if (process.env.REDIS_URL) {
    try {
      const u = new URL(process.env.REDIS_URL);
      const conn = {
        host: u.hostname,
        port: parseInt(u.port, 10) || 6379,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
      if (u.password) conn.password = decodeURIComponent(u.password);
      if (u.username && u.username !== 'default') conn.username = u.username;
      return conn;
    } catch (_) {}
  }
  const conn = {
    host: process.env.REDIS_HOST || process.env.REDISHOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || process.env.REDISPORT || '6379', 10),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
  const pass = process.env.REDIS_PASSWORD || process.env.REDISPASSWORD;
  if (pass) conn.password = pass;
  return conn;
}

module.exports = { getRedisConnection };
