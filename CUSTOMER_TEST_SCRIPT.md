# CUSTOMER_TEST_SCRIPT.md
*Test simulato cliente — 18 giugno 2026*
*Usa questo script per testare il funnel prima di aprire le vendite*

---

## SCENARIO TEST: Cliente "Asta"

**Profilo cliente simulato:**
- Nome: Marco R.
- Interesse: appartamento all'asta, Milano zona Corvetto
- Link asta: `https://portaleaste.com/asta/123456` (usa un link reale da pvp.giustizia.it per test autentico)
- Ha la perizia CTU in PDF

---

## FLUSSO TEST PASSO PER PASSO

---

### FASE 1 — Apertura pagina

**Azione:** Apri externalopinion.it su browser mobile (iPhone o Android) e su desktop.

| Check | Atteso | Risultato |
|---|---|---|
| Pagina carica senza errori | Sì | [ ] |
| Immagine/logo visibile | Sì | [ ] |
| Testo chiaro sul valore offerto | Sì | [ ] |
| Tempo caricamento < 3 secondi | Sì | [ ] |
| Pagina responsive su mobile | Sì | [ ] |

---

### FASE 2 — Scelta categoria

**Azione:** Clicca sul tasto "Asta".

| Check | Atteso | Risultato |
|---|---|---|
| 5 tasti categoria visibili | Sì | [ ] |
| Tasto "Asta" presente | Sì | [ ] |
| Click su tasto seleziona la categoria | Sì | [ ] |
| Feedback visivo (tasto evidenziato) | Sì | [ ] |
| Nessun errore JavaScript in console | Sì | [ ] |

**Se i 5 tasti NON ci sono:** salta questa fase e vai direttamente al form URL.

---

### FASE 3 — Inserimento URL asta

**Azione:** Incolla il link dell'asta nel campo URL.

| Check | Atteso | Risultato |
|---|---|---|
| Campo URL visibile e cliccabile | Sì | [ ] |
| URL accettato senza errori | Sì | [ ] |
| Campo email visibile e funzionante | Sì | [ ] |
| Pulsante "Analizza" o "Continua" visibile | Sì | [ ] |

---

### FASE 4 — Upload perizia (se disponibile)

**Azione:** Prova ad allegare il PDF della perizia CTU.

| Check | Atteso | Risultato |
|---|---|---|
| Pulsante upload visibile | Sì o No | [ ] |
| Upload accettato | Sì o No | [ ] |
| Fallback: campo note per URL perizia | Sì | [ ] |

**Nota:** se l'upload non funziona, inserire il link pubblico alla perizia (pvp.giustizia.it) nel campo note.

---

### FASE 5 — Invio dati e ricezione screening

**Azione:** Clicca "Analizza" / "Invia".

**Percorso A — Screening gratuito (senza login):**

| Check | Atteso | Risultato |
|---|---|---|
| Risposta entro 5 secondi | Sì | [ ] |
| Screening mostra almeno: zona, stima prezzo, segnali di rischio | Sì | [ ] |
| Nessuna schermata di errore | Sì | [ ] |
| Messaggio chiaro sul prossimo step (pagamento per report completo) | Sì | [ ] |

**Percorso B — Job creato con pipeline AI (flusso completo):**

| Check | Atteso | Risultato |
|---|---|---|
| Backend risponde 202 ACCEPTED | Sì | [ ] |
| jobId ricevuto | Sì | [ ] |
| Polling status inizia automaticamente | Sì | [ ] |
| Status evolve: PENDING → PROCESSING → READY_FOR_PAYMENT | Sì | [ ] |
| Errore se DB/Redis non attivi: messaggio leggibile | Sì | [ ] |

---

### FASE 6 — Pagamento

**Azione:** Procedi al pagamento del piano scelto.

**Percorso A — Payment Link diretto (modalità manuale sicura):**

| Check | Atteso | Risultato |
|---|---|---|
| Link buy.stripe.com funziona | Sì | [ ] |
| Pagina Stripe si apre correttamente | Sì | [ ] |
| Test pagamento con carta 4242 4242 4242 4242 | Sì | [ ] |
| Conferma pagamento ricevuta da Stripe | Sì | [ ] |
| Simone riceve notifica su Stripe dashboard | Sì | [ ] |

**Percorso B — Checkout integrato (flusso automatico):**

| Check | Atteso | Risultato |
|---|---|---|
| POST /api/jobs/:jobId/checkout risponde con URL | Sì | [ ] |
| Redirect a Stripe funziona | Sì | [ ] |
| Pagamento test completato | Sì | [ ] |
| Webhook ricevuto dal server | Sì | [ ] |
| Job status aggiornato a PAID | Sì | [ ] |

**Carta test Stripe:** `4242 4242 4242 4242` | Scadenza: qualsiasi data futura | CVV: qualsiasi 3 cifre

---

### FASE 7 — Conferma al cliente

| Check | Atteso | Risultato |
|---|---|---|
| Cliente riceve email di conferma pagamento | Sì | [ ] |
| Email contiene: jobId o numero pratica | Sì | [ ] |
| Email contiene: stima tempi consegna report | Sì | [ ] |
| Email contiene: contatto per domande | Sì | [ ] |
| Se email non automatica: Simone la invia manualmente entro 1h | Sì (fallback) | [ ] |

**Template email manuale di conferma (fallback):**

> Oggetto: External Opinion — Pratica ricevuta ✓
>
> Ciao [Nome],
>
> ho ricevuto la tua richiesta per [indirizzo/link immobile].
> Il report sarà pronto entro [24/48/72] ore.
>
> Ti contatterò direttamente a questo indirizzo con il report completo.
>
> Per qualsiasi domanda: [numero WhatsApp o email Simone]
>
> Simone — External Opinion

---

### FASE 8 — Generazione e consegna report

**Percorso manuale (raccomandato per le prime vendite):**

| Check | Atteso | Risultato |
|---|---|---|
| Simone vede il pagamento su Stripe dashboard | Sì | [ ] |
| Simone apre /admin/review e trova il caso | Sì | [ ] |
| AI ha già generato una bozza di report | Sì o No | [ ] |
| Simone integra con propria analisi professionale | Sì | [ ] |
| Report inviato al cliente entro il tempo promesso | Sì | [ ] |

**Percorso automatico:**

| Check | Atteso | Risultato |
|---|---|---|
| /admin/review mostra report AI generato | Sì | [ ] |
| Simone approva con POST /admin/review/:jobId/approve | Sì | [ ] |
| Cliente riceve email automatica con report | Sì | [ ] |

---

## RIEPILOGO TEST

Dopo aver completato il test, compila questa tabella:

| Step | Funziona? | Blocco trovato |
|---|---|---|
| 1 — Pagina aperta | | |
| 2 — 5 tasti categoria | | |
| 3 — Campo URL | | |
| 4 — Upload perizia | | |
| 5 — Screening/Job | | |
| 6 — Pagamento | | |
| 7 — Conferma cliente | | |
| 8 — Consegna report | | |

---

## DEFINIZIONE "PRONTO PER VENDERE"

**Soglia minima (modalità manuale):**
- Step 6 Payment Link: OK
- Step 7 Conferma cliente: OK (anche manuale)
- Step 8 Consegna report: OK (anche manuale)

**Se questi tre sono OK → si può vendere oggi.**

**Soglia funnel automatico:**
- Tutti gli step OK senza intervento manuale

---

## PROSSIMA AZIONE SIMONE

1. Esegui questo test con un'asta reale da pvp.giustizia.it
2. Annota i risultati nella tabella
3. Se Step 6+7+8 sono OK → aggiorna CURRENT_COMMERCIAL_STATE.md e riprendi outreach
4. Se trovi blocchi → descrivi il blocco esatto e aggiorna FUNNEL_HEALTHCHECK.md
