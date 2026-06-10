# 🎯 PRIMA VENDITA — SPRINT 14 GIORNI
**Inizio**: 2026-06-10  
**Target**: Prima transazione pagata entro 2026-06-24  
**Obiettivo**: €79–€149 per report (prezzo unitario asta)

---

## 📊 METRICHE FINALI RICHIESTE

| Metrica | Target | Note |
|---------|--------|------|
| **First paid report** | 1 ordine completato | Confermato + PDF entregato |
| **Revenue W1-W2** | €79–€299 | 1–4 report venduti |
| **Qualità del PDF** | Firmabile professionista | Almeno 1 perito CTU lo accetta |
| **Uptime sito** | >99% | DNS propagato, SSL attivo |
| **Form completion rate** | >50% | Chi entra in /aste deve arrivare a pagamento |

---

## 🚀 AZIONI PER BLOCCO (Ordine esecuzione rigido)

### **BLOCCO A: INFRASTRUTTURA & DOMINIO (Giorni 1–2)**
**Criticità**: MASSIMA — tutto dipende da questo

#### A1: DNS Fix Hostinger → Railway ⏱ 30 min (+ 1–24h propagazione)
**Status**: Non fatto  
**Azione**:
1. Accedi Hostinger control panel
2. Vai **DNS Settings** per externalopinion.it
3. Aggiungi CNAME record:
   - **Nome**: @ (root)
   - **Valore**: `rail.app` (o subdomain Railway specifico)
   - **TTL**: 3600
4. Verifica in Railway dashboard: custom domain setup
5. Railway auto-genera SSL cert (Let's Encrypt, 5–10 min)

**Checkpoint**: `nslookup externalopinion.it` deve risolvere a IP Railway

**Contingency**: Se propagazione DNS lenta (>4h), usa Railway preview URL per teste landing intanto

---

#### A2: Railway Upgrade a Hobby ($5/mo) ⏱ 5 min
**Perché**: Trial ha $4.94 rimanenti — non bastano per lancio (Stripe webhook + BullMQ job = consumo immediato)  
**Azione**:
1. Railway Dashboard → Settings → Billing
2. Add payment method (qualsiasi carta, anche tesoro personale)
3. Upgrade Plan a Hobby ($5/mo)
4. Verifica quota: 100 GB RAM · 100 GB storage · illimitato egress

**Cost**: $5/mo = ~€4.80 · imputabile su prime 2-3 vendite

---

#### A3: Env Vars Produzione ⏱ 10 min
**Aggiungi a Railway** (Settings → Variables):
```
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
NODE_ENV=production
API_BASE_URL=https://externalopinion.it
```

**Non dimenticare**: Aggiorna anche `.env.production` localmente per test pre-deploy

---

### **BLOCCO B: LANDING PAGE ASTE (Giorni 2–4)**
**Criticità**: ALTA — è il primo touchpoint pagante

#### B1: Route `/aste` endpoint GET ⏱ 1h
**File**: `src/routes/aste.js`  
**Output**: HTML landing page statica + form embed  
**Requirements**:
```
GET /aste
Response:
- Hero section: "Valutazione immobile per asta giudiziaria — €79"
- Form 5 campi semplici:
  1. Indirizzo (required)
  2. Lotto/Tribunale (optional ma consigliato)
  3. Email cliente (required)
  4. Telefono (required)
  5. Note aggiuntive (textarea, max 500 char)
- CTA button: "Procedi a pagamento" → POST /aste/checkout
- T&C link + privacy
```

**Design**: Minimale, mobile-first, dark theme consistente con brand  
**Tempo stimato**: 45 min (HTML + Tailwind CSS base)

---

#### B2: Route `/aste/checkout` endpoint POST ⏱ 2h
**File**: `src/routes/aste.js`  
**Azione**:
1. Valida input form (email, indirizzo not empty)
2. Crea Stripe Checkout Session:
   ```javascript
   const session = await stripe.checkout.sessions.create({
     mode: 'payment',
     payment_method_types: ['card'],
     line_items: [{
       price_data: {
         currency: 'eur',
         product_data: { name: 'Perizia asta immobiliare' },
         unit_amount: 7900 // €79 in cents
       },
       quantity: 1
     }],
     success_url: 'https://externalopinion.it/aste/success?session_id={CHECKOUT_SESSION_ID}',
     cancel_url: 'https://externalopinion.it/aste/cancel'
   });
   ```
3. Salva metadata in PostgreSQL:
   ```sql
   INSERT INTO stripe_sessions (session_id, email, indirizzo, status)
   VALUES (?, ?, ?, 'pending')
   ```
4. Redirect a `session.url`

**Tempo stimato**: 1h 45 min

---

#### B3: Webhook Stripe `checkout.session.completed` ⏱ 1h
**File**: `src/webhooks/stripe.js`  
**Azione** (quando cliente paga con successo):
1. Verifica signature webhook (sicurezza)
2. Estrai metadata: email, indirizzo, telefono
3. Trigger BullMQ job:
   ```javascript
   await analizzaAstaQueue.add('perizia', {
     sessionId: session.id,
     indirizzo: session.metadata.indirizzo,
     email: session.metadata.email
   });
   ```
4. Salva in DB: `status='paid'`
5. Invia email notifica istantanea al cliente

**Tempo stimato**: 1h

---

#### B4: Email di conferma (transazionale) ⏱ 30 min
**Tool**: Resend API (già in roadmap per Cloudflare)  
**Template semplice**:
```
Subject: "Perizia asta ricevuta — ordine #XYZ"

Caro/a cliente,

Pagamento ricevuto per la valutazione immobile in [INDIRIZZO].

Stiamo elaborando la perizia. La riceverai per email entro 2-4 ore.

Codice ordine: [SESSION_ID]
Importo pagato: €79

Domande? Rispondi a questa email.

Cordiali saluti,
ExternalOpinion
```

**Tempo stimato**: 20 min setup + Resend API integration

---

**Totale Blocco B**: 4–5 ore (1 giorno sviluppatore)

---

### **BLOCCO C: PDF PERIZIA ASTE (Giorni 4–7)**
**Criticità**: ALTISSIMA — il deliverable che genera revenue

#### C1: BullMQ Worker — Trigger analizza_caso.py ⏱ 2h
**File**: `src/workers/asta-perizia.worker.js`  
**Logica**:
```javascript
// Quando job "perizia" entra in coda
await analyzeAstaPython({
  indirizzo: job.data.indirizzo,
  sessionId: job.data.sessionId,
  format: 'json' // python ritorna JSON strutturato
});

// Aspetta output Python
const analisiJSON = await pythonProcess.result;

// Passa a generazione PDF
await generateAstaPDF(analisiJSON);
```

**Timeout BullMQ**: 60 secondi (Python call + AVM lookup OMI)

**Tempo stimato**: 1h 45 min

---

#### C2: Python Module — analizza_caso.py Enhancement ⏱ 3–4h
**File**: `ml/analizza_caso.py`  
**Input**: Indirizzo + Lotto + Tribunale (dal form)  
**Output**: JSON strutturato per PDF
```json
{
  "indirizzo": "Via Roma 10, Milano MI",
  "tipologia": "Appartamento",
  "superficie": 85,
  "piano": 3,
  "stato_conservativo": "Buono",
  "omi_min": 4500,
  "omi_max": 5200,
  "omi_medio": 4850,
  "stima_valore": "€412.250",
  "note": "Zona centrale, metratura coerente con comparabili OMI"
}
```

**Implementazione**:
1. **Geocodifica indirizzo** → lat/lon (Google Maps API free tier)
2. **Lookup OMI** da PostgreSQL:
   ```python
   # Trova zona catastale da indirizzo
   zona = db.query(OmiZone).filter(ST_Contains(geom, point)).first()
   # Estrai range €/mq
   omi_range = db.query(OMIData).filter_by(zona=zona.id).first()
   ```
3. **Calcola stima**:
   ```python
   superficie_m2 = extract_from_indirizzo(indirizzo)
   stima = omi_range.medio * superficie_m2
   ```
4. **Ritorna JSON** al worker Node.js

**Dipendenza**: Dati OMI già caricati in PostgreSQL (Blocco D.1)

**Tempo stimato**: 3h

---

#### C3: PDF Template — Puppeteer HTML→PDF ⏱ 2–3h
**File**: `src/pdf/asta-perizia.template.js`  
**Input**: JSON da Python + sessionId  
**Output**: PDF firmabile (A4, <500KB)

**Sezioni PDF obbligatorie**:
1. **Header** (logo EO + data)
2. **Dati immobile** (indirizzo, lotto, tribunale, tipologia)
3. **Valutazione OMI** (tabella range min/medio/max, stima totale)
4. **Note conservativo** (placeholder da input form)
5. **Disclaimer legale** (piccolo, ma necessario)
6. **Firma cliente** (campo blank per firma manuale/digitale)

**Techniche**:
- Usa HTML template con Handlebars (variabili @indirizzo, @stima_valore, etc.)
- Puppeteer converts HTML → PDF
- Salva su Railway storage (temp) oppure S3-compatible (Cloudflare R2 - gratis primo 10GB)

**Formato PDF**: A4 landscape, 2-3 pagine max

**Tempo stimato**: 2h 30 min

---

#### C4: Storage PDF + Email Download ⏱ 1h
**Opzione A (semplice)**: Railway storage ephemeral
- Pro: Zero config
- Contro: File scompaiono se Pod muore

**Opzione B (robusto)**: Cloudflare R2 (10GB gratis)
- Pro: Persistente, CDN, cost-effective
- Contro: Setup 15 min

**Per FASE 0**: Usa **Opzione A temporaneo**, pianifica R2 se scalas

**Workflow**:
1. Puppeteer genera `/tmp/perizia_[sessionId].pdf`
2. Upload a storage
3. Genera URL download
4. Invia via Resend email con allegato o link

**Tempo stimato**: 45 min

---

**Totale Blocco C**: 7–9 ore (circa 1.5 giorni sviluppatore)  
**Dipendenza critiche**:
- ✅ Stripe webhook functional (Blocco B.3)
- ⏳ Dati OMI in PostgreSQL (Blocco D.1)

---

### **BLOCCO D: DATI OMI — FONDAMENTO AVM (Giorni 5–6)**
**Criticità**: ALTA — senza questo, AVM non funziona

#### D1: Download + Import Dataset OMI Agenzia Entrate ⏱ 2–3h
**Fonte**: https://www.agenziaentrate.gov.it/portale/web/guest/omi  
**Format**: CSV zone catastali + valori €/mq per tipologia

**Azione**:
1. Scarica dataset ufficiale (pubblico, gratuito)
2. Parse CSV → SQL script
3. Carica in PostgreSQL:
   ```sql
   CREATE TABLE omi_data (
     id SERIAL PRIMARY KEY,
     zona_catastale VARCHAR(20) UNIQUE,
     provincia VARCHAR(2),
     comune VARCHAR(100),
     tipologia VARCHAR(50), -- 'Apartment', 'House', etc.
     prezzo_min_mq DECIMAL,
     prezzo_medio_mq DECIMAL,
     prezzo_max_mq DECIMAL,
     data_aggiornamento DATE,
     geom GEOMETRY
   );
   ```

**Seed initial**: ~8.000 zone + 5 tipologie = ~40.000 righe (2 MB dataset)

**Tempo stimato**: 2h 30 min

---

#### D2: API Interna `GET /api/v1/omi/:indirizzo` ⏱ 1h
**Endpoint privato** per uso interno  
**Logica**:
```javascript
// geocodifica indirizzo → lat/lon
const coord = await geocode(indirizzo);
// query PostGIS: quale zona catastale contiene questo punto?
const zona = await db.raw(`
  SELECT * FROM omi_data 
  WHERE ST_Contains(geom, ST_Point(?, ?))
`, [coord.lon, coord.lat]);
// ritorna range
return {
  zona: zona.zona_catastale,
  min: zona.prezzo_min_mq,
  medio: zona.prezzo_medio_mq,
  max: zona.prezzo_max_mq
};
```

**Tempo stimato**: 45 min

---

**Totale Blocco D**: 3–4 ore (mezzo giorno)

---

### **BLOCCO E: TEST & DEPLOYMENT (Giorni 7–10)**
**Criticità**: MEDIA — critical path ma veloce se senza bug

#### E1: End-to-End Test (forma E2E, non automata) ⏱ 2h
**Scenario**: Simula cliente reale che ordina

**Checklist**:
- [ ] Accedi externalopinion.it/aste (HTTPS valid certificate)
- [ ] Compila form: "Via Roma 10, Milano"
- [ ] Click "Procedi a pagamento"
- [ ] Stripe checkout carica (card: 4242 4242 4242 4242)
- [ ] Post-payment: pagina success visibile
- [ ] Email ricevuta (check inbox Resend)
- [ ] PDF allegato/link funziona, apre correttamente
- [ ] PDF contiene: indirizzo, stima OMI, disclaimer

**Bug fix rapido**: Se fallisce, fix e re-test (max 1h)

**Tempo stimato**: 2h

---

#### E2: Production Deployment ⏱ 30 min
**Stack**:
1. Commit all code: `git add . && git commit -m "Fase 0: landing + checkout + PDF"`
2. Push a `master`: `git push origin master`
3. Railway auto-deploys (watch build logs)
4. Smoke test su prod URL

**Checkpoint**: externalopinion.it caricabile, form responsive

**Tempo stimato**: 20 min (se build OK)

---

**Totale Blocco E**: 2.5–3 ore

---

### **BLOCCO F: GTM & PRIMA VENDITA (Giorni 8–14)**
**Criticità**: MEDIA-ALTA — conversion dipende da outreach

#### F1: Target List Periti CTU ⏱ 2h
**Canali**:
1. **Forum Perizie.net** (3–5 periti attivi)
2. **Gruppi Facebook** "CTU Tribunali Italiani" (20–50 members)
3. **LinkedIn**: Search "Perito immobiliare" location Italy (connessioni)
4. **Email diretta**: Se trovi contatti in profili professionali

**Azione**: Prepara lista 15–20 contatti con email/messenger

**Tempo stimato**: 1h 30 min

---

#### F2: Messaggio Outreach (copia vinci) ⏱ 1h
**Tema**: "Risparmia 3 ore su ogni perizia asta con AI"

**Messaggio corto** (LinkedIn):
```
Ciao [Nome],

Aggiornamento veloce: abbiamo lanciato ExternalOpinion.it —
generazione automatica perizie aste in 5 minuti, non 3 ore.

Primo report €79. Non richiede registrazione.

Demo gratuita per periti CTU:
→ externalopinion.it/aste

Buona fortuna con le tue CTU.

[Firma]
```

**Email** (forum + contatti privati):
```
Subject: Perizie asta in 5 minuti? Prova ExternalOpinion (1o report gratis)

[Stesso corpo, versione email]

Demo gratuita:
externalopinion.it/aste

Codice sconto (max 5 periti): BETA2026 → €49/report prima volta

Domande? Rispondi pure.
```

**Tempo stimato**: 45 min

---

#### F3: Outreach & Follow-up (Giorni 9–14) ⏱ 3–4h distribuito
**Piano settimanale**:
- **Giorno 1** (L): Invia messaggi LinkedIn + post nei forum (30 min)
- **Giorno 2** (Ma): Invia email dirette + commenta in gruppi FB (30 min)
- **Giorno 3–4** (Me-Gi): Follow-up chi ha visitato senza ordinare (30 min)
- **Giorno 5** (V): Revisione conversioni, rispondi a domande (30 min)

**Target**: ≥20 visite a /aste nel periodo  
**Conversion rate minima**: 10% → 2 ordini

**Tempo totale**: 2h distribuito

---

#### F4: Customer Support (Live) — Giorni 10–14 ⏱ 2–3h
Se cliente ordina, fornisci:
- Risposta email entro 2 ore
- Chiarimenti su PDF se necessario
- Refund se insoddisfatto (30-day guarantee)

**Criteri accettazione PDF** (internamente):
- PDF apre senza errore
- Contiene indirizzo + stima valore
- Firmabile (spazio firma visibile)

---

**Totale Blocco F**: 8–9 ore distribuito (intera settimana, non full-time)

---

## 📅 TIMELINE CONSOLIDATO

| Giorno | Data | Blocco | Attività | Ore | Owner |
|--------|------|--------|----------|-----|-------|
| **1** | 2026-06-10 | A | DNS fix Hostinger | 0.5 | Dev |
| **1** | 2026-06-10 | A | Railway upgrade | 0.1 | Dev |
| **1** | 2026-06-10 | A | Env vars | 0.2 | Dev |
| **2** | 2026-06-11 | B | Landing /aste | 0.75 | Dev |
| **2** | 2026-06-11 | B | POST /aste/checkout | 2 | Dev |
| **2** | 2026-06-11 | B | Webhook Stripe | 1 | Dev |
| **2** | 2026-06-11 | B | Email template | 0.5 | Dev |
| **3–4** | 2026-06-12 ~13 | D | Download OMI + import | 2.5 | Dev |
| **3–4** | 2026-06-12 ~13 | D | API OMI lookup | 0.75 | Dev |
| **4–5** | 2026-06-13 ~14 | C | BullMQ worker | 2 | Dev |
| **4–5** | 2026-06-13 ~14 | C | Python analizza_caso.py | 3.5 | ML/Dev |
| **5–6** | 2026-06-14 ~15 | C | Puppeteer PDF template | 2.5 | Dev |
| **6** | 2026-06-15 | C | Storage + email PDF | 1 | Dev |
| **7** | 2026-06-16 | E | E2E test | 2 | Dev |
| **7** | 2026-06-16 | E | Production deploy | 0.5 | Dev |
| **8** | 2026-06-17 | F | Target list periti | 2 | Simone |
| **8–9** | 2026-06-17 ~18 | F | Scrivi outreach | 1 | Simone |
| **9–14** | 2026-06-18 ~24 | F | Outreach + follow-up | 2 | Simone |
| **9–14** | 2026-06-18 ~24 | F | Support cliente (live) | 2–3 | Dev |

**Totale ore sviluppo**: ~25 ore (3 giorni full-time o 5 giorni part-time)  
**Totale ore GTM**: ~5 ore (sparpagliate)

---

## 🎯 CHECKPOINTS CRITICI (Go/No-Go)

| Giorno | Checkpoint | Go condition | Action No-Go |
|--------|------------|--------------|-------------|
| **2** | DNS resolve | `nslookup externalopinion.it` → IP Railway | Retry DNS, o usa preview URL Railway |
| **3** | Landing + Stripe | /aste carica, form valida, checkout session crea | Debug Stripe API keys |
| **4** | OMI in DB | `SELECT COUNT(*) FROM omi_data` > 0 | Re-import CSV, check parse errors |
| **6** | PDF generates | BullMQ job completa, PDF exists | Debug Puppeteer, test template HTML |
| **7** | E2E success | Test card 4242 paga, email ricevuta, PDF ok | Fix bugs rapidamente, loop E1 |
| **8** | Deploy prod | externalopinion.it stable >10 min | Rollback, debug Railway logs |
| **10** | Lead first | ≥1 persona clicca form | Expand outreach channels, adjust messaging |
| **14** | First sale | ≥1 ordine pagato completato | Post-mortem, iterate GTM |

---

## 💰 REVENUE FORECAST (Best Case Scenario)

| Evento | Probabilità | Timing | Revenue |
|--------|-------------|--------|---------|
| First test order (team) | 95% | Giorno 7-8 | €79 |
| Perito CTU #1 order | 60% | Giorno 10-12 | €79 |
| Perito CTU #2 order | 40% | Giorno 13-14 | €149 (upgrade) |
| **Total Fase 0 W1-W2** | — | **Entro 14 giorni** | **€307–€500** |

**Metrica vincente**: ≥1 ordine reale (non test) da persona estranea

---

## ⚠️ RISCHI & CONTINGENCY

| Rischio | Probabilità | Impatto | Mitigation |
|---------|-------------|--------|-----------|
| DNS propagazione >24h | 10% | -1 giorno vendita | Usa Railway preview URL intanto |
| Stripe live key sbagliato | 5% | -2 ore debug | Controlla sandbox first |
| Python script timeout | 15% | Pdf non genera | Cached OMI lookup, max 30s timeout |
| Puppeteer PDF crash | 10% | Consegna fail | Fallback HTML email con tabella |
| Perito non risponde outreach | 70% | Ma 1-2 su 20 risponde | Increase volume target list |
| Primo ordine è scam/chargeback | 5% | Reputazione Stripe | Manual review payment, Anti-fraud |

---

## 📋 DELIVERABLES FINALI (Day 14)

**Code**: 
- [ ] Landing page `/aste` live su externalopinion.it
- [ ] Stripe integration end-to-end
- [ ] PDF generator per aste
- [ ] OMI data seeded PostgreSQL
- [ ] BullMQ worker processando orders

**Revenue**:
- [ ] ≥1 transazione confermata + PDF consegnato

**Proof**:
- [ ] Screenshot email ricevuta (order confirmation)
- [ ] Screenshot PDF (redacted indirizzo se privato)
- [ ] Stripe dashboard: ≥1 successful charge EUR 79.00

---

## 📱 CHECKLIST DAILY DEV

**Giorni 1–7** (Build phase):
- [ ] Commit daily con `git log` tracciabile
- [ ] Test ogni blocco PRIMA di passare al successivo
- [ ] Log su TodoWrite progresso

**Giorni 8–14** (GTM + support):
- [ ] Monitor Stripe dashboard ogni mattina (notifiche nuovi ordini)
- [ ] Email response SLA <2 ore
- [ ] Slack/Discord per emergenze cliente

---

**Ora**: Iniziamo Blocco A domani mattina presto. Sei pronto? 🚀
