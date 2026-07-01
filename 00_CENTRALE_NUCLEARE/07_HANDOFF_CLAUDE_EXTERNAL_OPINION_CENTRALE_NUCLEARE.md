\# HANDOFF\_CLAUDE\_EXTERNAL\_OPINION\_CENTRALE\_NUCLEARE



> \*\*Scopo:\*\* rendere disponibili alla Centrale Nucleare i materiali già prodotti da Claude (questa e sessioni precedenti) che potrebbero non essere ancora salvati come file.

> \*\*Regola applicata:\*\* solo recupero. Nessuna nuova strategia, nessuna riscrittura, nessuna invenzione. Dove un materiale esiste solo in chat, \*\*rimando alla conversazione di origine per il recupero verbatim\*\*, non lo rigenero a memoria.

> \*\*Data handoff:\*\* 2026-06-23



\---



\## ⚠️ PREMESSA DI ONESTÀ (leggere prima)



Tre limiti che determinano l'affidabilità di questo indice:



1\. \*\*Io non ho i transcript completi caricati.\*\* Questo inventario è ricostruito \*cercando\* nelle conversazioni passate + memoria di progetto. Quindi è una mappa, non una copia.

2\. \*\*Non posso ispezionare il tuo filesystem, il tuo Drive o il repo.\*\* Tutti i percorsi qui sotto sono "come registrati nella sessione che li ha prodotti", \*\*non verificati adesso\*\*. Vanno confermati da te o da Code.

3\. \*\*CRITICO — i file in `/mnt/user-data/outputs/` di sessioni passate sono effimeri.\*\* Quel container si azzera tra una sessione e l'altra. Un file che in passato risultava "salvato in /mnt/user-data/outputs/X" \*\*NON è automaticamente sul tuo PC\*\*: è durevole solo se tu l'hai scaricato, oppure se è stato caricato su Drive o committato nel repo. Per ogni voce segnalo `\[DUREVOLE]` o `\[EFFIMERO → verifica]`.



Le uniche cose che posso dare per \*\*durevoli con buona confidenza\*\* sono: l'archivio 9 file caricato su Google Drive, i file grafici Gemini sul tuo G:, e ciò che risulta committato nel repo.



\---



\## 0. FONDAMENTO GIÀ CONSOLIDATO — la Centrale Nucleare esiste già (in parte)



Il \*\*nucleo è già stato costruito e archiviato\*\* nella sessione del 15/06 ("Due livelli di errore"). Questo handoff serve soprattutto a capire \*\*cosa è nato DOPO il 15/06 e non è ancora dentro l'archivio.\*\*



| # | Materiale | Sintesi | Stato | Dove (come registrato) | Priorità | Note |

|---|-----------|---------|-------|------------------------|----------|------|

| 0.1 | \*\*ARCHIVIO\_EXTERNALOPINION (9 file)\*\* | Consolidamento completo: `INDICE.md`, `00\_CENTRALE\_NUCLEARE.md`, `00\_MOMENTI\_PERCORSO.md`, `01\_ARCHITETTURA.md`, `02\_PRODOTTO\_PREZZI.md`, `03\_GOVERNANCE.md`, `04\_GOTOMARKET.md`, `05\_CLIENTI.md`, `06\_STATO\_15GIUGNO.md` | \*\*fondamento\*\* | \*\*Google Drive folder `17lJS0ER-v\_KEvgQHHHj-aU3lAnmhQ22f` \[DUREVOLE]\*\* + copia in `/mnt/user-data/outputs/ARCHIVIO\_EXTERNALOPINION/` \[EFFIMERO] | \*\*MASSIMA\*\* | È \*già\* la Centrale Nucleare. Da spostare in `assets/canonical/` nel repo via Code (hook guard-canonical, commit `fbab099`) — \*\*azione pendente dal 15/06\*\* |



Origine: chat "Due livelli di errore" → https://claude.ai/chat/45b7f9d0-3372-4cf1-85e5-5447ee2b75d2



\---



\## 1. TECNICO



| # | Materiale | Sintesi | Stato | Dove (come registrato) | Priorità | Note / duplicati |

|---|-----------|---------|-------|------------------------|----------|------------------|

| 1.1 | \*\*CASCADE\_AUDIT\_HANDOFF.md\*\* | Audit sul codebase reale (dump v18.3, 70 file). Gap G1–G8. Conferma schema Prisma reale e nomi campo. \*\*Supera tutta la doc di architettura vecchia.\*\* | \*\*fondamento/tecnico\*\* | `/mnt/user-data/outputs/CASCADE\_AUDIT\_HANDOFF.md` \[EFFIMERO → verifica] | \*\*ALTA\*\* | Fonte di verità sull'architettura. Se non lo trovi salvato, recupera verbatim dalla chat sotto |

| 1.2 | \*\*external-opinion-operativa.html\*\* | \*\*Home ufficiale approvata\*\*: immagine Gemini intatta + hotspot trasparenti sui 5 pulsanti e CTA. Self-contained (immagine in base64). | \*\*operativo/fondamento\*\* | `/mnt/user-data/outputs/external-opinion-operativa.html` \[EFFIMERO → verifica] | \*\*MASSIMA\*\* | È la home da rendere ufficiale nel repo front-end. Il file grafico+HTML "sorgente" Gemini è su `G:\\Il mio Drive\\APP grafica logo\\` |

| 1.3 | \*\*eo-app.js\*\* | Layer funzioni puro JS, si aggancia alla grafica per data-attribute. Gestisce 5 pulsanti, validazione, screening, pagamento €20, render verdetto, snapshot, filtro anti-termini. Zero stile. | \*\*tecnico/operativo\*\* | `/mnt/user-data/outputs/eo-app.js` \[EFFIMERO → verifica] | \*\*ALTA\*\* | Contratto d'integrazione grafica↔funzioni |

| 1.4 | \*\*BRIEF /api/screening per Claude Code\*\* | Contratto endpoint POST `/api/screening`, proxy Netlify in `netlify.toml`, riuso checkout €20 esistente (Level A), integrazione worker-scoring.js, filtro termini vietati, snapshot. | \*\*tecnico/operativo\*\* | \*\*SOLO IN CHAT\*\* (21/06) | \*\*ALTA\*\* | Non risulta salvato come file standalone. \*\*Da estrarre verbatim\*\* dalla chat sotto e salvare come `BRIEF\_API\_SCREENING.md` |

| 1.5 | \*\*worker-scoring.js (modulo drop-in)\*\* | Separa calcolo numerico deterministico (ROI, valoreAttuale) dalla chiamata LLM; AI riceve i numeri come fatti; validazione server-side + 1 retry su termini/verdetti. Richiede conferma nomi campo Prisma reali (`valoreMercato`, `prezzoBase`, `costoLiberazione`, `costoRistrutturazione`) e formula ROI. | \*\*tecnico\*\* | Esiste nel repo (`worker-scoring.js`) — la \*versione disegnata\* è in chat | media | Verificare se la versione in repo coincide con quella disegnata. Due bug noti da chiudere: ROI 0.0% / valore "—" |

| 1.6 | \*\*EO\_quick\_intake\_screenshot\_match\_V4.html\*\* | Schermata intake (step 2 del flusso). | \*\*tecnico\*\* | `/mnt/user-data/outputs/EO\_quick\_intake\_screenshot\_match\_V4.html` \[EFFIMERO → verifica] | media | |

| 1.7 | \*\*setup-autonomy-v3.ps1\*\* | Installer autonomia Code: `.claude/guard.mjs` (PreToolUse Bash/Edit/Write), `CLAUDE.md` con P0, hook ntfy, `settings.json`, `.gitignore`. Governance 3 livelli A/B/C. | \*\*tecnico/governance\*\* | `/mnt/user-data/outputs/setup-autonomy-v3.ps1` \[EFFIMERO → verifica] | media | Probabilmente già eseguito sul PC (`.claude/` esiste). Se sì, il file installer è secondario |

| 1.8 | \*\*G3\_TASK.md (protocollo)\*\* | Protocollo consolidamento pipeline G3 con chain-of-custody: Golden Master, baseline/altpipe/after JSON, hash SHA-256 (eps 1e-9), tabella provenance, anti-tampering, separazione esecuzione/approvazione, merge gate. | \*\*tecnico/archivio\*\* | `/mnt/user-data/outputs/G3\_TASK.md` \[EFFIMERO → verifica] | bassa | Decisione G3 (worker.js vs src/workers/\*) potrebbe essere ancora aperta. Conservare come metodo, non come stato |

| 1.9 | \*\*JSON-LD Organization (markup SEO)\*\* | Blocco JSON-LD per `<head>` contro hallucination AI Overview + istruzioni reindex GSC. | \*\*tecnico/commerciale\*\* | \*\*SOLO IN CHAT\*\* (16/06) | bassa | Recuperare verbatim se serve. Non urgente vs funnel pagamento |



Chat di origine:

\- 1.1 → https://claude.ai/chat/e8d4060f-3693-4773-a1f7-609bbae3163b

\- 1.2 / 1.3 / 1.4 → https://claude.ai/chat/9f4e30fa-2149-499b-87e0-1c56e910b653

\- 1.5 → https://claude.ai/chat/ab7ddc02-835a-4267-b3c1-d93f6178be56

\- 1.7 / 1.8 → https://claude.ai/chat/58ca19d7-0d63-47ad-b1f8-a97f91f546ce

\- 1.9 → https://claude.ai/chat/1c0a05cf-7b97-47b8-a953-fc3d9a52a0a9



\---



\## 2. COMMERCIALE / GO-TO-MARKET



| # | Materiale | Sintesi | Stato | Dove (come registrato) | Priorità | Note |

|---|-----------|---------|-------|------------------------|----------|------|

| 2.1 | \*\*Ricerca mercato aste nazionale\*\* | \~74–78K lotti/anno; Lombardia \~13%; Roma top provincia; famiglie \~65% degli acquirenti; sconti assottigliati \~15–20%; \*\*mediatori creditizi (Credipass, 24MAX) = canale a massima leva\*\*. | \*\*fondamento/commerciale\*\* | Prodotta 19/06 — verifica se salvata come file | \*\*ALTA\*\* | Tesi di mercato. Probabile candidata a confluire in `04\_GOTOMARKET.md` se non già dentro |

| 2.2 | \*\*Pacchetto contenuti ChatGPT integrato\*\* | 5 post LinkedIn (Lun–Ven), 7 FAQ, 5 template WhatsApp, caso studio Valsamoggia, sistema referral (codici stile `AZZALI-001`). | \*\*commerciale\*\* | FAQ integrate in `index.html`; il resto parte in chat / `/mnt/user-data/outputs/` \[EFFIMERO] | media | L'OUTPUT conta, non il prompt. Vedi 2.5 |

| 2.3 | \*\*Nucleo / mappa moltiplicatori + leva invertita\*\* | Rete di moltiplicatori professionali (agenti, mediatori, amministratori, ecc.); inversione strategica: armare il compratore privato col report → l'agente adotta il tool "dal basso". | \*\*fondamento/commerciale\*\* | Prodotto 14/06 — probabile in `04\_GOTOMARKET.md` | media | Verificare che sia già nell'archivio |

| 2.4 | \*\*Roadmap ricavi G0/G1/G2\*\* | G0 €0→€1K / G1 €1K→€5K / G2 €5K→€20K, ogni stadio preparato mentre gira il precedente. | \*\*fondamento\*\* | Probabile in archivio (`00\_/06\_`) | bassa | |

| 2.5 | \*\*PROMPT\_CHATGPT\_NOTTURNO.md\*\* | Prompt 5 compiti commerciali (pricing, FAQ, WhatsApp, caso studio, referral). | \*\*commerciale/archivio\*\* | `/mnt/user-data/outputs/PROMPT\_CHATGPT\_NOTTURNO.md` \[EFFIMERO] | bassa | È un prompt, non un asset finale. Archiviabile |

| 2.6 | \*\*Reels/TikTok script + outreach studi legali\*\* | 3 script video 60s; email fredda + follow-up + proposta partnership B2B per studi fallimentari MO/BO. | \*\*commerciale\*\* | \*\*SOLO IN CHAT\*\* (19/06) | bassa | Recuperare verbatim se si attiva il canale |

| 2.7 | \*\*Algoritmo Reattore (REATTORE.md)\*\* | Principio: ogni obiettivo entra già accoppiato a un percorso validato; pipeline A→B→C→D. Blocco markdown pronto da incollare. | \*\*fondamento\*\* | \*\*SOLO IN CHAT\*\* (08/06), salvo tu l'abbia già incollato in PROJECT\_OS | media | Se non è già in un file, va salvato. Verbatim nella chat sotto |



Chat di origine:

\- 2.1 / 2.2 / 2.5 → https://claude.ai/chat/1fdb2596-c883-45a3-ad12-b150fc3ef2ed

\- 2.3 / 2.4 → https://claude.ai/chat/fd0ba5fc-9855-41d4-bb21-08bffd9da5ab

\- 2.7 → https://claude.ai/chat/7d5e4980-afdc-495a-93ac-7a1fb7c798c4



\---



\## 3. CLIENTI (point-in-time — perlopiù archivio)



| # | Materiale | Sintesi | Stato | Dove | Note |

|---|-----------|---------|-------|------|------|

| 3.1 | \*\*Abramo\*\* | Messaggi WhatsApp (3 profili reddito/ristrutturo/compra-rivendi) + `occasioni-abramo.md` (Code, 9 annunci reali) + link Stripe €20. \*\*Primo cliente pagante confermato.\*\* | operativo → \*\*archivio\*\* | messaggi/link in chat; `occasioni-abramo.md` prodotto da Code (sul tuo PC) | Vendita chiusa: il valore ora è il \*case study\*, non i messaggi |

| 3.2 | \*\*Antonia Gatti\*\* | Task `report-antonia.md` (fetch annuncio Ravarino via Code) — report gratuito/parziale firmato Simone; nodo-moltiplicatore (rete vendita diretta). | operativo/\*\*dubbio\*\* | `report-antonia.md` da produrre/prodotto via Code | Stato di completamento non verificabile da qui. Confermare |

| 3.3 | \*\*Caso studio Valsamoggia\*\* | Casa indip. (BO), +12mq non dichiarati, impatto €38K, acquisizione bloccata. Anonimizzato, per LinkedIn/brochure. | commerciale | parte in chat / sito | Asset commerciale riutilizzabile |



Chat: 3.1/3.2 → https://claude.ai/chat/fd0ba5fc-9855-41d4-bb21-08bffd9da5ab · 3.3 → https://claude.ai/chat/1fdb2596-c883-45a3-ad12-b150fc3ef2ed



\---



\## 4. REGOLE/COSTANTI CONSOLIDATE (fatti, non ricostruzioni — sicuri da cablare)



Questi sono \*\*fatti già decisi e ripetuti\*\*, non interpretazioni. Sicuri come fonte:



\- \*\*Verdetti:\*\* solo `VERDE / GIALLO / ROSSO`. Immutabile.

\- \*\*Numeri all'utente:\*\* sempre reali e deterministici. Mancanti → `"nel report completo"`. Mai inventati.

\- \*\*Termini vietati\*\* (filtro server-side, 1 retry): `CTU, perito/perizia, geometra, albo, topografo`. Regex usata: `/\\b(ctu|perit\[oaie]|perizia|geometr\[ao]|albo|topografo)\\b/gi`

\- \*\*Posizionamento corretto:\*\* \*tecnico di cantiere + AI\* (esperienza grandi opere, es. Palazzo dei Congressi Riccione €40M). \*\*MAI\*\* CTU / geometra / perito / albo.

\- \*\*Architettura congelata:\*\* niente TypeScript, BullMQ, Puppeteer, Redis nuovo prima dello scaling.

\- \*\*Avvio backend:\*\* `node orchestrator.js` (MAI `server-v18.3.js`).

\- \*\*Git:\*\* commit su branch dedicati, mai diretto su master.

\- \*\*Stripe / pagamenti = Level A (FROZEN):\*\* richiede tua approvazione esplicita. Riusare il checkout €20 esistente, non creare route nuove.

\- \*\*Governance Code 3 livelli\*\* (hook PreToolUse `guard.mjs`): A FROZEN (block+ping: schema.prisma, stripe-webhook-handler.js, payment/checkout, migration SQL, .env.production) · B GUARDED (pass+notify: worker-scoring.js, src/workers/\*) · C FREE (UI/doc/test). ntfy: `eo-pay-83562128` (pagamenti), `eo-dev-83562128` (dev). Avvio: `--permission-mode auto`.

\- \*\*Snapshot\*\* dei dati annuncio al submit (il report sopravvive al link morto).

\- \*\*Stripe:\*\* verifica incasso sempre sul dashboard, mai dedotta da email.



\---



\# OUTPUT OBBLIGATORIO



\## ✅ CERTO — materiali con disponibilità durevole



\- \*\*Archivio 9 file su Google Drive\*\* (folder `17lJS0ER-v\_KEvgQHHHj-aU3lAnmhQ22f`). \[0.1]

\- \*\*File grafici Gemini sul tuo PC:\*\* `G:\\Il mio Drive\\APP grafica logo\\Grafica pagina.png` e `external\_opinion\_quick\_intake\_gioiello.html`. \[1.2]

\- \*\*Ciò che è committato nel repo\*\* `github.com/asimonevolution-beep/ExternalOpinion\_Agent` (worker-scoring.js, schema, webhook handler, `.claude/` se setup eseguito).

\- \*\*FAQ ChatGPT\*\* già integrate in `index.html`. \[2.2]

\- \*\*Regole/costanti\*\* della sezione 4 (decise e ripetute).



\## ⛔ NON ANCORA DISPONIBILE — solo in chat o memoria Claude



Da recuperare \*\*verbatim\*\* dalle chat indicate (non rigenerare a memoria):



\- \*\*BRIEF `/api/screening`\*\* per Code \[1.4] → chat 9f4e30fa

\- \*\*JSON-LD Organization\*\* SEO \[1.9] → chat 1c0a05cf

\- \*\*Algoritmo Reattore / REATTORE.md\*\* \[2.7] → chat 7d5e4980 (se non già incollato)

\- \*\*Reels script + outreach studi legali\*\* \[2.6] → chat 1fdb2596

\- \*\*Ricerca mercato nazionale\*\* \[2.1] (se non già in `04\_GOTOMARKET.md`) → chat 1fdb2596

\- \*\*Tutti i file `/mnt/user-data/outputs/`\*\* delle sessioni passate \[1.1, 1.2, 1.3, 1.6, 1.7, 1.8, 2.5] → \*\*incerti\*\*: durevoli solo se scaricati. Da verificare sul PC



\## 🎯 DA INTEGRARE NELLA CENTRALE NUCLEARE — elenco prioritario



1\. \*\*`external-opinion-operativa.html`\*\* → renderla home ufficiale nel repo front-end (è la grafica approvata). \[1.2] — \*\*PRIORITÀ 1\*\*

2\. \*\*`eo-app.js` + BRIEF `/api/screening`\*\* → cablare funzioni e endpoint reale. \[1.3, 1.4] — \*\*PRIORITÀ 1\*\*

3\. \*\*Spostare l'archivio 9 file in `assets/canonical/`\*\* nel repo (azione pendente dal 15/06, hook `fbab099`). \[0.1] — \*\*PRIORITÀ 2\*\*

4\. \*\*`CASCADE\_AUDIT\_HANDOFF.md`\*\* dentro l'archivio canonico come fonte architettura. \[1.1] — \*\*PRIORITÀ 2\*\*

5\. \*\*Ricerca mercato + Reattore + Nucleo moltiplicatori\*\* → confermare che siano in `04\_GOTOMARKET.md` / `00\_`, altrimenti integrarli. \[2.1, 2.7, 2.3] — \*\*PRIORITÀ 3\*\*



\## 🗄️ ARCHIVIO — vecchi ma conservabili



\- `EO-handoff-per-GPT.md` (14/06) — snapshot point-in-time, superato dallo stato attuale \[`/mnt/user-data/outputs/` EFFIMERO]

\- `06\_STATO\_15GIUGNO.md` — fotografia al 15/06, ora superata (vendita Abramo fatta, home 21/06 definitiva)

\- `PROMPT\_CHATGPT\_NOTTURNO.md` \[2.5] — prompt, non asset

\- `G3\_TASK.md` \[1.8] — metodo valido, stato G3 da confermare

\- `setup-autonomy-v3.ps1` \[1.7] — se già eseguito

\- Materiali cliente Abramo (messaggi/`occasioni-abramo.md`) — vendita chiusa



\## 🚫 DOPPIONI / NON USARE come fonte operativa



1\. \*\*Qualsiasi doc con `F7` / `PROCEDERE-NEGOZIARE-EVITARE`\*\* → motore reale è `VERDE/GIALLO/ROSSO`. Riguarda i 3 file del 27/05 (`CASCADE\_EXECUTION\_RUNTIME.md`, `AGENT\_STEPS.md v1.1`, `COMMIT\_CHECKLIST.md`) e ogni copy vecchia.

2\. \*\*Qualsiasi riferimento a `EGCL`, `EQP`, `OMIZone`, `WebhookEvent`/`CanonicalEvent`\*\* → \*\*non esistono\*\* nel codice migrato (doc legacy).

3\. \*\*Posizionamento "Geom." / "geometra" / "CTU" / "perito" / "albo"\*\* → VIETATO. ⚠️ Gli header di alcune sessioni vecchie ti chiamano "Geom. Simone Azzali" o "CTU/perito in Bologna": \*\*errati, non usarli come fonte\*\*. Corretto: \*tecnico di cantiere + AI\*.

4\. \*\*`server-v18.3.js` come comando di avvio\*\* → errato. Corretto: `node orchestrator.js`. (Anche drift versione: `package.json` 13.1.0 vs codice v18.3.)

5\. \*\*`external-opinion-app.html`\*\* (la home ricostruita in CSS, rifiutata il 21/06) → \*\*NON USARE\*\*. Usa `external-opinion-operativa.html`.

6\. \*\*Pricing: versioni multiple\*\* (€79/€149 · €69/€99/€249 · €69/€129/€299 · €20 promo Abramo · €69 screening). \*\*Nessuna vecchia è canonica\*\*: confermare il prezzo corrente prima di pubblicarlo. Non dedurlo da un doc datato.

7\. \*\*Stack Twilio (WhatsApp)\*\* menzionato in sessioni vecchie → recente è \*\*Resend + ntfy\*\*. Verificare cosa è attivo davvero.



\## ▶️ PROSSIMA AZIONE MINIMA (cosa deve fare Simone o Code)



\*\*Una sola, fisica, per non perdere nulla:\*\*



1\. \*\*Simone:\*\* apri `Drive folder 17lJS0ER…` e conferma che i 9 file ci siano → è il backbone, è già salvo.

2\. \*\*Simone:\*\* sul PC, cerca nella cartella download i file effimeri marcati `\[EFFIMERO → verifica]` (soprattutto `external-opinion-operativa.html`, `eo-app.js`, `CASCADE\_AUDIT\_HANDOFF.md`). Quelli che \*\*non trovi\*\*, vanno rigenerati/estratti dalle chat linkate e salvati.

3\. \*\*Code (Level C, libero):\*\* crea `BRIEF\_API\_SCREENING.md`, `REATTORE.md` e — se mancanti — i materiali "NON ANCORA DISPONIBILE", estraendoli verbatim dalle chat indicate, e salvali in `assets/canonical/`.

4\. \*\*Code:\*\* completa l'azione pendente dal 15/06 → sposta l'archivio in `assets/canonical/` per attivare il guard-canonical (commit `fbab099`).



> Nessun deploy, nessun push su master, nessuna modifica a Level A in questa fase. Solo recupero e salvataggio fisico.



\---



\### Appendice — mappa chat sorgenti (per recupero verbatim)



| Tema | Data | Link |

|------|------|------|

| Audit codebase + CASCADE\_AUDIT\_HANDOFF | 02/06 | https://claude.ai/chat/e8d4060f-3693-4773-a1f7-609bbae3163b |

| Fix P0 webhook applicato | 02/06 | https://claude.ai/chat/ddc49de6-4c75-4829-8091-1e428f20dc2e |

| Setup autonomia + guard + G3\_TASK | 03/06 | https://claude.ai/chat/58ca19d7-0d63-47ad-b1f8-a97f91f546ce |

| Algoritmo Reattore | 08/06 | https://claude.ai/chat/7d5e4980-afdc-495a-93ac-7a1fb7c798c4 |

| Nucleo moltiplicatori + Abramo/Antonia + EO-handoff-per-GPT | 14/06 | https://claude.ai/chat/fd0ba5fc-9855-41d4-bb21-08bffd9da5ab |

| \*\*Consolidamento archivio 9 file\*\* | 15/06 | https://claude.ai/chat/45b7f9d0-3372-4cf1-85e5-5447ee2b75d2 |

| worker-scoring.js drop-in | 16/06 | https://claude.ai/chat/ab7ddc02-835a-4267-b3c1-d93f6178be56 |

| Debug form + JSON-LD | 16/06 | https://claude.ai/chat/1c0a05cf-7b97-47b8-a953-fc3d9a52a0a9 |

| Pacchetto commerciale + ricerca mercato | 19/06 | https://claude.ai/chat/1fdb2596-c883-45a3-ad12-b150fc3ef2ed |

| \*\*Home ufficiale operativa + eo-app.js + brief /api/screening\*\* | 21/06 | https://claude.ai/chat/9f4e30fa-2149-499b-87e0-1c56e910b653 |



\*Fine handoff. Recupero, non ricostruzione.\*

