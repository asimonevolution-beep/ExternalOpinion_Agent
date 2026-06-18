# Quick Intake — Script di Test

## Prima di iniziare

Assicurarsi che il server sia running:
```
npm start
# oppure: node server.js
```

---

## TEST 1 — Accesso Pagina

**Azione:** Aprire browser → `http://localhost:3000/quick-intake.html`  
**Alternativa Railway:** `https://[tuo-dominio]/quick-intake.html`

**Risultato atteso:**
- [ ] Pagina carica senza errori
- [ ] Hero visibile: "Prima di fare un'offerta o comprare un immobile..."
- [ ] 5 pulsanti categoria visibili
- [ ] Form inizialmente nascosto (appare dopo selezione categoria)

---

## TEST 2 — Selezione Categoria

**Azione:** Cliccare su "Asta immobiliare"

**Risultato atteso:**
- [ ] Pulsante "Asta immobiliare" evidenziato (bordo/colore cambia)
- [ ] Form appare con campo URL, campo email, campo note
- [ ] Gli altri 4 pulsanti restano selezionabili (cambio categoria possibile)

---

## TEST 3 — Submit Base (campi minimi)

**Dati da inserire:**
- Categoria: "Asta immobiliare"
- Link: `https://www.astegiudiziarie.it/aste-immobiliari/` (o qualsiasi URL)
- Email: `test@externalopinion.it`

**Azione:** Cliccare "Avvia screening"

**Risultato atteso:**
- [ ] Spinner/loading visibile durante la chiamata
- [ ] Dopo risposta: sezione conferma appare
- [ ] Codice caso visibile (es. EO-a1b2c3d4)
- [ ] Riepilogo dati mostrato (categoria, link ricevuto)
- [ ] Istruzioni allegati visibili
- [ ] Bottone "Procedi al pagamento" visibile

---

## TEST 4 — Verifica dati salvati

**Azione:** Aprire Railway dashboard → PostgreSQL → Tabella `Job`

**Risultato atteso:**
- [ ] Record nuovo con `id` = jobId ricevuto
- [ ] `url` = link inserito
- [ ] `email` = email inserita
- [ ] `status` = PENDING o simile
- [ ] `payload.service` = "asta"
- [ ] `payload.zonaDati.source` = "quick-intake"

---

## TEST 5 — Validazione Form (campi obbligatori)

**Azione:** Cliccare "Avvia screening" SENZA compilare il link

**Risultato atteso:**
- [ ] Errore inline: "Link obbligatorio"
- [ ] NO submit all'API
- [ ] NO codice caso generato

**Azione:** Compilare link ma non email/telefono

**Risultato atteso:**
- [ ] Errore inline: "Email o telefono obbligatorio"

---

## TEST 6 — Cambio categoria

**Azione:** Selezionare "Prima casa", poi cambiare a "Investimento immobiliare"

**Risultato atteso:**
- [ ] Selezione aggiornata
- [ ] Form rimane visibile
- [ ] Campi già compilati vengono mantenuti

---

## TEST 7 — Collegamento pagamento

**Azione:** Cliccare "Procedi al pagamento" nella schermata di conferma

**Risultato atteso:**
- [ ] Redirect a Stripe checkout (o Payment Link)
- [ ] Se `checkoutUrl` non funziona: verificare fallback Payment Link statico

**Se checkout non funziona:**  
Sostituire `checkoutUrl` con Payment Link Stripe diretto (`buy.stripe.com/...`)  
Documentare il gap in QUICK_INTAKE_IMPLEMENTATION_PLAN.md

---

## TEST 8 — Mobile

**Azione:** Aprire su smartphone o DevTools → Mobile viewport

**Risultato atteso:**
- [ ] Layout non rotto
- [ ] Pulsanti toccabili (min 44px)
- [ ] Form leggibile senza zoom
- [ ] Conferma leggibile

---

## TEST 9 — Errore API (simulazione)

**Azione:** Modificare temporaneamente URL a uno non valido: `xyz-non-url`

**Risultato atteso:**
- [ ] Messaggio errore chiaro al cliente (non stacktrace)
- [ ] Nessun dato perso: il cliente può riprovare

---

## TEST 10 — Isolamento dal funnel principale

**Azione:** Aprire `http://localhost:3000/` (index.html principale)

**Risultato atteso:**
- [ ] Funnel principale funziona normalmente
- [ ] Nessuna interferenza della Quick Intake

---

## Riepilogo Checklist GO LIVE

```
[ ] TEST 1  — Pagina carica
[ ] TEST 2  — Selezione categoria funziona
[ ] TEST 3  — Submit crea jobId
[ ] TEST 4  — Dati salvati in DB
[ ] TEST 5  — Validazione client-side
[ ] TEST 6  — Cambio categoria
[ ] TEST 7  — Pagamento collegato (o fallback documentato)
[ ] TEST 8  — Mobile OK
[ ] TEST 9  — Errori gestiti
[ ] TEST 10 — Funnel principale intatto
```

**GO LIVE:** tutti i test da 1 a 5 + 9 + 10 = PASS  
**TEST 7 (pagamento):** può essere fallback Stripe link, non blocca GO  
**TEST 8 (mobile):** visivo, non blocca GO se layout decente
