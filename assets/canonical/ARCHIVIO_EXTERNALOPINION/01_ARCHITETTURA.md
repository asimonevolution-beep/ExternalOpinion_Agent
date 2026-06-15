# ARCHITETTURA TECNICA — EXTERNALOPINION
## Stato verificato del codebase (fonte: audit reale, non memoria)

---

## STACK REALE

- **Linguaggio:** JavaScript puro (Node.js ESM) — MAI TypeScript. Non convertire.
- **Backend:** Express, Railway (progetto "enchanting-optimism", servizio ExternalOpinion_Agent, environment production)
- **DB:** PostgreSQL + Prisma
- **Queue:** Redis + BullMQ (congelato finché non ci sono vendite reali)
- **Frontend:** Netlify → externalopinion.netlify.app / externalopinion.it (Hostinger)
- **AI:** Claude (narrativa tecnica primaria) + GPT-4o (consensus secondario)
- **Pagamenti:** Stripe + PayPal
- **Email:** Resend
- **Notifiche:** Twilio WhatsApp + ntfy (eo-pay-83562128 pagamenti, eo-dev-83562128 governance/deploy)
- **Repo:** github.com/asimonevolution-beep/ExternalOpinion_Agent (privato)
- **Locale:** C:\ExternalOpinion_Agent
- **Railway project ID:** 885dcc5f-5be1-4294-b5f6-b0dbf2d31a98
- **Cloudflare zone ID:** d8f01ad8e667e7bf0c499c057e6989ea

## STRUTTURA CODEBASE

- Codebase v18.3, ~70 file, JavaScript puro
- `server.js` = shim → `server-v18.3.js` (entrypoint reale)
- Motore scoring reale: `worker-scoring.js` → produce VERDE/GIALLO/ROSSO + coherenceIndex + ROI
- Moduli attivi: geometry_engine, CARICO_ASTE, INPUT_PERZIE, analizza_caso.py
- Cartelle standard: src/engines/, src/workers/, src/routes/, src/types/, src/frontend/components/, prisma/

## SCHEMA PRISMA REALE (modelli)

Job, Immobile, JobEvent, ClientToken, ActivityLog, AuditHash, ReportArtifact, IdempotencyKey, DiscoveredAuction, ReviewQueue, CircuitBreakerState

## VERDICT SCHEMA (IMMUTABILE)

`VERDE` | `GIALLO` | `ROSSO`
**MAI usare:** PROCEDERE/NEGOZIARE/EVITARE, né LOW/MEDIUM/HIGH come schema unico, né varianti TypeScript.

## COSA NON ESISTE (non ricreare da vecchia doc/memoria)

- EGCL (Event Graph Consistency Layer / WebhookEvent/CanonicalEvent/EventJobMap) → NON esiste nel codice reale
- EQP (Execution Quality Perception / HumanCorrection/EQPAssessment/EQPPattern/ExpertRule) → NON esiste
- Symbiotic Loop Engine → progettato, mai deployato
- F7 verdetti PROCEDERE/NEGOZIARE/EVITARE → non esiste

## GAP TRACCIATI

- **G1 (risolto):** webhook riempiva code morte senza consumer. Fix: idempotency atomica (crea IdempotencyKey prima della transazione, cattura P2002) + notifyManual via ntfy quando PIPELINE_ENABLED≠'true'.
- **G2 (validazione aperta):** test idempotency via resend. Test: `stripe trigger checkout.session.completed` poi `stripe events resend <event_id>`.
- **G3 (aperto):** due pipeline coesistono — worker.js/analysisQueue (vecchia) vs src/workers/* (nuova, 8 worker). NON crearne una terza. Consolidare verso una sola. src/workers/* è quella che gira in produzione.

## VINCOLO P0 (non negoziabile)

Nessuna attivazione BullMQ / Puppeteer / OMI finché non ci sono vendite reali confermate.
Collo di bottiglia reale = acquisizione lead + primo incasso, NON engineering.
NEXT_ACTION.md nel repo: "Unica azione attiva: build Railway verde. Tutto il resto congelato fino al primo pagamento."

## REGOLE DATABASE (MAI)

MAI prisma migrate reset, MAI drop/truncate, MAI db push --force-reset.

## REGOLE GIT

Commit piccoli e atomici, messaggi chiari. NON pushare su master senza approvazione: usa branch.