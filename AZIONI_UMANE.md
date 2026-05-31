# AZIONI UMANE — External Opinion
> Incolla ogni valore qui sotto nel terminale Claude non appena lo hai.

---

## 1. Stripe secret key live
**→ stripe.com → Live mode → Developers → API keys → Secret key → Reveal**

```
Incolla: sk_live_...
```

---

## 2. Resend API key
**→ resend.com → API Keys → Create API Key → nome: "prod"**

```
Incolla: re_...
```

---

## 3. Verifica dominio su Resend (dopo il punto 2)
**→ Resend → Domains → Add → externalopinion.it → copia i 3 record DNS**
**→ Cloudflare → DNS → aggiungi i record → torna Resend → Verify**

Nessun valore da incollare — dimmi solo "verificato".

---

## STATO

| # | Azione | Stato |
|---|--------|-------|
| 1 | sk_live_ Stripe | ⏳ |
| 2 | RESEND_API_KEY | ✅ (solo-invio) |
| 3 | Dominio Resend verificato | ⏳ |
| — | DATABASE_URL PostgreSQL | ✅ |
| — | STRIPE_WEBHOOK_SECRET live | ✅ |
| — | STRIPE_PUBLISHABLE_KEY live | ✅ |
| — | NODE_ENV, BASE_URL, CORS | ✅ |
