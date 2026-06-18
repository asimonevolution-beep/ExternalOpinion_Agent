'use strict';
const { PrismaClient } = require('@prisma/client');

// prisma.$executeRawUnsafe accetta UN solo statement per chiamata.
// Ogni statement viene eseguito separatamente.
const STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,

  `CREATE TABLE IF NOT EXISTS session_counters_v13_4 (
    session_id UUID PRIMARY KEY,
    last_sequence BIGINT NOT NULL DEFAULT 0,
    last_block_hash VARCHAR(64) NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS event_store_v13_4 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    protocol_id TEXT UNIQUE NOT NULL,
    session_id UUID NOT NULL,
    sequence_number BIGINT NOT NULL,
    causal_parent TEXT NOT NULL,
    db_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_hash VARCHAR(64) NOT NULL,
    duration_seconds DOUBLE PRECISION NOT NULL,
    raw_payload JSONB NOT NULL,
    sanitized_payload JSONB NOT NULL,
    inference JSONB NOT NULL,
    previous_hash VARCHAR(64) NOT NULL,
    block_hash VARCHAR(64) NOT NULL,
    CONSTRAINT uniq_session_sequence_v13_4 UNIQUE (session_id, sequence_number)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_v13_4_ledger_stream
    ON event_store_v13_4 (session_id, sequence_number ASC)`,

  `CREATE TABLE IF NOT EXISTS idempotency_ledger_v13_4 (
    idempotency_key VARCHAR(64) PRIMARY KEY,
    response_cached JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE OR REPLACE FUNCTION freeze_v13_4_ledger()
  RETURNS trigger AS $$
  BEGIN
    RAISE EXCEPTION 'WRITE_REJECTED: EVENT_STORE_V13_4_IS_APPEND_ONLY';
  END;
  $$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS trg_freeze_v13_4_ledger ON event_store_v13_4`,

  `CREATE TRIGGER trg_freeze_v13_4_ledger
    BEFORE UPDATE OR DELETE ON event_store_v13_4
    FOR EACH ROW EXECUTE FUNCTION freeze_v13_4_ledger()`,
];

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('[LEDGER] Inizializzazione event_store_v13_4...');
    for (const sql of STATEMENTS) {
      await prisma.$executeRawUnsafe(sql);
    }
    console.log('[LEDGER] ✓ Tabelle ledger e trigger pronti');
  } catch (err) {
    console.error('[LEDGER] Errore inizializzazione (non-fatal):', err.message);
    // Non blocca il boot del server — le tabelle ledger sono ausiliarie
  } finally {
    await prisma.$disconnect();
  }
}

main();
