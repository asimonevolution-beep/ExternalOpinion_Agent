# EXTERNAL OPINION — TASKS
**Aggiornato: 2026-06-06 · Fonte: NEXT_ACTION.md, AZIONI_UMANE.md, stato corrente**

---

## BLOCCO ATTIVO

> **Una sola azione prioritaria:** build Railway verde.
> Tutto il resto è congelato fino al primo pagamento reale.

---

## P0 — BLOCCANTI ASSOLUTI (da fare ora)

| # | Task | Azione | Stato |
|---|------|--------|-------|
| P0.1 | Railway build verde | Verificare log su railway.app → Deployments | ⏳ In attesa |
| P0.2 | STRIPE_SECRET_KEY live | stripe.com → Live mode → Developers → API keys → Reveal | ⏳ Azione umana |
| P0.3 | Deploy Netlify corretto | Doppio clic su `DEPLOY_NETLIFY.bat` | ⏳ Azione umana |
| P0.4 | Verifica ANTHROPIC_API_KEY su Railway | Railway dashboard → Variables → check ANTHROPIC_API_KEY | ⏳ Verificare |
| P0.5 | Aggiornare CORS_ORIGIN su Railway | `docs/RAILWAY_ENV.md` → valore corretto | ⏳ Azione umana |
| P0.6 | Aggiornare BASE_URL su Railway | `docs/RAILWAY_ENV.md` → `https://externalopinion.netlify.app` | ⏳ Azione umana |

---

## P1 — PRIMO PAGAMENTO (sblocca tutto)

| # | Task | Note |
|---|------|------|
| P1.1 | Test end-to-end pagamento | URL asta → analisi → Stripe checkout → success |
| P1.2 | Verifica email post-pagamento | Controlla che Resend invii report |
| P1.3 | Dominio Resend verificato | Cloudflare DNS → Resend verify |
| P1.4 | Test report PDF generato | Verifica contenuto e firma |

---

## P2 — MVP COMMERCIALE (dopo primo pagamento)

| # | Task | Priorità | Stima |
|---|------|----------|-------|
| P2.1 | Import dati OMI in PostgreSQL | ALTA | 2-3 giorni |
| P2.2 | Confidence score (Alta/Media/Bassa) | ALTA | 1 giorno |
| P2.3 | Template PDF professionale con firma | ALTA | 2 giorni |
| P2.4 | Landing `/aste` funzionante | ALTA | 1 giorno |
| P2.5 | 5 beta tester CTU gratuiti | ALTA | 1 settimana outreach |
| P2.6 | Comparable sales engine base | MEDIA | 3 giorni |

---

## P3 — CRESCITA (mesi 2-6)

| # | Task | Note |
|---|------|------|
| P3.1 | SaaS subscription multi-tenant | Solo dopo 10 clienti paganti on-demand |
| P3.2 | Firma digitale perizie (DocuSign/Namirial) | Workflow: AI draft → firma perito |
| P3.3 | Forecast 12M (Prophet/ARIMA su OMI) | Differenziale vs Wikicasa/idealista |
| P3.4 | Outreach enterprise early (banche, servicer NPL) | Ciclo vendita 6-12 mesi → iniziare ora |
| P3.5 | BullMQ dashboard admin | @bull-board/express |

---

## P4 — API ED ENTERPRISE (mesi 7-18)

| # | Task | Note |
|---|------|------|
| P4.1 | OpenAPI spec + developer portal | Solo dopo 50+ clienti SaaS |
| P4.2 | Batch endpoint POST /valuations/bulk | Per servicer NPL, webhook completion |
| P4.3 | White-label mode (tenant isolation) | Solo con contratto firmato |
| P4.4 | SLA 99.9% + audit trail AI Act | Per segmento bancario |

---

## DA NON FARE (vincoli strategici)

- ❌ API pubblica prima di 50+ clienti SaaS attivi (troppo costosa da mantenere)
- ❌ White-label senza contratto firmato (spreco risorse)
- ❌ Nuove feature finché KB non è consolidata (vincolo corrente)
- ❌ Usare "$404.9B" in documenti esterni (dato errato — corretto in COMPETITOR_ANALYSIS.md)

---

## AZIONI UMANE RICHIESTE (non automatizzabili)

| Azione | Dove | Urgenza |
|--------|------|---------|
| Verificare log Railway | railway.app → progetto → Deployments | ADESSO |
| Aggiungere STRIPE_SECRET_KEY live | Railway → Variables | ADESSO |
| Doppio clic DEPLOY_NETLIFY.bat | `C:\ExternalOpinion_Agent\DEPLOY_NETLIFY.bat` | ADESSO |
| Verificare ANTHROPIC_API_KEY | Railway → Variables | ADESSO |
| Dominio Resend verificato | Cloudflare DNS + Resend Domains | PRESTO |
