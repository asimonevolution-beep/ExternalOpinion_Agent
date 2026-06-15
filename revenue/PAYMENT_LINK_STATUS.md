# PAYMENT LINK STATUS

**Aggiornato: 2026-06-15**

---

## Prezzi attivi (da stripe-webhook-handler.js — fonte di verità)
- €69  — TIER_1_SCREENING_69 (Screening Report) — flusso landing
- €79  — TIER_1_CASCADE_79 (Analisi Asta — Verdetto CASCADE) — flusso /aste
- €89  — TIER_1_ENTRY_89 (Entry Report)
- €150 — TIER_2_ADVISORY_150 (Advisory Report)
- €690 — TIER_3_PREMIUM_690 (Premium Report)

---

## Stato pagamento

**STRIPE:** ✅ LIVE E OPERATIVO (verificato 2026-06-15)
- Chiavi live su Railway: `sk_live` + `pk_live` + `whsec_` webhook secret.
- Account `acct_1TYlSo...` (IT/EUR): incassa, payout attivi, KYC completo, nessun requisito pendente.
- Il backend genera sessioni `cs_live` valide; il form di pagamento si apre regolarmente.
- Flusso web (sito → `window.location.href = checkoutUrl`): funzionante, nessun troncamento.

**PAYPAL:** READY — paypal.me/externalopinion (incasso manuale alternativo)

**BONIFICO:** READY — IBAN IT27 R036 6901 6001 0055 1288 818 (Revolut), intestato Edilizia Sartoriale di Simone Azzali

---

## Stato complessivo: ✅ OPERATIVO — Stripe live + metodi manuali disponibili

## Regola operativa sui link
- **Pagamenti dal sito**: già a posto (redirect automatico, link integro).
- **Link inviati a mano** (WhatsApp/email/outreach): NON usare gli URL di checkout session
  (`checkout.stripe.com/.../cs_live_...#...`) perché il frammento dopo `#` si tronca nella copia
  e produce "page not found". Usare i **Payment Links** Stripe (`buy.stripe.com/xxxxx`): corti e stabili.

---

## Note storiche
- Il vecchio P1 "checkout page not found" era un artefatto da URL troncato, NON un bug di codice
  né un problema di account (vedi memoria progetto: project-stripe-p1-checkout).
- Pagamento storico €79 del 2026-06-03 (cs_live_a1yehOmy8z...) pagato ma senza email/metadata:
  da rintracciare manualmente via Stripe Dashboard → Customers.
