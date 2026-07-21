# External Opinion — Cronologia della comunicazione umano↔AI

Data: 2026-07-14

## Nota metodologica

Questo documento sintetizza gli episodi estratti da tre fonti ad altissima rilevanza: il transcript verbatim `_ARCHIVIO_MATERIALI/claude-external-opinion-chat.txt` (11–13 giugno 2026), il file narrativo `assets/canonical/ARCHIVIO_EXTERNALOPINION/00_MOMENTI_PERCORSO.md`, e i documenti fondativi di questa stessa Centrale Nucleare (checkpoint 23 giugno 2026). Non introduce fatti nuovi oltre a quanto già presente in quelle fonti — solo riordino e lettura d'insieme.

Limite dichiarato: copre solo le tre fonti ad altissima rilevanza mappate in una prima ricognizione. Le fonti ad alta/media rilevanza (mappa dei 255 file, archivio dei 573, `storia sito externalopinion.com.docx`, export HTML di altre sessioni) non sono state estratte e potrebbero contenere episodi antecedenti l'11 giugno o successivi al 23 giugno non ancora coperti qui.

---

## 1. La cronologia in tre atti

### ATTO I — Il lancio tecnico-commerciale (11-13 giugno 2026)

Tre giorni compressi, quasi senza soluzione di continuità, in cui il progetto passa da "quasi pronto" a "vendibile davvero". Il filo conduttore è un funnel che si rompe e si ripara pezzo per pezzo mentre i primi contatti caldi hanno già il link in mano:

- **11 giugno** — Bonifica dei rischi immediati: descrittore Stripe che espone al chargeback, redirect post-pagamento mancante, outreach ai primi 5 contatti (incluso Abramo, il lead che resterà il fulcro dei giorni successivi).
- **12 giugno** — La giornata più densa: rotazione di una chiave API esposta (con doppio incidente da errore umano in terminale), pulizia di un servizio Railway orfano (`l2-sensor`), e soprattutto **la crisi delle credenziali**: emerge che Simone non è iscritto né all'albo dei CTU né a quello dei geometri, e ogni uso di quei titoli viene bloccato in giornata su sito, messaggi e report, con riposizionamento immediato sull'esperienza reale di cantiere. In parallelo, un bug critico manda i pagamenti in modalità sandbox invece che live — nessun cliente può davvero pagare finché non viene risolto. Chiude la giornata una decisione di prezzo (restare a €69) presa autonomamente da Claude "come da regola".
- **13 giugno** — Automazione della routine commerciale (post programmati), gestione di due casi reali (Abramo con un immobile in usufrutto, la zia Antonia come possibile moltiplicatrice), e la **svolta concettuale**: invertire la leva di vendita armando il cliente privato invece di convincere l'agente immobiliare, che sarà "costretto" a inseguire.

### ATTO II — Il primo traguardo pubblico e il patto (13 giugno, notte)

Alle 5:36 del 13 giugno esce il primo post pubblico su Facebook — il "fumetto dello staff". È il momento in cui il progetto smette di essere solo lavoro privato e diventa qualcosa mostrato al mondo, dopo 45 giorni di tensione accumulata. Da questo momento viene messo per scritto, in forma quasi manifesto, **il patto evolutivo Simone↔Claude**: ruoli distinti (Simone visione, Claude materializzatore), obbligo reciproco di revisione/conferma, e il principio che il danno nasce sempre dalla più piccola incomprensione non corretta subito.

### ATTO III — La formalizzazione istituzionale (checkpoint 23 giugno 2026)

Dieci giorni dopo, il progetto compie un salto di livello organizzativo: nasce ufficialmente la **Centrale Nucleare**, un repository canonico di regole, ruoli, decisioni e stato. È il momento in cui l'esperienza operativa dei giorni 11-13 giugno (fatta di attriti, correzioni ed errori concreti) viene distillata in regole scritte, valide per ogni agente AI futuro, e in un registro decisionale formale. Il checkpoint chiude anche una fase di recupero fonti (573 file grezzi → 114 candidati prioritari), con il verdetto esplicito: *"il problema non era mancanza di energia, era mancata canalizzazione."*

---

## 2. I principi nati dall'esperienza — linea del tempo

| Quando | Principio/regola | Origine (episodio) |
|---|---|---|
| 11-12 giu | Mai incollare una chiave segreta come riga a sé nel terminale | Errore reale commesso due volte |
| 12 giu | Operazioni di lettura Railway → conferma automatica; operazioni di scrittura → conferma ogni volta | Necessità emersa durante la diagnosi tecnica |
| 12 giu | **Attrito → stop, chiedi, non riempire il vuoto** (regola bidirezionale: vale per Simone verso il sistema, e Claude la applica a se stesso sulle ambiguità del dettato vocale) | Crisi CTU + errore di trascrizione nome "Assali" |
| 12 giu | Mai dichiarare un titolo/qualifica non posseduta, nemmeno per vendere meglio | Crisi credenziali CTU/geometra |
| 12 giu | Il telefono non si usa alla guida per nessun motivo di sistema | Richiesta di Simone al volante |
| 13 giu | Il report deve essere costruito per essere "mostrato", non solo letto (arma a due strati) | Svolta strategica sull'inversione della leva di vendita |
| 23 giu | Prima si legge, poi si capisce, poi si agisce — nessun agente ricostruisce da memoria ciò che è già scritto | Formalizzazione Centrale Nucleare |
| 23 giu | Gerarchia delle fonti: Centrale > Stato corrente > Backup > Produzione > Repo > Archivio > Memoria AI | Regole operative |
| 23 giu | Ruoli AI distinti e non intercambiabili (ChatGPT=regia, Claude=testi/strategia, Claude Code=task tecnici chiusi, Gemini=canale telefono/WhatsApp) | Protocollo AI/Agenti |

Questa linea del tempo mostra un pattern coerente: ogni regola nasce da un incidente specifico, non da teoria — la chiave incollata male, il titolo non posseduto, l'auto in movimento, il funnel rotto. Le regole del 23 giugno non sono nuove: sono la cristallizzazione scritta di ciò che nei tre giorni precedenti era già stato imparato a caldo.

---

## 3. Il filo narrativo del rapporto Simone↔Claude

Dai tre atti emerge un'evoluzione di ruolo, non solo di regole:

1. **Nei giorni 11-13 giugno**, Claude agisce quasi come un CTO operativo che guida passo-passo, corregge, e a un certo punto arriva persino a decidere autonomamente ("Decisione presa, e la prendo io come da regola") entro un mandato implicito di urgenza.
2. **Nel "patto evolutivo"** questo ruolo viene reso esplicito e formalizzato come principio di collaborazione: Simone struttura e visione, Claude materializza — ma nessuno dei due procede su un'interpretazione data per scontata.
3. **Nella Centrale Nucleare**, il rapporto si istituzionalizza: i ruoli diventano protocollo scritto, applicabile anche ad agenti AI diversi da Claude (ChatGPT, Gemini, Claude Code), e le decisioni passate diventano registro consultabile invece che memoria orale.
