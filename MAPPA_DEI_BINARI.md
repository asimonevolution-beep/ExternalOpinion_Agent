# MAPPA DEI BINARI — External Opinion

ID: OBJ-004
Titolo: External Opinion — dal bisogno del cliente al rapporto consegnato (servizio da 10 €)
Classificazione: OBIETTIVO (F001) — mappa richiesta da F002
Obiettivo: acquisire il primo cliente pagante, incassare il prezzo corretto e consegnare un rapporto effettivamente utilizzabile.
Risultato atteso: un cliente reale parte da una pagina pubblica, vede 10 €, paga 10 €, riceve un rapporto leggibile e utilizzabile; ogni passaggio è misurato.
Versione: BOZZA 1 — 2026-11-16 — VALIDAZIONE UMANA: NO
Fonte canonica: questo file nel repository `ExternalOpinion_Agent`. La copia Drive (`mappa-OBJ-004.md`, cartella KERNEL) si prepara solo a versione validata.
Collegamenti: `RAPPORTO_ACQUISIZIONE_EO_v2.md` (prove complete) · `MISSION.md` · `CURRENT_STATE.md` · `NEXT_TASK.md` · `CHANGELOG.md` (tutti fermi a giugno 2026, da riallineare dopo la validazione; `DECISIONS.md` non esiste).

Legenda fonti: **[L]** letto direttamente · **[S]** dichiarazione storica · **[NV]** NON VERIFICABILE · **[D]** decisione già presa da Simone · **[IP]** ipotesi / soluzione da valutare (non decisa).
Regola: Risultato verificato ≠ Percorso verificato ≠ Binario riutilizzabile. In questa bozza nessun binario è riutilizzabile.

---

## 0. Decisioni in vigore (da non rimettere in discussione)

- [D] Prodotto: Analisi completa External Opinion, 10 €, `TIER_1_PROMO_10`, 1000 centesimi. L'effettiva configurazione tecnica è stata acquisita (vedi fase 6).
- [D] Stripe già collaudato dal titolare: non si ripete il collaudo generale.
- [D] ERR-006: External Opinion serve chiunque tocchi un immobile (compra, vende, ristruttura), non solo le aste; le aste sono un caso d'uso.
- [D] ERR-008: il piano si espone per mercato (privato, agenzie/mediatori, consulenti/professionisti, aste, vizi documentali/preventivi/incertezze sui lavori), con azioni, canali, messaggio e costi.
- [D] F007: nessuna azione prima di obiettivo e strada validati dall'umano. F004: acquisizione prima di creazione. ERR-009: nessuna conformità dichiarata senza evidenza.
- [D] Repository principale: `ExternalOpinion_Agent`. `external_opinion` = prototipo precedente (un solo file HTML, giugno 2026), nessun materiale riusabile.
- [D] Il giornale del 22/10 è storico; l'obiettivo operativo attuale è External Opinion.

---

## 1. INDICE (tabella Kernel a sette colonne)

| Sotto-obiettivo | Chi l'ha già raggiunto | Evidenza | Percorso esistente | Verifica misurabile | Stato passo | Esito |
|---|---|---|---|---|---|---|
| F1 Mercato e cliente | NON VERIFICATO | Solo decisioni [D] ERR-006/008; nessun dato di mercato acquisito | Nessuno | Segmenti con problema, urgenza, parole di ricerca e valore economico scritti per ciascun mercato | DA FARE | DA VERIFICARE |
| F2 Intercettazione e acquisizione | NON VERIFICATO | Outreach B2B congelato al 18/06 [S] (`CURRENT_COMMERCIAL_STATE.md`); nessun canale con dati | Nessuno misurato | Visite, provenienza e avvii per canale in un periodo definito | DA FARE | DA VERIFICARE |
| F3 Ingresso e navigazione | NON VERIFICATO | Netlify fermo al 04/08; log 16/11 con referer `index-legacy.html` [L] | Dominio → `index-legacy.html` (69 €) | Una sola pagina pubblicata per dominio, con 10 € e un solo link di acquisto | IN CORSO | FALLITO (P0) |
| F4 Comprensione e fiducia | NON VERIFICATO | `quick-intake.html` in master: promessa di revisione, numeri campione [L] | Pagina nuova nel repo, non pubblicata | Cosa vende / cosa riceve / quando / chi verifica = corrispondono al servizio erogato | IN CORSO | DA VERIFICARE |
| F5 Conversione e apertura pratica | NON VERIFICATO | `POST /api/analyze` con `deferUntilPayment`, upload documenti, `caseId` = `jobId` [L] | App `quick-intake` (master, dominio Railway) | Pratica creata con documenti associati; evento tracciato; contatto valido | IN CORSO | DA VERIFICARE |
| F6 Vendita e pagamento | Stripe collaudato dal titolare [D] | 7 tier accettati, `/aste/checkout` 79 €, `/api/demo/checkout` con `DEMO`; sessioni 69 € [L] | `POST /api/jobs/:id/checkout` | Prezzo mostrato = prezzo addebitato = ordine valido; nessun checkout senza job | IN CORSO | FALLITO (P0) |
| F7 Produzione dell'analisi | Pipeline attiva su job di prova 16/11 [L] | Log: 11 s, confidenza 0,92; OCR passthrough; `periziaLetta` richiesta [L] | scrape → OCR → LLM → scoring → report → notify | Esito per categoria di caso con documenti reali (rapporto o "giudizio non possibile" dichiarato) | IN CORSO | DA VERIFICARE |
| F8 Controllo e consegna | NON VERIFICATO | PDF su disco non persistente; `COMPLETED` anche senza invio; download senza gate [L] | `worker-report` → `worker-notify` | PDF ricevuto dal cliente + evento `NOTIFICATION_SENT` + file ancora scaricabile dopo un deploy | IN CORSO | FALLITO (P0) |
| F9 Relazione con il cliente | NON VERIFICATO | Solo mail di conferma e avviso al titolare [L]; nessun processo di assistenza, recensione, ritorno | Nessuno | Tasso di risposta, chiarimenti, recensioni, ritorni | DA FARE | DA VERIFICARE |
| F10 Misurazione e amplificazione | NON VERIFICATO | `trackLead` (PAGE_VIEW, FORM_SUBMITTED, PAYWALL_HIT, CHECKOUT_STARTED, utm), `/api/admin/stats`, `/api/admin/vendite` [L] | Tracciamento interno, nessun cruscotto | Costo per analisi, conversione per canale, margine | IN CORSO | DA VERIFICARE |

---

## 2. P0 — CONDIZIONI NECESSARIE PER VENDERE CORRETTAMENTE IL SERVIZIO DA 10 €

Ogni voce: FATTO accertato · CONSEGUENZA · SOLUZIONI DA VALUTARE (non decise) · VERIFICA.

### P0-1 Prezzo mostrato e prezzo addebitato
- **Fatti [L]:** il dominio ufficiale serve ancora la pagina del 04/08 con flusso a 69 €. In master `quick-intake` mostra 10 € e addebita 1.000 c. Le ultime sessioni Stripe (04/11, 06/11, 16/11) sono 6.900 c. Il prezzo è deciso lato server per tier, ma il tier lo sceglie il browser tra 7. "Promo fino al 30 novembre" è solo testo.
- **Conseguenza:** il cliente non vede l'offerta decisa; dopo il 30/11 il prezzo reale resta 10 € mentre il testo dice che la promo è scaduta.
- **Da valutare [IP]:** (a) pubblicare su Netlify la versione di master; (b) puntare il dominio al servizio Railway; (c) togliere dal server i tier non venduti; (d) decidere cosa accade al 30/11.
- **Verifica:** pagina pubblicata letta dal dominio ufficiale; sessione di checkout da 1.000 c creata dal percorso pubblico.

### P0-2 Checkout senza ordine valido
- **Fatti [L]:** `/api/demo/checkout` crea una sessione 69 € con `reportId='DEMO'`: il webhook risponde "Ordine DEMO non trovato" (500). `/aste/checkout` vende 79 €. `POST /api/jobs/:id/checkout` non controlla coerenza tra tier e job né se il job è già pagato.
- **Conseguenza:** incasso possibile senza servizio, rimborsi, contestazioni.
- **Da valutare [IP]:** spegnere le rotte demo e aste; legare il tier al job lato server; impedire doppio checkout; decidere come gestire un pagamento già avvenuto senza job.
- **Verifica:** elenco completo delle rotte che creano sessioni Stripe; ricerca di pagamenti storici con metadata assente.

### P0-3 Sicurezza del download e verifica del pagamento
- **Fatti [L]:** `GET /api/jobs/:id/report` non controlla il pagamento (commento nel codice). `GET /api/jobs/:id` restituisce i dati computati senza controllare `pagato`. `success.html` attende `paymentVerified`/`fulfillmentStatus` che il server non restituisce.
- **Conseguenza:** valore consegnato senza incasso nel percorso a 69 €; pagina di successo senza esito.
- **Da valutare [IP]:** vincolare risposta e PDF allo stato `PAID`; allineare pagina e API; decidere se il cliente deve poter riscaricare il rapporto.
- **Verifica:** richiesta di report/risultato su job non pagato dopo la correzione.

### P0-4 Persistenza del PDF
- **Fatti [L]:** il PDF è scritto nel filesystem del container; il servizio applicativo non ha volumi; il container è sostituito a ogni deploy (log 20:39–20:40 del 16/11). Il database conserva percorso e hash, non il file.
- **Conseguenza:** link di download rotto dopo un deploy; rapporti pagati da rigenerare.
- **Da valutare [IP]:** volume Railway; archivio oggetti; generazione del PDF all'occorrenza dal database.
- **Verifica:** PDF scaricabile dopo un deploy successivo alla generazione.

### P0-5 Consegna effettiva al cliente
- **Fatti [L]:** la consegna automatica richiede un'email; il form accetta solo il telefono; il WhatsApp del worker va a un numero di default (`NOTIFY_WHATSAPP_DEFAULT`, non tra le variabili) e non al cliente; `COMPLETED` è scritto anche con `results` vuoto.
- **Conseguenza:** cliente pagante che non riceve nulla senza che il sistema se ne accorga.
- **Da valutare [IP]:** email obbligatoria; stato distinto `CONSEGNATO`; avviso al titolare per casi senza canale; consegna manuale documentata come fallback.
- **Verifica:** quanti job `COMPLETED` hanno un evento `NOTIFICATION_SENT` con canale email (lettura database: [NV] con gli strumenti attuali).

### P0-6 Corrispondenza tra promesse e servizio erogato
- **Fatti [L]:** l'app e `success.html` promettono "verificato da Geom. Simone Azzali prima dell'invio"; per `TIER_1_PROMO_10` il DAG non include la revisione e `worker-review` non è in esecuzione. Il PDF reca "Validato da: Simone Azzali". L'app mostra numeri campione (ROI +18%, €142.000, coerenza 0,61) senza l'indicazione "esempio" nel testo.
- **Conseguenza:** promessa commerciale non mantenuta, rischio reputazionale e di contestazione.
- **Da valutare [IP]:** (a) eseguire davvero la revisione, con costi e tempi; (b) togliere la promessa e dichiarare "analisi automatica"; (c) revisione solo su casi segnalati. **La scelta spetta a Simone.**
- **Verifica:** testo pubblicato = flusso eseguito, controllato su un caso.

### P0-7 Limiti reali dell'analisi per immobili senza perizia
- **Fatti [L]:** lo scoring emette un giudizio solo se `periziaLetta` e confidenza ≥ 0,30; altrimenti "giudizio non possibile" senza numeri. Per i link, `periziaLetta` richiede un allegato PERIZIA letto. Per i documenti caricati vale qualsiasi PDF con testo leggibile. Un annuncio privato in genere non ha perizia.
- **Conseguenza [deduzione dal codice, da verificare con caso reale]:** per prima casa, investimento, compravendita e analisi tecnica il cliente può ricevere "documentazione insufficiente"; con un PDF qualsiasi può ottenere un giudizio senza perizia.
- **Da valutare [IP]:** definire cosa vende il prodotto da 10 € per ciascuno dei 5 casi (analisi documentale, checklist, giudizio); dichiarare a priori i documenti necessari; stabilire cosa conta come "documento tecnico".
- **Verifica:** un caso reale per categoria con i documenti che il cliente tipico possiede.

### P0-8 OCR effettivo assente
- **Fatti [L]:** `worker-ocr` copia il testo (confidenza 1.0 scritta, nessuna lettura); i PDF con meno di 300 caratteri sono `TESTO_ASSENTE`; le foto sono `FOTO_DA_VEDERE` (le guarda Simone). Nel job del 16/11 un allegato PERIZIA era `TESTO_ASSENTE`.
- **Conseguenza:** perizie scansionate e foto non entrano nell'analisi, benché l'app inviti a caricarle.
- **Da valutare [IP]:** OCR reale; limitare il caricamento ai PDF con testo; flusso manuale esplicito per foto. Quota di documenti scansionati nei casi reali: [NV].
- **Verifica:** esito su una perizia scansionata e su una foto.

---

## 3. SCHEDE DEI BINARI

Formato: obiettivo economico · percorso riscontrato · prove (fonte) · stato · problemi e conseguenze · percorso migliore da validare [IP] · prossima azione · dipendenze.

### FASE 1 — Mercato e cliente
- **Obiettivo economico:** sapere chi paga 10 € e perché, per ogni mercato.
- **Percorso riscontrato:** nessuno documentato per segmento; il form propone 5 casi (prima casa, investimento, aste, compravendita, difformità).
- **Prove:** [D] ERR-006 e ERR-008; [S] "766.757 compravendite 2025" citato in ERR-006 (fonte originale non letta); `BUSINESS_PLAN_ExternalOpinion_2025-2028.txt` e `REPORT_ANALISI_STRATEGICA_2026.md` presenti nel repository, **non letti in questa acquisizione**.
- **Stato: NON VERIFICABILE.**
- **Problemi:** nessun dato su urgenza, parole di ricerca, documenti posseduti, disponibilità a pagare. Il valore economico per segmento non è acquisito.
- **Percorso da validare [IP]:** una scheda per mercato (privato, agenzie, consulenti, aste, vizi documentali), con compilazione assistita dal titolare.
- **Prossima azione:** leggere i due documenti strategici presenti e riportarne i dati, distinguendo [S] da dati verificati.
- **Dipendenze:** alimenta F2, F4, F7 (quali casi supportare).

### FASE 2 — Intercettazione e acquisizione
- **Obiettivo economico:** portare persone giuste a costo noto.
- **Percorso riscontrato:** nessun canale con misure. Outreach B2B congelato al 18/06 [S]: 30 contatti mappati, nessuno contattato. MISSION dichiara Google Search/Ads [S].
- **Prove:** `CURRENT_COMMERCIAL_STATE.md`, `MISSION.md` [L]; nessun dato di traffico per canale [NV].
- **Stato: NON VERIFICABILE.**
- **Problemi:** nessun costo di acquisizione conosciuto; il congelamento dell'outreach richiedeva "funnel OK" che oggi non c'è.
- **Percorso da validare [IP]:** non investire in pubblicità prima di F3, F6, F8 verificati (principio della direttiva).
- **Prossima azione:** nessuna ora; si riprende dopo i P0.
- **Dipendenze:** F3 (dove atterrano), F10 (misura).

### FASE 3 — Ingresso e navigazione
- **Obiettivo economico:** ogni visitatore arriva a una sola offerta coerente.
- **Percorso riscontrato [L]:** `externalopinion.it` e `externalopinion.netlify.app` → pagina Netlify del 04/08 (`index-legacy.html`, form proprio, 69 €). In master: redirect 301 di tutte le vecchie pagine a `quick-intake.html` (11 regole), non pubblicate. Il dominio Railway serve `public/` di master. `/aste` e `/aste/*` esistono su Railway.
- **Prove:** elenco deploy Netlify (ultimo 04/08, origine CLI, 3 redirect); log Railway 16/11 (referer `index-legacy.html` su entrambi i domini); `netlify.toml` master [L]. Contenuto servito [NV] (proxy 403).
- **Stato: BLOCCATO** (P0-1).
- **Problemi:** il deploy Netlify non segue Git (esiste `DEPLOY_NETLIFY.bat`); due domini; link storici e social non censiti [NV].
- **Percorso da validare [IP]:** un solo dominio ufficiale e un solo percorso di pubblicazione; elenco di tutti i link esistenti da redirigere.
- **Prossima azione:** censire gli ingressi (domini, pagine indicizzate, link condivisi) con lettura HTTP o conferma del titolare.
- **Dipendenze:** decisione sul dominio ufficiale; F4, F6.

### FASE 4 — Comprensione e fiducia
- **Obiettivo economico:** il cliente capisce cosa compra e si fida a pagare.
- **Percorso riscontrato [L]:** `quick-intake.html`: titolo "Prima di muovere soldi, guarda cosa rischi", numeri campione, 10 € (69 € barrato), 24–48 ore, "verificato da Geom. Simone Azzali", disclaimer "analisi tecnica di parte… non costituisce perizia" nel PDF e nella mail.
- **Prove:** codice master [L]; pagina vista dai clienti [NV].
- **Stato: PARZIALE.**
- **Problemi:** P0-6 (revisione), P0-7 (limiti per immobili senza perizia non dichiarati prima del pagamento), numeri campione non etichettati; informazioni su trattamento documenti [NV].
- **Percorso da validare [IP]:** testo che dichiara cosa serve (documenti), cosa si riceve, tempi e chi verifica, coerente col flusso reale.
- **Prossima azione:** decisione del titolare su P0-6 e P0-7; poi riscrittura dei testi.
- **Dipendenze:** F7 (limiti), F8 (tempi di consegna).

### FASE 5 — Conversione e apertura pratica
- **Obiettivo economico:** trasformare l'interesse in pratica completa e pagabile.
- **Percorso riscontrato [L]:** scelta del caso → link e/o documenti (max 8, 7 MB, PDF/foto) → nome → telefono o email → `POST /api/analyze` (`deferUntilPayment: true`) → `caseId` `EO-xxxxxxxx` → upload → checkout. Avviso al titolare con ntfy e Telegram (log 16/11: entrambi inviati). Documenti originali inoltrati a Telegram. Il caricamento è ammesso solo entro 6 ore dalla creazione.
- **Prove:** `quick-intake.js`, `server-v18.3.js`, `utils/documenti-caricati.js`, log [L]. Funzionamento sul dominio pubblico [NV].
- **Stato: PARZIALE.**
- **Problemi:** contatto solo telefono → nessuna consegna automatica (P0-5); link alla sola home di un portale scartato correttamente; foto senza lettura (P0-8).
- **Percorso da validare [IP]:** contatto obbligatorio che permetta la consegna; elenco di documenti richiesti per caso.
- **Prossima azione:** definire i campi obbligatori dopo la decisione su F7/F8.
- **Dipendenze:** F7, F8.

### FASE 6 — Vendita e pagamento
- **Obiettivo economico:** incassare 10 € per pratica, una volta.
- **Percorso riscontrato [L]:** `POST /api/jobs/:id/checkout` → Stripe Checkout → webhook `checkout.session.completed` (firma, transazione, idempotenza) → job `PAID` → avviso titolare → produzione.
- **Prove:** `stripe-webhook-handler.js`, `server-v18.3.js` [L]; sessioni Stripe (ultime 20: 4 pagate da 1.000 c tra 23/07 e 02/08, nessuna pagata dopo) [L]. Collaudo Stripe del titolare [D].
- **Stato: BLOCCATO** (P0-1, P0-2, P0-3).
- **Problemi:** 7 tier accettati, rotte `/aste/checkout` e `/api/demo/checkout`; mappa webhook ammette importi sconosciuti come `TIER_4_ENTERPRISE_API`; nessun legame tra tier e job.
- **Percorso da validare [IP]:** un solo prodotto, prezzo fissato dal server sul job, rotte legacy disattivate.
- **Prossima azione:** censimento completo delle rotte e dei link Stripe attivi (sola lettura).
- **Dipendenze:** F3, F8.

### FASE 7 — Produzione dell'analisi
- **Obiettivo economico:** produrre un'analisi utile al minimo costo, senza dati inventati.
- **Percorso riscontrato [L]:** SCRAPE (axios/cheerio, PDF collegati fino a 6) → OCR (passthrough) → LLM (Claude Haiku 4.5, confidenza 0,92 su un job) → SCORING deterministico → REPORT (PDFKit) → NOTIFY. Costo AI osservato: $0,05277 su un job (51.839 token). Giudizio "non possibile" se mancano perizia o affidabilità.
- **Prove:** worker letti integralmente; log 16/11 [L]. Qualità del giudizio su documenti reali per categoria [NV].
- **Stato: PARZIALE.**
- **Problemi:** P0-7, P0-8; il risultato delle altre categorie non è mai stato osservato nei log disponibili [NV].
- **Percorso da validare [IP]:** matrice caso × documenti × esito atteso; test controllato per categoria (dopo decisione del titolare).
- **Prossima azione:** definire per ciascun caso cosa vende il prodotto (insieme al titolare).
- **Dipendenze:** F1 (casi), F4 (promesse), F8.

### FASE 8 — Controllo e consegna
- **Obiettivo economico:** ogni pratica pagata diventa un rapporto ricevuto.
- **Percorso riscontrato [L]:** `worker-report` salva il PDF nel container → `worker-notify` invia email con allegato (Resend o SMTP), WhatsApp solo se configurato, avviso al titolare → `COMPLETED`. Controllo di coerenza: soglia di confidenza e "giudizio non possibile"; nessuna revisione umana per il prodotto da 10 €.
- **Prove:** `worker-report.js`, `worker-notify.js`, configurazione Railway (nessun volume), log del deploy [L]. Numero reale di rapporti consegnati [NV].
- **Stato: BLOCCATO** (P0-3, P0-4, P0-5, P0-6).
- **Problemi:** stato `COMPLETED` ≠ consegna; PDF volatile; download senza gate; nessuna verifica del contenuto prima dell'invio.
- **Percorso da validare [IP]:** stato `CONSEGNATO` basato su un invio riuscito; PDF in archivio persistente; regola di revisione decisa dal titolare.
- **Prossima azione:** decisione su P0-5 e P0-6; poi definizione del criterio "consegnato".
- **Dipendenze:** F5 (contatto), F7, F9.

### FASE 9 — Relazione con il cliente
- **Obiettivo economico:** chiarimenti, recensioni, ritorno e passaparola.
- **Percorso riscontrato [L]:** mail di conferma ("Domande? Rispondi direttamente a questa email"); nessun processo di assistenza, raccolta feedback, recensione o richiamo.
- **Prove:** `stripe-webhook-handler.js`, `worker-notify.js` [L].
- **Stato: NON VERIFICABILE** (nessun dato; nessun percorso).
- **Problemi:** nessuno strumento per sapere se il cliente ha capito o è soddisfatto.
- **Percorso da validare [IP]:** da definire dopo il primo cliente reale; nessuna funzione da creare ora.
- **Prossima azione:** registrare come informazione mancante.
- **Dipendenze:** F8.

### FASE 10 — Misurazione e amplificazione
- **Obiettivo economico:** conoscere costo e margine per pratica e canale.
- **Percorso riscontrato [L]:** `trackLead` salva PAGE_VIEW, FORM_STARTED, FORM_SUBMITTED, JOB_CREATED, PAYWALL_HIT, CHECKOUT_STARTED con `utm_*`; `/api/admin/stats`, `/api/admin/vendite` (obiettivo "€1000 (13 vendite)"); costo AI calcolato per job.
- **Prove:** codice e log [L]. Dati raccolti e loro uso [NV] (database non leggibile).
- **Stato: PARZIALE.**
- **Problemi:** nessun cruscotto; provenienza dipende dalle pagine pubblicate (oggi legacy); i log di runtime hanno finestra breve.
- **Percorso da validare [IP]:** indicatori minimi (visite, avvii, pagamenti, consegne, costo, margine) letti da una sola fonte.
- **Prossima azione:** definire quali 6 numeri misurare, poi verificare dove si leggono.
- **Dipendenze:** F3 (pagine pubblicate), F6.

---

## 4. Dipendenze tra fasi (sintesi)

F3 → F4 → F5 → F6 → F7 → F8 → F9 → F10.
Vincoli trasversali: la definizione del prodotto (cosa copre il servizio da 10 €, quali documenti servono, chi verifica) governa F4, F5, F7, F8. Senza essa F3 e F6 non possono essere chiusi in modo utile.

## 5. Informazioni mancanti

- Dati di mercato, canali, traffico, costo di acquisizione (F1, F2, F10).
- Contenuto HTTP dei domini; contenuto del database; Stripe oltre le ultime 20 sessioni.
- Quota di documenti scansionati nei casi reali; esito dei casi non d'asta.
- Lettura di `BUSINESS_PLAN_…`, `REPORT_ANALISI_STRATEGICA_2026.md`, `FUNNEL_HEALTHCHECK.md`, `ARCHITECTURE_V18.3.md`, `worker-llm.js`.

## 6. Primo binario da affrontare

**BINARIO A — Definizione del servizio da 10 €** (decisione, non sviluppo): cosa copre per ciascuno dei 5 casi, quali documenti richiede, cosa consegna, in che forma, chi lo verifica.
Perché per primo:
1. Da esso dipendono P0-6, P0-7, P0-8 e il criterio di consegna (P0-5).
2. Senza una definizione, pubblicare la pagina da 10 € o collaudare un pagamento dimostrerebbe solo che il cliente paga, non che riceve ciò che ha comprato.
3. Non costa nulla e spetta al titolare (F007: l'umano valida obiettivo e strada).

I binari tecnici P0-1, P0-2, P0-3, P0-4 si apriranno dopo la validazione del binario A, uno alla volta.

---

NOTE
Le modifiche successive si registrano come patch. La Mappa è la fonte di verità dell'obiettivo.

RISULTATO VERIFICATO: NON ANCORA — nessun cliente ha completato il percorso con consegna verificata.
PERCORSO VERIFICATO: NON ANCORA.
BINARIO RIUTILIZZABILE: NON ANCORA.
VALIDAZIONE UMANA: NO
