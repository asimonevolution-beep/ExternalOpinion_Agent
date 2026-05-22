/**
 * Helper: connessione Redis compatibile con Railway (REDIS_URL) e configurazione manuale.
 * BullMQ v2 accetta sia URL stringa che oggetto {host,port,password}.
 */

function getRedisConnection() {
  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL };
  }
  const conn = {
    host: process.env.REDIS_HOST || process.env.REDISHOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || process.env.REDISPORT || '6379', 10),
  };
  const pass = process.env.REDIS_PASSWORD || process.env.REDISPASSWORD;
  if (pass) conn.password = pass;
  return conn;
}

module.exports = { getRedisConnection };
