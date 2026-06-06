# EXTERNAL OPINION — MVP STATUS
**Aggiornato: 2026-06-06 · Fonte: ARCHITECTURE_V18.3.md, registro_attivita.txt, AZIONI_UMANE.md**

---

## STATO SINTETICO

| Area | Stato | Note |
|------|-------|------|
| Backend V18.3 (DAG pipeline) | ✅ Operativo | Server avvia, 6 worker attivi |
| Database PostgreSQL | ✅ Configurato | Railway |
| Ledger Forense v13.4 | ✅ Integrato | Init automatico all'avvio |
| Core Engine v13.4.0 | ✅ Deployato | `src/engines/core-engine-v13.4.js` |
| Endpoint /api/v1/preanalisi | ✅ Attivo | Score testato: 99 CRITICAL |
| Stripe webhook | ✅ Configurato | Live |
| Railway build | ⏳ In corso | Push del 2026-06-06 |
| Frontend Netlify | ⚠️ Deploy errato | `DEPLOY_NETLIFY.bat` pronto |
| STRIPE_SECRET_KEY live | ⏳ Mancante | Blocca pagamenti |
| Dominio Resend verificato | ⏳ Mancante | Blocca email transazionali |
| Revenue | ❌ €0 | Pre-revenue |

---

## PIPELINE VERIFICATA IN PRODUZIONE

2 analisi completate il 16/05/2026:
- `9c84046971664b27667e73bd925702e2.pdf` → completata
- `MO1123-ORDINANZA DI VENDITA.pdf` → completata

La pipeline funziona. Il blocco è commerciale (pagamenti), non tecnico.

---

## COMPONENTI COMPLETATI ✅

### Backend
- [x] API Gateway Express V18.3 con Helmet, CSP, rate limiting
- [x] DAG Orchestrator BullMQ FlowProducer (6 code specializzate)
- [x] Worker Scraper (Puppeteer, concurrency 2)
- [x] Worker OCR (Tesseract, concurrency 4)
- [x] Worker LLM (Claude → OpenAI → Gemini fallback chain)
- [x] Worker Scoring deterministico (ZERO AI, coherence index, ROI engine)
- [x] Worker Report (PDFKit)
- [x] Worker Notify (email/WhatsApp)
- [x] Circuit Breaker pattern (5 failures → OPEN, cooldown 30s)
- [x] Idempotency system (prevenzione doppi pagamenti)
- [x] Forensic hashing SHA-256 step-by-step
- [x] Event sourcing (JobEvent immutabile)
- [x] Health check endpoints (/health/live, /health/ready, /health/metrics)
- [x] Prometheus metrics
- [x] Stripe checkout + webhook handler
- [x] Job watchdog (riavvio job bloccati ogni 10 min)
- [x] Portal crawler cron (02:00 UTC)
- [x] Review queue (approvazione umana)
- [x] Core Engine v13.4.0 (runDeterministicInference + buildNarrativeAndFindings)
- [x] Endpoint POST /api/v1/preanalisi
- [x] Ledger forense v13.4 (3 tabelle + trigger append-only)
- [x] EventEmitter.defaultMaxListeners = 30 (fix BullMQ warning)

### Database
- [x] Schema Prisma con 14 modelli
- [x] Tabelle ledger v13.4 (init automatico)
- [x] Indici ottimizzati
- [x] Prisma db push nel Dockerfile

### Infrastruttura
- [x] Dockerfile (node:20-slim + openssl)
- [x] .dockerignore (esclude node_modules, log, file pesanti)
- [x] railway.toml (healthcheck /health/live, timeout 300s)
- [x] netlify.toml (publish = public, BOM rimosso)
- [x] scripts/fs-gatekeeper.js (fix estensione .txt)
- [x] DEPLOY_NETLIFY.bat (un doppio clic)

---

## COMPONENTI MANCANTI ⏳

### Bloccanti per il primo pagamento
- [ ] **Railway build verde** — in attesa verifica
- [ ] **STRIPE_SECRET_KEY live** — da aggiungere nelle variabili Railway
- [ ] **Deploy Netlify corretto** — eseguire DEPLOY_NETLIFY.bat

### Bloccanti per revenue scalabile
- [ ] **Dati OMI integrati** — CSV Agenzia Entrate in PostgreSQL (2-3 giorni)
- [ ] **Confidence score calibrato** — Alta/Media/Bassa basato su dati OMI
- [ ] **PDF professionale firmabile** — template con numero protocollo, spazio firma

### Fase 2 (non bloccanti ora)
- [ ] Comparable sales engine
- [ ] Forecast 12-36 mesi (Prophet/ARIMA)
- [ ] Firma digitale (DocuSign/Namirial)
- [ ] API pubblica documentata (OpenAPI)
- [ ] White-label multi-tenant
- [ ] Batch API portfolio NPL

---

## SYSTEM PROMPT AGENT (v15.0)

Il SYSTEM_PROMPT.txt definisce il comportamento dell'agente AI per le analisi:
- Estrazione dati dalla perizia PDF
- Stima mercato con dati OMI
- Analisi finanziaria (ROI affitto/rivendita, breakeven, massimale offerta)
- Verdetto semaforo (VERDE ≥80, GIALLO 60-79, ROSSO <60)
- Riferimenti normativi obbligatori (DPR 380/2001, art. 63 disp. att. c.c., D.Lgs. 149/2022)

**Modello business nel prompt:**
- Report TEASER (gratuito): semaforo + 1 rischio + massimale oscurato
- Report PREMIUM (€129): tutto completo
- Abbonamento Base €29/mese: 5 analisi | Pro €79/mese: illimitate + call

---

## VARIABILI AMBIENTE (stato al 2026-06-06)

| Variabile | Stato |
|-----------|-------|
| DATABASE_URL PostgreSQL | ✅ |
| STRIPE_WEBHOOK_SECRET live | ✅ |
| STRIPE_PUBLISHABLE_KEY live | ✅ |
| NODE_ENV, BASE_URL, CORS | ✅ |
| RESEND_API_KEY | ✅ (solo-invio) |
| STRIPE_SECRET_KEY live (sk_live_) | ⏳ MANCANTE |
| Dominio Resend verificato | ⏳ DA FARE |
| ANTHROPIC_API_KEY | ❓ Verificare su Railway |

---

## ENDPOINT API DISPONIBILI

| Metodo | Endpoint | Funzione |
|--------|----------|----------|
| POST | /api/analyze | Crea job analisi (non-blocking) |
| GET | /api/jobs/:jobId | Polling stato job |
| POST | /api/jobs/:jobId/checkout | Avvia pagamento Stripe |
| POST | /api/v1/preanalisi | Pre-screening gratuito (Core Engine v13.4) |
| GET | /health/live | Liveness probe |
| GET | /health/ready | Readiness probe (DB + Redis) |
| GET | /health/metrics | Prometheus metrics |
| GET | /api/version | Versione deploy |
| GET | /api/setup | Checklist variabili ambiente |
