# FUNNEL_HEALTHCHECK.md
*Analisi tecnica: 18 giugno 2026 | Basata su lettura diretta del codice server-v18.3.js*

---

## VERDETTO RAPIDO

| Area | Stato |
|---|---|
| Backend API struttura | OK — endpoint completi e codificati |
| DB + Redis (dipendenze critiche) | DA VERIFICARE su Railway |
| Frontend (5 tasti + URL) | DA VERIFICARE — public/ non letto |
| Upload file (perizia/foto) | KO PROBABILE — non nel body di /api/analyze |
| Stripe pagamento API | OK — tiers configurati, logica checkout presente |
| Stripe webhook | DA VERIFICARE — endpoint esiste, URL su dashboard da confermare |
| Generazione report PDF | DA VERIFICARE — pipeline DAG non letta |
| Pannello admin review | OK — /admin/review funziona (confermato dal codice) |
| Consegna email cliente | DA VERIFICARE — dipendenze Resend/Nodemailer |
| Payment Link diretti | OK — buy.stripe.com già configurati |

**Può vendere oggi in modalità manuale? → SI, con Payment Link + consegna email manuale.**

---

## ANALISI STEP BY STEP

### STEP 1 — Utente apre pagina

| Voce | Stato | Dettaglio |
|---|---|---|
| Express serve frontend statico | OK | `app.use(express.static(path.join(__dirname, 'public')))` — riga 140 |
| CORS configurato | OK | externalopinion.it + www.externalopinion.it in allowedOrigins |
| Dominio DNS | DA VERIFICARE | Cloudflare configurato (da memoria) — puntamento Railway da confermare |
| File coinvolti | `server-v18.3.js:140` | |

**Fix se KO:** verificare che DNS externalopinion.it punti all'URL Railway del server.

---

### STEP 2 — Utente sceglie categoria (5 tasti)

| Voce | Stato | Dettaglio |
|---|---|---|
| Tasti nel frontend | DA VERIFICARE | public/index.html non letto |
| Campo `tipo` accettato dal backend | OK | `/api/analyze` accetta `tipo` nel body — riga 219 |
| Categorie supportate | DA VERIFICARE | Enum non trovato nel codice letto |

**Fix se KO:** i tasti devono popolare il campo `tipo` con: `asta`, `prima_casa`, `investimento`, `compravendita`, `immobile_problematico`.

---

### STEP 3 — Utente incolla URL asta

| Voce | Stato | Dettaglio |
|---|---|---|
| Campo URL nel frontend | DA VERIFICARE | public/ non letto |
| `urlAsta` obbligatorio nel backend | OK | Validato, restituisce 400 se mancante — riga 224 |
| Tracking lead su form submit | OK | `trackLead(FORM_SUBMITTED)` prima del job — riga 246 |

---

### STEP 4 — Upload file (perizia, foto, documenti)

| Voce | Stato | Dettaglio |
|---|---|---|
| Upload nel frontend | DA VERIFICARE | public/ non letto |
| Accettazione file nel backend | KO PROBABILE | Body di `/api/analyze` accetta solo JSON: urlAsta, email, zonaDati. Nessun multipart. |
| Dipendenze disponibili | OK | pdf-parse e sharp presenti — ma non esposti nell'endpoint principale |

**Stato: MANCANTE per il flusso principale.**
**Fix minimo MVP:** il cliente incolla il link della perizia pubblica (es. pvp.giustizia.it) nella nota. Upload file da aggiungere in v2.

---

### STEP 5 — Sistema genera screening/verdetto

| Voce | Stato | Dettaglio |
|---|---|---|
| Screening deterministico gratuito | OK | `POST /api/v1/preanalisi` — zero dipendenze AI/DB/Redis |
| Analisi AI completa (job) | DIPENDE | Richiede PostgreSQL + Redis + ANTHROPIC_API_KEY attivi |
| DAG pipeline | DA VERIFICARE | `dag-orchestrator.js` non letto |
| Fallback AI | MODIFICATO | `ai-fallback-handler.js` modificato recentemente — verificare |

**Blocco critico:** se Railway non ha PostgreSQL o Redis attivi, `/api/analyze` crasha al primo `createJob()`.

---

### STEP 6 — Pagamento

| Voce | Stato | Dettaglio |
|---|---|---|
| Tier disponibili | OK | 6 tier: 69, 79, 89, 150, 690 EUR + Enterprise |
| Checkout Stripe API | OK | `POST /api/jobs/:jobId/checkout` — crea sessione — riga 394 |
| Payment Link diretti | OK | buy.stripe.com già configurati per 69, 89, 150, 690 |
| Tracking paywall | OK | `trackLead(PAYWALL_HIT)` + `trackLead(CHECKOUT_STARTED)` |

---

### STEP 7 — Consegna report dopo pagamento

| Voce | Stato | Dettaglio |
|---|---|---|
| Webhook Stripe endpoint | OK (codice) | `/api/stripe/webhook` montato — `stripe-webhook-handler.js` |
| Webhook URL configurato su Stripe | DA VERIFICARE | Deve essere impostato in Stripe dashboard |
| Job aggiornato dopo pagamento | DA VERIFICARE | Dipende da `stripe-webhook-handler.js` — non letto |
| PDF generato e servito | DA VERIFICARE | `GET /api/jobs/:jobId/report` cerca in `src/workers/OUTPUT_REPORT/` |
| Pannello admin review | OK | `/admin/review` + `/admin/review/:jobId` + approve/reject — riga 543 |
| Email al cliente post-approvazione | DA VERIFICARE | `approveReport()` in `review-queue.js` — non letto |
| Fallback manuale sicuro | OK | Simone vede pagamento su Stripe → va su /admin/review → approva → invia email |

---

## TABELLA PRIORITÀ FIX

| # | Blocco | Stato | Fix minimo | Priorità |
|---|---|---|---|---|
| 1 | PostgreSQL + Redis non attivi su Railway | DA VERIFICARE | Aprire `/api/setup` su Railway e leggere l'output | CRITICO |
| 2 | Webhook Stripe non configurato | DA VERIFICARE | Stripe dashboard → Webhooks → aggiungere URL Railway + `/api/stripe/webhook` | CRITICO |
| 3 | Frontend 5 tasti + campo URL | DA VERIFICARE | Aprire public/index.html e verificare | IMPORTANTE |
| 4 | Consegna email post-pagamento | DA VERIFICARE | Verificare RESEND_API_KEY in Railway env vars | IMPORTANTE |
| 5 | Upload file | KO PROBABILE | Workaround: cliente invia link perizia nella nota | BASSO (V2) |

---

## CHECK MANUALI — COSA DEVE FARE SIMONE ADESSO

**In ordine:**

1. **Railway dashboard** → verifica che PostgreSQL (verde) e Redis (verde) siano attivi e connessi
2. **Apri `/api/setup`** sull'URL del server Railway → leggi l'output JSON, nota tutti i campi ❌
3. **Stripe dashboard** → Developers → Webhooks → verifica endpoint `/api/stripe/webhook` esiste con evento `payment_intent.succeeded`
4. **Apri `/admin/review`** con il tuo ADMIN_TOKEN → verifica che risponda senza errori
5. **Test rapido screening:** vai su externalopinion.it → inserisci dati test → vedi se risponde

---

## VERDETTO FINALE

| Modalità vendita | Possibile oggi? | Dipendenze |
|---|---|---|
| Payment Link diretto + report manuale | **SI** | Solo: Stripe (già OK) + email di Simone |
| Funnel automatico completo | **FORSE** | DB + Redis + Webhook + DAG + email delivery tutti attivi |
| Funnel semi-automatico (job + admin review) | **FORSE** | DB + Redis + Webhook attivi |

**Raccomandazione immediata:**
Vendi con Payment Link diretti. Cliente paga → Simone riceve notifica Stripe → produce report → consegna via email in 24-72h. Zero dipendenze tecniche aggiuntive. Zero rischio di cliente bloccato.
