# STATO SISTEMA — Verificato 2026-06-08

## Tutto operativo ✅

| Componente | Stato | Verificato |
|---|---|---|
| Backend Railway | ✅ Live | `{"status":"alive","version":"v3-f0ea437"}` |
| Database PostgreSQL | ✅ Connesso | `"database":"connected"` |
| Redis | ✅ Connesso | `"redis":"connected"` |
| Stripe pagamenti | ✅ Live (sk_live_) | webhook 400 = firma richiesta |
| Pre-analisi endpoint | ✅ Risponde | risk_score 55, MODERATE |
| Analyze endpoint | ✅ Crea job | jobId generato |
| Frontend Netlify | ✅ 200 OK | externalopinion.netlify.app |
| PDF generabile | ✅ | reports/ABRAMO_CASE_DIAGNOSTIC_PREVIEW.pdf |

## Materiali outreach pronti

| File | Canale | Ticket |
|---|---|---|
| `outreach/FORUM_ASTE_POST.txt` | Telegram/Facebook gruppi aste | €69–€249 |
| `outreach/CTU_GEOMETRI_PITCH.txt` | Albo CTU / LinkedIn geometri | €150–€499 |
| `outreach/TIKTOK_SCRIPT_CASO_ABRAMO.txt` | TikTok / Instagram Reels | €69 ingresso |

## Unico blocco rimasto (azione umana)

- [ ] Webhook Stripe live su dashboard.stripe.com → punta a:
      `https://externalopinionagent-production-1f66.up.railway.app/api/stripe/webhook`
      evento: `checkout.session.completed`

- [ ] Dominio Resend verificato (Cloudflare DNS) → sblocca email automatiche a clienti

## Per incassare subito (senza aspettare webhook)

PayPal: paypal.me/externalopinion
IBAN: IT27 R036 6901 6001 0055 1288 818 (Revolut — Edilizia Sartoriale di Simone Azzali)
Consegna: Gmail con PDF allegato manualmente
