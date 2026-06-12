# NEXT TASK — External Opinion
# Aggiornato: 2026-06-12 (sessione pomeriggio)

## P0 — IMMEDIATO

### 1. Evadi il pagamento €79 del 3 giugno
- Vai su Stripe Dashboard → Payments → trova `cs_live_a1yehOmy8zRjNn839vfiYi...`
- Rintraccia il cliente (card details) e consegna manualmente ciò che ha pagato
- La sessione ha metadata vuoto (vecchio payment link), nessuna email salvata

## P1 — IN CORSO AUTOMATICO

### 2. Verifica email Resend (polling automatico attivo)
- DNS già configurati su Cloudflare ✅
- Verifica triggerata, polling ogni 5 min (max 30 min)
- A verifica ok: test email automatico + ping "EMAIL ATTIVE ✅"
- Se fallisce: ping con errore esatto su eo-dev-83562128
- Verifica manuale: `.\scripts\check-email.ps1`

## P2 — DOPO PRIMO INCASSO

### 3. PIPELINE_ENABLED=true (quando BullMQ/report è stabile)
### 4. Stripe Dashboard: rimuovi "Sandbox" dal nome business (Settings → Public info)

## FIX GIÀ APPLICATI (commit 9837af5 — deploy SUCCESS)
- ✅ valoreAttuale + valorePotenziale in GET /api/jobs/:jobId
- ✅ roi = null quando costiTotaliOperativi = 0
- ✅ Email footer: "Analisi immobiliari con AI"
