const { PrismaClient } = require('@prisma/client');

// Risolve DATABASE_URL da variabili Railway alternative (POSTGRES_URL, PG*, etc.)
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === '') {
  const fallback = process.env.POSTGRES_URL
    || process.env.DATABASE_PRIVATE_URL
    || process.env.POSTGRES_PRIVATE_URL
    || (process.env.PGHOST
      ? `postgresql://${encodeURIComponent(process.env.PGUSER || 'postgres')}:${encodeURIComponent(process.env.PGPASSWORD || '')}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'railway'}`
      : null);
  if (fallback) {
    process.env.DATABASE_URL = fallback;
    console.log('[DB] DATABASE_URL impostata da variabile Railway alternativa');
  } else {
    console.error('[DB] ERRORE CRITICO: DATABASE_URL non configurata.');
    console.error('[DB] Vai su Railway dashboard → Add-ons → Aggiungi PostgreSQL.');
    console.error('[DB] Il servizio partirà ma tutte le query falliranno.');
  }
}

let prisma;
try {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
} catch (e) {
  console.error('[DB] Impossibile istanziare PrismaClient:', e.message);
  // Proxy object che restituisce errori chiari invece di crashare il server
  prisma = new Proxy({}, {
    get: (_, prop) => {
      if (prop === '$disconnect') return () => Promise.resolve();
      return () => Promise.reject(new Error('DATABASE_URL non configurata. Aggiungi PostgreSQL su Railway.'));
    },
  });
}

module.exports = prisma;
