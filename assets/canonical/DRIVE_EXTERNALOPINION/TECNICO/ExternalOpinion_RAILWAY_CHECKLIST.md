# RAILWAY DEPLOY CHECKLIST
# External Opinion v2.1 — Decision Product
# Data: 2026-06-04

---

## PRIMA DI INIZIARE — Recupera questi valori

- [ ] `RESEND_API_KEY` → resend.com → Login → API Keys → Create API Key (free)
- [ ] `ANTHROPIC_API_KEY` → console.anthropic.com → API Keys → Create Key
- [ ] `STRIPE_WEBHOOK_SECRET` → dashboard.stripe.com → Developers → Webhooks → Add endpoint → copia secret
- [ ] `STRIPE_SECRET_KEY` → dashboard.stripe.com → Developers → API Keys → Secret key
- [ ] Scegli un `ADMIN_KEY` — qualsiasi parola segreta lunga

---

## DEPLOY RAILWAY — ORDINE ESATTO

### Step 1 — Accedi
- [ ] Vai su railway.app
- [ ] Login con GitHub (account asimonevolution-beep)

### Step 2 — Nuovo progetto
- [ ] New Project → Deploy from GitHub repo
- [ ] Seleziona: `ExternalOpinion_Agent`
- [ ] Branch: `master`

### Step 3 — Variabili ENV
- [ ] Vai su Settings → Variables
- [ ] Aggiungi in questo ordine:
```
RESEND_API_KEY=re_...
STRIPE_WEBHOOK_SECRET=whsec_...
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_live_...
ADMIN_KEY=parola_segreta
```

### Step 4 — Start Command
- [ ] Vai su Settings → Deploy
- [ ] Start Command: `node orchestrator.js`
  ⚠️ NON `node server-v18.3.js`

### Step 5 — Deploy e verifica
- [ ] Clicca Deploy → attendi 2-3 min
- [ ] Apri: `https://TUO-URL.up.railway.app/health`
- [ ] Risposta attesa: `{"status":"ok"}`

### Step 6 — Stripe webhook
- [ ] dashboard.stripe.com → Webhooks → Add endpoint
- [ ] URL: `https://TUO-URL.up.railway.app/webhook/stripe`
- [ ] Events: `checkout.session.completed`

### Step 7 — Manda URL a Claude
- [ ] Claude aggiorna BACKEND_URL nel frontend → rideploy Netlify → sistema live

---

## NETLIFY — carica questi 5 file
1. index.html
2. sitemap.xml
3. robots.txt
4. netlify.toml
5. _headers
