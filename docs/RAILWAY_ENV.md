# RAILWAY — Variabili d'ambiente obbligatorie
**Fonte di verità per il deploy Railway. Aggiornare MANUALMENTE su railway.app → progetto → Variables.**

---

## Come aggiornare

1. Aprire https://railway.app
2. Progetto → **Variables**
3. Aggiungere o modificare ogni variabile sotto
4. Railway esegue il redeploy automaticamente

---

## Stato Stripe (verificato 2026-06-15) — ✅ LIVE E OPERATIVO

| Variabile | Valore atteso | Stato attuale | Azione |
|-----------|----------------|---------------|--------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | ✅ `sk_live_...` configurata | nessuna |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | ✅ `pk_live_...` configurata | nessuna |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (live endpoint) | ✅ `whsec_...` configurata | nessuna |
| `BASE_URL` | `https://externalopinion.netlify.app` | ✅ configurata | nessuna |
| `CORS_ORIGIN` | `https://externalopinion.netlify.app,https://externalopinion.it` | verificare entrambe le origini | verificare |

Account Stripe `acct_1TYlSo...` (IT/EUR): `charges_enabled=true`, `payouts_enabled=true`, KYC completo, nessun requisito pendente. Il checkout genera sessioni `cs_live` valide e il form di pagamento si apre. Nessuna azione richiesta su Stripe.

---

## Variabili già corrette (verificare esistano)

| Variabile | Note |
|-----------|------|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` — verificare non scaduta |
| `DATABASE_URL` | PostgreSQL Railway — già configurata |
| `REDIS_URL` | Redis Cloud — già configurata |
| `RESEND_API_KEY` | `re_VoDL242F_...` — verificare dominio verificato su resend.com |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `WORKER_SUBSET` | `scraper,ocr,llm,scoring,report,notify` |
| `CONFIDENCE_THRESHOLD` | `0.3` |
| `ADMIN_REVIEW_EMAIL` | `a.simonevolution@gmail.com` |

---

## Stripe: webhook endpoint

Il webhook Stripe deve puntare a:
```
https://externalopinionagent-production-1f66.up.railway.app/api/stripe/webhook
```

Evento da abilitare: `checkout.session.completed`

---

## Nota CORS

Il backend accetta origini multiple separate da virgola:
```
CORS_ORIGIN=https://externalopinion.netlify.app,https://externalopinion.it
```
Quando il dominio custom `.it` sarà attivo su Netlify, entrambi i valori saranno necessari.
