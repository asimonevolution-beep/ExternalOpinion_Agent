# CURRENT STATE — External Opinion / CASCADE
# Aggiornato: 2026-06-12

## Railway production
- **Commit deployato**: `91cac13` (in deployment — push avvenuto alle ~09:30)
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
- **BLOCCATO**: dominio externalopinion.it `status: failed`
- Errore: 403 "domain is not verified"
- Fix: aggiungere 3 record DNS in Cloudflare (vedi NEXT_TASK.md)
- API key valida, il blocco è SOLO DNS

## Bug noti (diagnosi completata)
- **Valore Attuale "—"**: valoreAttuale mancante in GET /api/jobs/:jobId response (server-v18.3.js righe 330-342)
- **ROI 0.0%**: safeRoiCalculation ritorna 0 quando costiTotaliOperativi=0 — LLM non estrae costi espliciti

## Qualifiche
- CTU/Geometra/albo/perizia(nostra): bonificati in tutte le pagine pubbliche e worker
- Disclaimer "Analisi tecnica di parte a scopo informativo..." presente in: index.html, landing.html, aste.html, demo.html, worker-notify.js (email), worker-report.js (PDF), worker-aste.js (PDF)
- Residuo: stripe-webhook-handler.js riga 178 ("Perizie immobiliari con AI" — da cambiare in "Analisi")
