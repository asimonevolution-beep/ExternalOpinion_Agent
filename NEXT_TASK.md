# NEXT TASK — External Opinion
# Aggiornato: 2026-06-12

## P0 — IMMEDIATO

### 1. Evadi il pagamento €79 del 3 giugno
- Vai su Stripe Dashboard → Payments → trova `cs_live_a1yehOmy8zRjNn839vfiYi...`
- Rintraccia il cliente (card details) e consegna manualmente ciò che ha pagato
- La sessione ha metadata vuoto (vecchio payment link), nessuna email salvata

### 2. DNS Resend — sblocca email
Aggiungi questi 3 record in **Cloudflare per externalopinion.it**:

| Tipo | Nome | Valore |
|------|------|--------|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCvv1m26u48Ic5tKtMqN6UedImIxUZJ3Nl00YWJrcd9HZurP+gkI/ntYo0rU2bd/4xgOEMBf7pskMnocE/LnEcDmJFOcYu1E2cWQfm2HIqTfkWTec8hIQ0MEvJgoGf+xuEiapPQLGhopScWGnXUmWXJSMTG0emEB8mIR7gvRnlijwIDAQAB` |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |

Dopo: https://resend.com/domains → clicca "Verify". Propagazione 5-30 min.

## P1 — FIX TECNICI (prossima sessione)

### 3. Fix Valore Attuale "—" in GET /api/jobs/:jobId
**File**: `server-v18.3.js` righe 330–342
**Fix**: aggiungere nell'oggetto `responseData.immobile`:
```js
valoreAttuale:    jobRecord.immobile.valoreAttuale,
valorePotenziale: jobRecord.immobile.valorePotenziale,
```

### 4. Fix ROI 0.0% → "N/D"
**Opzione A (worker):** `src/workers/worker-scoring.js` — salvare `roi: null` invece di `roi: 0` quando `costiTotaliOperativi <= 0`
**Opzione B (display):** `public/preanalisi.js` — mostrare "N/D" quando `immobile.roi === 0`
Raccomandazione: Opzione A (corretta alla fonte)

### 5. Fix stripe-webhook-handler.js email footer
**File**: `stripe-webhook-handler.js` riga 178
**Fix**: `External Opinion — Perizie immobiliari con AI` → `External Opinion — Analisi immobiliari con AI`

### 6. Test email post-DNS
Dopo aver configurato i DNS Resend:
1. Invia email test diretta via API Resend
2. Verifica ricezione su a.simonevolution@gmail.com
3. Poi testa flusso completo: pagamento → webhook → email conferma cliente

## P2 — DOPO PRIMO INCASSO

### 7. PIPELINE_ENABLED=true (quando BullMQ/report è stabile)
### 8. Stripe Dashboard: rimuovi "Sandbox" dal nome business (Settings → Public info)
```
