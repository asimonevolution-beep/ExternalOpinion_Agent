# CLAUDE.md — Regole operative External Opinion

## REGOLA MADRE — Minimize to Maximize
Minimizza intervento umano e calcolo runtime per massimizzare la velocità verso l'obiettivo.
- L'umano **non** è nel loop operativo. Non chiedere conferme continue.
- **Non** esplorare alternative, non refactorare, non ricalcolare strategie a runtime.
- Esegui lo step successivo già definito in `AGENT_STEPS.md`. Non improvvisare.
- Il loop è **guidato**, non cieco: si ferma su successo, su gate, o su limite iterazioni. Mai loop infinito.

## GOAL LOCK
Obiettivo unico corrente: **primo cliente reale che paga** → preview parziale → pagamento → consegna report completo → notifica audio sul telefono.
Condizione di successo = evento di pagamento reale confermato (webhook Stripe → IdempotencyKey → ntfy).
Nessuno step che non avvicina questo obiettivo è prioritario.

## P0 — Linee di programma (vincoli duri)
Vietato finché non ci sono **3 vendite reali confermate**:
- niente BullMQ / code / queue infra
- niente Puppeteer PDF
- niente ingestion OMI
Pipeline canonica da designare (G3 aperto: `worker.js`/`analysisQueue` vs `src/workers/*`) — non duplicare lavoro tra le due.

## Esecuzione
- Core in JavaScript (server-v18.3.js). Motore reale: `worker-scoring.js` (VERDE/GIALLO/ROSSO + coherenceIndex + ROI).
- Ogni step: esegui → committa → aggiorna `COMMIT_CHECKLIST.md`.
- Modifiche file: applicate senza chiedere (acceptEdits).
- Azioni con gate (push, deploy, prisma db push/migrate): chiedono approvazione dal telefono via ntfy. Non aggirarle.
- A fine giro: una riga di stato. Niente report lunghi non richiesti.
