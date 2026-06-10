# ⚡ AZIONI MANUALI A.1 + A.2 (5 MINUTI TOTALI)

## ✅ A.1: DNS Fix Hostinger → Railway (2 min)

**1. Apri Hostinger panel:**
```
https://hpanel.hostinger.com → Login
```

**2. Vai su externalopinion.it DNS:**
```
Domains → externalopinion.it → DNS Records
```

**3. Aggiungi o modifica il record CNAME root:**
```
Name: @
Type: CNAME
Value: rail.app
TTL: 3600
```
Clicca **Save/Salva**

**4. Verifica dopo 5-10 min:**
```bash
nslookup externalopinion.it
```
Dovrebbe risolvere a IP Railway (non ancora? Aspetta 1-2h propagazione, usa preview URL intanto)

---

## ✅ A.2: Railway Upgrade a Hobby (2 min)

**1. Apri Railway dashboard:**
```
https://railway.app → Login
```

**2. Seleziona progetto ExternalOpinion:**
```
Your Project → Settings → Billing
```

**3. Click su upgrade:**
```
Hobby Plan ($5/mo)
Add Payment Method → (carta qualsiasi)
Confirm Upgrade
```

**Fatto!** Railway auto-scala, SSL auto-genera.

---

## ⏭️ Dopo che hai fatto A.1 + A.2:
Rispondi "fatto" e procediamo subito con **A.3 (env vars) e BLOCCO B (landing page)** che faccio autonomamente.

⏱ **Tempo totale A.1 + A.2**: ~5 minuti  
🎯 **Criticità**: MASSIMA — tutto blocca senza questi step
