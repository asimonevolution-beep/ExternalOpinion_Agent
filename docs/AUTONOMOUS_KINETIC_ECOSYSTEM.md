# EXTERNAL OPINION — AUTONOMOUS KINETIC ECOSYSTEM
**Version:** 1.0 · **Commit base:** b97d310 · **Date:** 2026-06-07

---

## 1. Definizione

L'**Autonomous Kinetic Ecosystem** è il modello operativo di External Opinion in cui ogni
componente — frontend, backend, DB, pipeline AI, lead tracking — si auto-sostiene, si
auto-diagnostica e produce valore senza intervento umano sul percorso critico.

"Kinetic" = energia già in moto. Non si aspetta. Si misura, si corregge, si avanza.

---

## 2. Architettura V18.3 DAG

```
Browser (Netlify)
  └─ POST /api/analyze
       └─ Railway Node.js (server-v18.3.js)
            ├─ createJob() → PostgreSQL (Job, Immobile, JobEvent)
            ├─ trackLead() → PostgreSQL (LeadEvent) [fire-and-forget]
            └─ createAnalysisPipeline() → BullMQ FlowProducer
                 ├─ worker-scraper   → scrape URL asta
                 ├─ worker-ocr       → estrai testo PDF perizia
                 ├─ worker-llm       → analisi Claude (Anthropic)
                 ├─ worker-scoring   → Core Engine v13.4.0 deterministico
                 ├─ worker-report    → genera PDF
                 └─ worker-notify    → Resend email
```

**Tier corrente:** TIER_1_SCREENING_69 (€69) — DAG termina a SCORING → READY_FOR_PAYMENT.
Il report completo (worker-report + worker-notify) si attiva dopo pagamento Stripe.

---

## 3. Stack di produzione

| Layer | Tecnologia | URL / endpoint |
|---|---|---|
| Frontend | Netlify (static) | https://externalopinion.netlify.app |
| Backend | Railway (Dockerfile) | https://externalopinionagent-production-1f66.up.railway.app |
| Database | PostgreSQL Railway | kodama.proxy.rlwy.net:23040 |
| Queue | Redis Cloud (BullMQ) | waves-sweater-extensive-59426.db.redis.io:15679 |
| AI | Anthropic Claude | API sk-ant-api03-* |
| Pagamenti | Stripe TEST → LIVE | Dashboard stripe.com |
| Email | Resend | API re_VoDL242F_* |
| Proxy API | netlify.toml redirect | /api/* → Railway |

---

## 4. Lead Funnel con tracciamento completo

Ogni utente che entra nel funnel è tracciato dalla prima visita al pagamento:

```
PAGE_VIEW           → apertura landing (browser, sendBeacon)
FORM_STARTED        → primo input su URL o email (browser, once)
FORM_SUBMITTED      → POST /api/analyze ricevuto (server)
JOB_CREATED         → Job Prisma creato con successo (server)
PAYWALL_HIT         → GET /api/jobs/:id/checkout richiesto (server)
CHECKOUT_STARTED    → sessione Stripe creata (server)
PAYMENT_SUCCESS     → webhook Stripe confermato (server, TODO)
```

Modello Prisma: `LeadEvent` — id, createdAt, email, url, eventType, tier, jobId, ip, source, metadata

---

## 5. Modelli Prisma (15 totali)

Job · Immobile · JobEvent · ClientToken · ActivityLog · ModelVersion · PromptVersion ·
WorkerMetric · AuditHash · ReportArtifact · IdempotencyKey · DiscoveredAuction ·
ReviewQueue · CircuitBreakerState · **LeadEvent** (aggiunto 2026-06-07)

---

## 6. CORS — whitelist di produzione

```js
const PRODUCTION_ORIGINS = [
  'https://externalopinion.netlify.app',
  'https://externalopinion.it',
  'https://www.externalopinion.it',
];
```

Hardcoded in `server-v18.3.js` — indipendente da Railway env CORS_ORIGIN.

---

## 7. Stato deploy (2026-06-07)

| Sistema | Commit attivo | Stato |
|---|---|---|
| GitHub | b97d310 | ✅ Aggiornato |
| Netlify | 605c2d3 | ✅ Live |
| Railway | f0ea437 | ⚠️ 5 commit indietro — redeploy manuale richiesto |

**Railway non ha auto-deploy GitHub attivo.**
Trigger manuale: railway.app → Deployments → Deploy.

---

## 8. Friction points risolti in questa sessione

| Problema | Fix | Commit |
|---|---|---|
| netlify.toml mancava proxy /api/* | Aggiunto redirect → Railway | cb82d48 |
| CORS_ORIGIN Railway mancava netlify.app | Hardcoded PRODUCTION_ORIGINS | b97d310 |
| Nessun tracciamento lead | Modello LeadEvent + trackLead() | 778fb0e |
| PAGE_VIEW non inviato | initLeadTracking() in preanalisi.js | 605c2d3 |
| POST /api/lead-event assente | Endpoint aggiunto server-v18.3.js | 605c2d3 |
| MaxListenersExceededWarning | defaultMaxListeners = 50 | (sessione precedente) |

---

## 9. Prossimo stato target

1. Railway redeploy → CORS fix + lead tracking attivi
2. STRIPE_SECRET_KEY live su Railway → pagamenti reali
3. PAYMENT_SUCCESS LeadEvent via webhook Stripe
4. Primo pagamento reale → validazione funnel end-to-end
