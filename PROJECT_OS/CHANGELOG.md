# CHANGELOG — External Opinion

---

## Sessione diurna 2026-06-12

### TASK 1 — Checkout Live (continuazione P1)

**Stato:** RISOLTO (era sessione stantia, non bug di codice)

Indagine completa:
- Codice `createCheckoutSession` → usa `checkoutSession.url` direttamente (no URL manuale). ✅
- `preanalisi.js` → usa `data.checkoutUrl`, naviga con `window.location.href`. ✅
- Railway deployato a commit `6133eeb` (più recente). ✅
- Sessioni Stripe `cs_live_*` caricate correttamente (HTTP 200, "Stripe Checkout"). ✅
- Il "page not found" riportato era una sessione stantia/scaduta, non un bug strutturale.

**Pagamento storico trovato:** `cs_live_a1yehOmy8zRjNn839vfiYi...` — €79 del 2026-06-03, `status: complete`, `payment_status: paid`. Metadata `{}` → webhook ha ricevuto l'evento ma lo ha saltato (`reportId` mancante). **Nessun job/email associato.** Richiede evasione manuale. Notifica inviata su ntfy.

**URL checkout fresco valido (24h):**
```
https://checkout.stripe.com/c/pay/cs_live_a1uelsgD4O0B1C19ZB8P4m8j06wncCzX3FqWQuGu345r6rrusfmfgptFSG#fidnandhYHdWcXxpYCc%2FJ2FgY2RwaXEnKSdicGRmZGhqaWBTZHdsZGtxJz8nZmprcXdqaScpJ2R1bE5gfCc%2FJ3VuWmlsc2BaMDRRXGlWajRVbkMwbUFdNzBcMj1KTWlqYm5RSjN9VzNzZldmQkt2MjwxZFBWbDA0N2g3YHJiUWJDRGxHXWFBS113alNvd1NXdU9QXTA3cFNUPVF%2FMEF8RlU1NXVoUXNwMDZSJyknY3dqaFZgd3Ngdyc%2FcXdwYCknZ2RmbmJ3anBrYUZqaWp3Jz8nJmNjY2NjYycpJ2lkfGpwcVF8dWAnPyd2bGtiaWBabHFgaCcpJ2BrZGdpYFVpZGZgbWppYWB3dic%2FcXdwYHgl
```

---

### TASK 2 — ROI 0.0% / Valore Attuale "—" (solo diagnosi)

**Non fixato** (entrambi i fix toccano file non autorizzati per questa sessione).

#### Bug A — Valore Attuale "—"
**Causa:** `server-v18.3.js` righe 330–342 (endpoint `GET /api/jobs/:jobId`) non include `valoreAttuale` né `valorePotenziale` nella risposta JSON. Il worker-scoring.js calcola e salva entrambi in DB. Il frontend riceve `undefined` → `'—'`.

**Fix richiesto (una riga):**
```js
// server-v18.3.js righe 330-342, in responseData.immobile aggiungere:
valoreAttuale:    jobRecord.immobile.valoreAttuale,
valorePotenziale: jobRecord.immobile.valorePotenziale,
```
**File:** `server-v18.3.js` (non autorizzato questa sessione)

#### Bug B — ROI 0.0%
**Causa:** `safeRoiCalculation(profit, 0)` ritorna `0` quando `costiTotaliOperativi = 0`. L'LLM non estrae costi espliciti dalla perizia → costi = 0 → protezione divisione per zero → ROI = 0. Il frontend mostra `(0 * 100).toFixed(1) + '%'` = "0.0%".

**Fix richiesto:** distinguere "ROI calcolato = 0" da "ROI non calcolabile". Opzioni:
1. `preanalisi.js`: mostrare "N/D" quando `immobile.roi === 0 && immobile.costiTotaliOperativi === 0`
2. `worker-scoring.js`: salvare `roi: null` invece di `roi: 0` quando `costiTotaliOperativi <= 0`
**File:** `preanalisi.js` e/o `worker-scoring.js` (non autorizzati per TASK 2 questa sessione)

---

### TASK 3 — Bonifica qualifiche (verifica + completamento)

**Risultato:** ✅ Nessun residuo visibile utente trovato.

**Verificato:**
| File | CTU | Geometra (utente) | Perizia (nostra) | Albo | Disclaimer |
|------|-----|-------------------|------------------|------|------------|
| `public/index.html` | ✅ | ✅ | ✅ | ✅ | ✅ aggiunto |
| `public/landing.html` | ✅ | ✅ | ✅ | ✅ | ✅ aggiunto |
| `public/demo.html` | ✅ | ✅ | ✅ | ✅ | ✅ aggiunto |
| `public/aste.html` | ✅ | ✅ | ✅ | ✅ | ✅ aggiunto |
| `worker-notify.js` (email) | ✅ | ✅ | ✅ | ✅ | ✅ già presente |
| `worker-report.js` (PDF) | ✅ | ✅ | ✅ | ✅ | ✅ già presente |
| `worker-aste.js` (PDF aste) | ✅ | ✅ | ✅ | ✅ | ✅ già presente |

**Residuo non correggibile (file riservato P1):**
- `stripe-webhook-handler.js` riga 178: `External Opinion — Perizie immobiliari con AI` (footer email conferma pagamento)
- Fix: cambiare in `Analisi immobiliari con AI`

**Note:** `geometrie` in `index.html` è termine geometrico tecnico, non il titolo professionale. Intestazioni file `Direzione Tecnica: Geometra Simone Azzali` sono commenti codice interni, non user-facing.

**Commit:** `91cac13` — deploy in corso su Railway + Netlify.

---

### TASK 4 — Test email end-to-end

**Stato:** ❌ BLOCCATO — DNS Resend non configurato

**Errore esatto:**
```json
{"statusCode":403,"message":"The externalopinion.it domain is not verified. Please, add and verify your domain on https://resend.com/domains","name":"validation_error"}
```

**Cause:** I 3 record DNS richiesti da Resend non sono stati aggiunti a Cloudflare.

**Record da aggiungere in Cloudflare per `externalopinion.it`:**

| Tipo | Nome | Valore |
|------|------|--------|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCvv1m26u48Ic5tKtMqN6UedImIxUZJ3Nl00YWJrcd9HZurP+gkI/ntYo0rU2bd/4xgOEMBf7pskMnocE/LnEcDmJFOcYu1E2cWQfm2HIqTfkWTec8hIQ0MEvJgoGf+xuEiapPQLGhopScWGnXUmWXJSMTG0emEB8mIR7gvRnlijwIDAQAB` |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |

**Dopo aver aggiunto i record:** attendere propagazione DNS (5-30 min), poi cliccare "Verify" su https://resend.com/domains.

**Nota:** `RESEND_API_KEY` è valida e funzionante. Il blocco è SOLO DNS.

---

## Sessione notturna 2026-06-12 (da sessione precedente)

### TASK 1 — Pagamenti: fix codice + analisi sandbox

**Fix applicati (commit 58d01ea)**
| File | Modifica |
|------|----------|
| `stripe-webhook-handler.js` | Aggiunto mapping `79: 'TIER_1_CASCADE_79'` in `TIER_MAPPING` |
| `netlify.toml` | Aggiunto proxy `/aste/*` → Railway |
| `server-v18.3.js` | Aggiunto `require('./db')` mancante in `POST /aste/checkout` |
| `.gitignore` | Aggiunto `.netlify/` |

### TASK 3 — Bonifica qualifiche (commit 6133eeb)

22 sostituzioni in 7 file — vedere CHANGELOG sessione notturna per dettaglio completo.

### RESEND_API_KEY

Chiave reale impostata su Railway: `re_A7byXPsN_AuresTqjbQzPVRcwwwF8jBkj`
