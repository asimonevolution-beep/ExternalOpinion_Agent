# CURRENT STATE — External Opinion / CASCADE
# Aggiornato: 2026-06-12 (sessione pomeriggio)

## Railway production
- **Commit deployato**: `9837af5` (SUCCESS — deploy Railway confermato)
- **Status**: LIVE — alive, DB connected, Redis connected
- **URL**: https://externalopinionagent-production-1f66.up.railway.app
- **Stripe**: sk_live_* configurato — checkout è LIVE (cs_live_* confermato)

## Netlify
- **Commit deployato**: `91cac13` (in deployment)
- **URL**: https://externalopinion.netlify.app / https://externalopinion.it
- **Status**: redirect /api/* funzionante, redirect /aste/* funzionante

## Flussi operativi

### Landing (€69 TIER_1_SCREENING_69) — FUNZIONANTE LIVE
1. POST /api/analyze → job creato, pipeline BullMQ enqueued
2. Polling /api/jobs/:jobId → result (ma pipeline spesso fallisce: Puppeteer/scraping KO)
3. POST /api/jobs/:jobId/checkout → checkout Stripe LIVE cs_live_*
4. Pagamento → webhook → notifica ntfy Simone → consegna manuale

### /aste (€79 TIER_1_CASCADE_79) — ATTIVO
- Route /aste/checkout: deployata
- Netlify redirect /aste/*: deployato

## Pagamento storico da evadere
- **cs_live_a1yehOmy8zRjNn839vfiYi...** — €79 del 2026-06-03
- status: complete, payment_status: paid
- email: ASSENTE, metadata: {} (vecchio payment link senza reportId)
- Richiede contatto manuale col cliente (rintracciare via Stripe Dashboard → Customers)

## Variabili Railway
- RESEND_API_KEY: ✅ reale (re_A7byXPsN_...)
- STRIPE_SECRET_KEY: ✅ sk_live_*
- STRIPE_WEBHOOK_SECRET: ✅ configurato
- BASE_URL: ✅ https://externalopinion.netlify.app
- PIPELINE_ENABLED: false (consegna manuale)

## Email (Resend)
- **IN VERIFICA**: DNS (3 record) già presenti su Cloudflare, verifica Resend triggerata
- Stato dominio: `pending` (propagazione in corso, polling ogni 5 min)
- A verifica ok: email test inviata automaticamente, ping ntfy "EMAIL ATTIVE ✅"

## Bug risolti (commit 9837af5)
- **Valore Attuale**: ✅ valoreAttuale + valorePotenziale aggiunti in GET /api/jobs/:jobId
- **ROI 0.0%**: ✅ roi salvato come `null` (non 0) quando costiTotaliOperativi=0
- **Email footer**: ✅ "Perizie immobiliari con AI" → "Analisi immobiliari con AI" (riga 178)

## Script utili (scripts/)
- `check-status.ps1` — stato deploy Railway + ultime 20 righe log
- `check-email.ps1` — stato verifica dominio Resend
- `new-checkout.ps1` — genera checkout live fresco e stampa URL

## Qualifiche
- CTU/Geometra/albo/perizia(nostra): bonificati in tutte le pagine pubbliche e worker
- Disclaimer "Analisi tecnica di parte a scopo informativo..." presente in: index.html, landing.html, aste.html, demo.html, worker-notify.js (email), worker-report.js (PDF), worker-aste.js (PDF)
