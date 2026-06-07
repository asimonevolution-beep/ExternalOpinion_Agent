# AGENT ZERO-FRICTION PROTOCOL
**External Opinion · V18.3 · 2026-06-07**

Protocollo per agenti AI che lavorano su questo repository in modo autonomo.
Zero friction = nessun ciclo sprecato, nessuna azione distruttiva, massima potenza utile.

---

## REGOLA 0 — Leggi prima, agisci dopo

Prima di qualsiasi modifica leggere:
1. `docs/AUTONOMOUS_KINETIC_ECOSYSTEM.md` — stato architetturale corrente
2. `data/kinetic-ecosystem-memory.json` — memoria persistente degli agenti precedenti
3. `git log --oneline -10` — ultimi commit (cosa è già stato fatto)
4. `git status` — modifiche locali non committate

---

## AUTONOMIA PIENA (nessuna conferma richiesta)

- Modificare `server-v18.3.js`, `orchestrator.js`, `dag-orchestrator.js`, worker files
- Modificare `public/preanalisi.js`, `public/index.html`
- Creare/modificare file in `docs/`, `src/`, `data/`
- Eseguire `prisma db push --accept-data-loss` (Railway DB)
- Eseguire `git add`, `git commit`, `git push origin master`
- Eseguire deploy Netlify via CLI (se token disponibile)
- Leggere DB Railway in sola lettura
- Testare endpoint Railway/Netlify via curl

---

## AUTONOMIA CONDIZIONALE (procedere solo se non c'è rischio distruttivo)

- Modificare `prisma/schema.prisma` — OK se si aggiungono modelli/campi, MAI cancellare
- Modificare `netlify.toml` — OK, non rimuovere il redirect `/api/*`
- Aggiornare `lead-tracker.js` — OK, mantenere fire-and-forget

---

## VIETATO (blocco assoluto)

- Modificare `.env` (non committato, contiene segreti reali)
- Cancellare modelli Prisma esistenti
- Rimuovere il redirect `/api/*` da `netlify.toml`
- Modificare `PRODUCTION_ORIGINS` in `server-v18.3.js` rimuovendo `externalopinion.netlify.app`
- Fare `prisma migrate reset` o `DROP TABLE`
- Esporre `DATABASE_URL`, `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY` in commit
- Push force su master

---

## AZIONI CHE RICHIEDONO UMANO

| Azione | Perché |
|---|---|
| Railway redeploy | Nessun auto-deploy da GitHub — trigger manuale su railway.app |
| Railway Variables (CORS_ORIGIN, BASE_URL, Stripe keys) | Nessun Railway CLI autenticato |
| Netlify auth token | Login browser richiesto (usa `netlify login --request`) |
| Stripe live keys | Visione dashboard stripe.com |
| DNS Cloudflare | Accesso pannello Cloudflare |

---

## PROTOCOLLO DI DIAGNOSI (ordine)

```bash
# 1. Stato Railway
curl https://externalopinionagent-production-1f66.up.railway.app/health/live

# 2. Versione Railway attiva
# Il campo "version" nel JSON di /health/live contiene il commit hash

# 3. CORS funzionante
curl -X POST https://externalopinionagent-production-1f66.up.railway.app/api/lead-event \
  -H "Origin: https://externalopinion.netlify.app" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"DIAGNOSTIC"}' -w "\nHTTP:%{http_code}"

# 4. Netlify file live
curl -I https://externalopinion.netlify.app/preanalisi.js | grep HTTP

# 5. LeadEvent DB
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
  p.leadEvent.findMany({orderBy:{createdAt:'desc'},take:5}).then(r=>console.log(JSON.stringify(r))).finally(()=>p.\$disconnect())"

# 6. Jobs DB
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
  p.job.count().then(c=>console.log('jobs:',c)).finally(()=>p.\$disconnect())"
```

---

## FORMATO HANDOFF OBBLIGATORIO

Ogni agente che termina il proprio turno DEVE aggiornare `data/kinetic-ecosystem-memory.json`
e produrre il seguente output:

```
CASCADE ZERO-FRICTION HANDOFF

Most advanced state:      [stato più avanzato raggiunto]
Already solved:           [problemi risolti in questa sessione]
Reused energy:            [decisioni precedenti riutilizzate senza ridiscutere]
Rejected dispersion:      [cosa NON è stato fatto e perché]
Remaining friction:       [friction points ancora aperti]
Minimum decisive action:  [prossima azione minima ad alto impatto]
Human action required:    YES/NO — [se YES: una sola azione esatta]
Files created/modified:   [lista file]
Risks:                    [rischi residui]
Next agent should not redo: [lista di ciò che è già stato fatto]
```

---

## COMMIT CONVENTION

```
feat(scope):   nuova funzionalità
fix(scope):    bug fix
fix(cors):     CORS-specific
feat(tracking): lead tracking
feat(core):    architettura core
docs:          solo documentazione
chore:         manutenzione

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## VERSIONI CRITICHE

| Componente | Versione | File |
|---|---|---|
| Server | v18.3 | server-v18.3.js |
| Core Engine | v13.4.0 | src/engines/edv.js |
| DAG Orchestrator | 18.0 | dag-orchestrator.js |
| Prisma Client | 5.22.0 | package.json |
| Node.js (Railway) | ≥18 | Dockerfile |
