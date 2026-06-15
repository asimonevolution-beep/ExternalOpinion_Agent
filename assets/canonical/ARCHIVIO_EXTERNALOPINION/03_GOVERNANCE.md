# GOVERNANCE — EXTERNALOPINION
## Ruoli risorse, comandamenti, guard

---

## I TRE COMANDAMENTI (committati nel repo, commit 2b3fff3)

1. **L'ASSET STABILITO NON SI TOCCA.** Verbatim. Vietato ricostruire, riformulare, aggiungere, tradurre, interpretare.
2. **ATTRITO → STOP.** Attrito = l'input non combacia con l'asset stabilito. L'esecutore si ferma e chiede. Blocco automatico, non una scelta.
3. **L'IRREVERSIBILE LO TOCCA SOLO CODE.** GPT e Gemini solo bozze. Mai un generatore esegue l'irreversibile.

## RUOLI

- **Simone** = struttura + visione. Unico gate sull'irreversibile.
- **Claude (chat)** = materializzatore. Traduce visione in sistema. Decide modelli/strumenti. Scrive i comandi.
- **Claude Code** = unico esecutore con enforcement reale (guard hook). Codice/infra/repo.
- **ChatGPT** = generatore testo / strategia commerciale. Solo bozze.
- **Gemini** = generatore ricerca / SEO. Solo bozze/liste.

**Il confronto Simone↔Claude può cambiare il percorso. Le altre risorse no: eseguono ciò che è già stabilito.**

## ASSET CANONICI

- `docs/COMANDAMENTI.md` — i tre comandamenti (commit 2b3fff3)
- `assets/canonical/` — cartella asset intoccabili
- `guard-canonical.sh` — hook PreToolUse su Write/Edit: blocca modifica/cancellazione di asset canonici GIÀ esistenti, permette creazione di nuovi. exit 2 = blocco reale. Commit fbab099. Attivo al riavvio di Claude Code.

## GUARD HOOK ESISTENTE (guard.sh / guard.mjs — tre livelli)

**Livello A — FROZEN (blocca):** schema.prisma, stripe-webhook-handler.js, file payment/checkout, migration SQL, .env.production
**Livello B — GUARDED (permette ma notifica):** worker-scoring.js, src/workers/*
**Livello C — FREE:** UI/docs/test

**Bash bloccati:** git push force/master, prisma migrate reset, db push --force-reset, drop/truncate, rm -rf, install bullmq/puppeteer (P0).

## FORMATO OPERATIVO

Ogni risposta operativa: CERTO / INCERTO / ATTRITI / AUTOMAZIONE POSSIBILE / PROSSIMA AZIONE + LIVELLO (MOTORE/APPLICAZIONE).
Regola: qualsiasi azione delegabile al sistema non va mai delegata all'umano.

## STILE OPERATIVO SIMONE

Comandi secchi, blocchi copia-incolla singoli, niente scrolling, niente analisi ripetuta. Dettatura vocale (mai leggere codice ad alta voce). Script sempre PowerShell-compatibili (non bash). Email sempre: a.simonevolution@gmail.com. P.IVA 03880920362. Tel 389 9008042.

## POSIZIONAMENTO PROFESSIONALE (vincolo invariabile)

Tecnico di cantiere con esperienza diretta su grandi opere (incluso Palazzo dei Congressi di Riccione) e costi reali di costruzione/ristrutturazione + AI proprietaria.
**VIETATO in ogni copy/report/comunicazione:** "CTU", "geometra/Geom.", "perizia", "albo".