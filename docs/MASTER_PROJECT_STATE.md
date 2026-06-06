# EXTERNAL OPINION — MASTER PROJECT STATE
**Fonte Ufficiale del Progetto · Aggiornato: 2026-06-06**
**Direzione Tecnica: Geom. Simone Azzali · P.IVA 03880920362**

---

## STATO CORRENTE: PRE-REVENUE · RAILWAY BUILD IN CORSO

### Blocco Operativo Attivo
> **NEXT ACTION:** Build Railway verde → primo pagamento reale → sblocco sviluppo

Tutto lo sviluppo non critico è congelato finché Railway non mostra health check verde.

---

## 1. IDENTITÀ DEL PRODOTTO

**External Opinion** è una piattaforma AI-native per analisi tecnica indipendente di immobili in aste giudiziarie e compravendite nel mercato italiano.

**Proposta di valore:**
- Parere tecnico indipendente firmato da Geometra iscritto all'Albo
- Risk Engine deterministico proprietario (Core Engine v13.4.0)
- Pipeline multi-agent asincrona (V18.3 DAG Architecture)
- Unico operatore con AI specifica per aste/CTU in Italia

**Fondatore:** Geom. Simone Azzali · Via Fornace 7, Bomporto (MO) 41030
**Email:** simone.azzali@yahoo.com · **Cell:** 389 9008042
**Sede legale:** Edilizia Sartoriale di Simone Azzali

---

## 2. STACK TECNICO (versione corrente)

| Layer | Tecnologia | File |
|-------|-----------|------|
| Runtime | Node.js v20 | `server-v18.3.js` |
| API Server | Express.js V18.3 | `server-v18.3.js` |
| Queue/Workers | BullMQ + Redis | `dag-orchestrator.js` |
| Database | PostgreSQL + Prisma ORM | `prisma/schema.prisma` |
| Risk Engine | Core Engine v13.4.0 | `src/engines/core-engine-v13.4.js` |
| Scoring | Deterministic Engine | `src/workers/worker-scoring.js` |
| Ledger Forense | Event Store v13.4 | `scripts/init-ledger.js` |
| AI LLM | Anthropic Claude (primario) | `src/workers/worker-llm.js` |
| Pagamenti | Stripe | `stripe-webhook-handler.js` |
| Email | Resend / Nodemailer | `src/email/` |
| Deploy Backend | Railway (Dockerfile) | `railway.toml`, `Dockerfile` |
| Deploy Frontend | Netlify | `netlify.toml` → `public/` |
| Monitoring | Prometheus + Sentry | `middleware-security.js` |

### Workers attivi (6)
1. `worker-scraper.js` — Puppeteer, concurrency 2
2. `worker-ocr.js` — Tesseract, concurrency 4
3. `worker-llm.js` — Claude/OpenAI/Gemini fallback chain, concurrency 2
4. `worker-scoring.js` — Motore deterministico ZERO AI, concurrency 8
5. `worker-report.js` — PDFKit, concurrency 4
6. `worker-notify.js` — Email/WhatsApp, concurrency 8

---

## 3. ARCHITETTURA (V18.3 DAG)

```
POST /api/analyze
       ↓
DAG Orchestrator (BullMQ FlowProducer)
       ↓
scrapeQueue → ocrQueue → llmExtractionQueue → deterministicScoringQueue → reportRenderQueue → notificationQueue
```

**Principio fondante:** AI estrae. Il motore deterministico decide.
**Mai invertito:** l'AI non prende decisioni di business finali.

---

## 4. DATABASE SCHEMA

**Tabelle Prisma (gestite da prisma db push):**
- `Job` — job di analisi con status pipeline
- `Immobile` — dati calcolati dell'immobile
- `JobEvent` — event sourcing immutabile
- `ClientToken` — autenticazione
- `AuditHash` — forensic SHA-256 step-by-step
- `ReportArtifact` — metadati PDF
- `IdempotencyKey` — prevenzione doppi pagamenti
- `CircuitBreakerState` — stato circuit breaker
- `ModelVersion`, `PromptVersion` — versionamento AI
- `WorkerMetric` — metriche worker
- `DiscoveredAuction` — aste dal crawler
- `ReviewQueue` — approvazione umana report
- `ActivityLog` — log attività

**Tabelle Ledger (gestite da init-ledger.js, PostgreSQL nativo):**
- `session_counters_v13_4` — sequencer atomico distribuito
- `event_store_v13_4` — ledger append-only con trigger freeze
- `idempotency_ledger_v13_4` — cache idempotenza

---

## 5. FRONTEND

**File principale:** `public/index.html`
**Script:** `public/preanalisi.js`
**Funzionamento:** URL asta + email → POST /api/analyze → polling → risultato semaforo → pagamento Stripe

**Pagine disponibili:**
- `public/index.html` — landing + form analisi
- `public/aste.html` — interfaccia analisi aste
- `public/demo.html` — demo
- `public/landing.html` — landing alternativa
- `public/success.html` — post-pagamento
- `public/cancel.html` — cancellazione

---

## 6. VARIABILI AMBIENTE (stato al 2026-06-06)

| Variabile | Stato | Note |
|-----------|-------|------|
| DATABASE_URL | ✅ | PostgreSQL Railway |
| STRIPE_WEBHOOK_SECRET | ✅ | Live |
| STRIPE_PUBLISHABLE_KEY | ✅ | Live |
| NODE_ENV, BASE_URL, CORS | ✅ | |
| RESEND_API_KEY | ✅ | Solo-invio |
| **STRIPE_SECRET_KEY live** | ⏳ | DA AGGIUNGERE |
| **Dominio Resend verificato** | ⏳ | DA VERIFICARE |
| ANTHROPIC_API_KEY | ? | Verificare su Railway |

---

## 7. TIERS DI SERVIZIO

| Tier | Prezzo | Consegna | Contenuto |
|------|--------|----------|-----------|
| Analisi Asta (Starter) | €69 | 24h | Risk score, criticità, PDF base |
| Full Report (Professional) | €129 | 48h | + Planimetria, offerta max, firma |
| Investor Report | €299 | 48h | + Piano negoziale, briefing 20min |
| Due Diligence Completa | €690 | 48h | Pipeline completa multi-agent |

**Pagamenti:** PayPal (`paypal.me/externalopinion`) + Bonifico (IBAN IT27 R036 6901 6001 0055 1288 818, Revolut)
**Stripe:** checkout integrato in pipeline

---

## 8. PIPELINE COMPLETATA (storico)

- 16/05/2026 09:08 — Analisi completata: `9c84046971664b27667e73bd925702e2.pdf`
- 16/05/2026 11:03 — Analisi completata: `MO1123-ORDINANZA DI VENDITA.pdf`

**Revenue validata:** €0 (pre-revenue, zero pagamenti processati)

---

## 9. AZIONI BLOCCANTI (in ordine)

1. **Railway build verde** → build in corso (push del 2026-06-06)
2. **STRIPE_SECRET_KEY live** → stripe.com → Developers → API keys
3. **Dominio Resend verificato** → esternalopinion.it DNS su Cloudflare
4. **Deploy Netlify** → eseguire `DEPLOY_NETLIFY.bat` (doppio clic)
5. **Primo pagamento reale** → sblocca sviluppo

---

## 10. FILE SORGENTE CHIAVE

| File | Ruolo |
|------|-------|
| `server-v18.3.js` | Entry point API |
| `dag-orchestrator.js` | Orchestratore pipeline |
| `src/engines/core-engine-v13.4.js` | Risk Engine |
| `src/workers/worker-scoring.js` | Motore deterministico |
| `prisma/schema.prisma` | Schema DB |
| `scripts/init-ledger.js` | Setup ledger forense |
| `middleware-security.js` | Security + healthcheck |
| `stripe-webhook-handler.js` | Pagamenti |
| `public/index.html` + `preanalisi.js` | Frontend |
| `Dockerfile` + `railway.toml` | Deploy Railway |
| `netlify.toml` | Deploy Netlify |
