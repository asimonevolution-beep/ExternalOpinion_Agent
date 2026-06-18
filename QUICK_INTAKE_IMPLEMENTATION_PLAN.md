# Quick Intake — Piano Implementazione

## Principio: Zero Interferenza

La Quick Intake usa il backend esistente senza modificarlo.  
Nessuna nuova route obbligatoria. Nessuna modifica al funnel principale.

---

## Architettura

```
CLIENT
  └── GET /quick-intake
        └── public/quick-intake.html  (file statico esistente dopo creazione)
              └── POST /api/analyze   (endpoint esistente, invariato)
                    └── ritorna jobId + checkoutUrl
```

Il server Express già serve `public/` come static, quindi  
`public/quick-intake.html` è raggiungibile su `/quick-intake.html`.

Per URL pulita `/quick-intake` aggiungere 2 righe al server (opzionale, non bloccante).

---

## File Creati / Modificati

### Creato (nessuna modifica al sistema esistente)
- `public/quick-intake.html` — pagina standalone, zero dipendenze esterne
- `QUICK_INTAKE_SPEC.md` — specifica UX
- `QUICK_INTAKE_IMPLEMENTATION_PLAN.md` — questo file
- `QUICK_INTAKE_TEST_SCRIPT.md` — script test

### Modifiche opzionali al server (NON bloccanti)
Per route `/quick-intake` senza `.html`:
```js
// In server-v18.3.js, dopo le route API:
app.get('/quick-intake', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'quick-intake.html'));
});
```
Questa è una singola riga aggiuntiva, non distruttiva.

---

## Endpoint Backend Usati

### POST /api/analyze (esistente)
```json
{
  "urlAsta": "https://...",
  "email": "cliente@email.com",
  "service": "asta",
  "tier": "TIER_1_CASCADE_79",
  "zonaDati": {
    "categoria": "Asta immobiliare",
    "note": "testo libero",
    "source": "quick-intake"
  }
}
```

**Risposta:**
```json
{
  "success": true,
  "jobId": "uuid-del-caso",
  "checkoutUrl": "/api/jobs/[jobId]/checkout",
  "pollingUrl": "/api/jobs/[jobId]",
  "streamUrl": "/api/stream/[jobId]"
}
```

Il `jobId` diventa il caseId mostrato al cliente come `EO-[prime 8 char]`.

---

## Gestione Upload Allegati

**Stato attuale:** nessun endpoint upload nel backend Quick Intake.

**Fallback implementato nella pagina:**  
Dopo submit, il cliente vede istruzioni per inviare allegati via email  
citando il codice caso. Nessuna funzionalità rotta.

**Implementazione upload futura (quando pronto):**  
- `POST /api/jobs/:jobId/attachments` (multipart/form-data)
- Basta aggiungere il campo file al form HTML già pronto

---

## Collegamento Pagamento

`checkoutUrl` restituito dall'API punta a `/api/jobs/:jobId/checkout`.  
La Quick Intake usa questo URL per il bottone "Procedi al pagamento".

**Verifica necessaria prima del GO LIVE:**  
Confermare che `GET /api/jobs/:jobId/checkout` rediriga a Stripe.  
Se non implementato: sostituire con il Payment Link statico di Stripe  
(`buy.stripe.com/...`) come fallback.

---

## Checklist Tecnica

- [x] Backend `/api/analyze` funzionante
- [x] Generazione jobId funzionante  
- [x] `public/quick-intake.html` creato
- [ ] Route `/quick-intake` (opzionale — già accessibile come `/quick-intake.html`)
- [ ] Verificare `checkoutUrl` redirige a Stripe
- [ ] Upload allegati (fallback email OK)
- [ ] Email conferma automatica al cliente (opzionale)

---

## Rischi e Mitigazioni

| Rischio | Impatto | Mitigazione |
|---------|---------|-------------|
| Database down | Job non creato | Messaggio errore chiaro, no dati persi lato cliente |
| checkoutUrl non funzionante | Pagamento bloccato | Fallback su Payment Link statico Stripe |
| CORS su dominio diverso | API bloccata | quick-intake.html è servita dallo stesso dominio |
| Upload allegati mancante | Cliente non sa dove mandare docs | Istruzioni email post-submit |

---

## Rollback

Per annullare la Quick Intake basta:
1. Eliminare `public/quick-intake.html`
2. Rimuovere eventuale route `/quick-intake` (se aggiunta)

Zero impatto sul sistema principale.
