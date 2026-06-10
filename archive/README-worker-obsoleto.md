# worker.js — ARCHIVIATO 2026-06-04

## Perché è stato archiviato

Questo file era la prima implementazione del worker BullMQ per `analysisQueue`.
Usava agenti separati (`agent_scraper`, `agent_parser`, `agent_estimator`) in un processo standalone.

**Non è mai stato importato da `server.js` o `server-v18.3.js`.**
Era avviabile solo tramite `npm run worker` (script separato in package.json).

## Pipeline ufficiale

La pipeline ufficiale è in `src/workers/`:
- `worker-scraper.js` → scraping URL asta
- `worker-ocr.js` → OCR documenti
- `worker-llm.js` → estrazione LLM con fallback cloud
- `worker-scoring.js` → scoring deterministico (VERDE/GIALLO/ROSSO, coherenceIndex, ROI)
- `worker-report.js` → generazione PDF report
- `worker-notify.js` → notifiche email/WhatsApp
- `worker-review.js` → review queue umana

Questi worker vengono caricati in-process da `server-v18.3.js` alla startup (riga ~957).

## Deprecazione package.json

Lo script `"worker": "node worker.js"` in `package.json` punta a questo file archiviato.
Non avviare questo processo in produzione — usa la pipeline integrata nel server.
