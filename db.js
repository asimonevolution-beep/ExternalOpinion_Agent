const { PrismaClient } = require('@prisma/client');

// Railway PostgreSQL usa POSTGRES_URL o DATABASE_PRIVATE_URL — mappiamo a DATABASE_URL
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === '') {
  const fallback = process.env.POSTGRES_URL
    || process.env.DATABASE_PRIVATE_URL
    || process.env.POSTGRES_PRIVATE_URL
    || process.env.PGHOST && `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE}`;
  if (fallback) {
    process.env.DATABASE_URL = fallback;
    console.log('[DB] DATABASE_URL impostata da variabile Railway alternativa');
  }
}

const prisma = new PrismaClient();

module.exports = prisma;
