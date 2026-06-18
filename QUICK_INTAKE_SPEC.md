# Quick Intake — Specifica UX e Flusso

## Obiettivo
Interfaccia cliente semplice, isolata, collegata al backend esistente.  
5 tasti → link → contatto → caseId → pagamento/report.  
Nessuna burocrazia visibile. Tutta la complessità resta dietro.

---

## Testo Hero

**Headline:**  
"Prima di fare un'offerta o comprare un immobile, scopri dove sono i rischi."

**Sottotitolo:**  
"Scegli il caso, incolla il link, ricevi uno screening iniziale."

**CTA:**  
"Avvia screening"

---

## Flusso UX (Progressive Disclosure)

### Step 1 — Selezione categoria
Il cliente sceglie UNA tra le 5 categorie. Pulsante selezionato = evidenziato.

### Step 2 — Link e contatto
Dopo selezione categoria, appare il form con:
- Campo URL (link annuncio / asta / portale)
- Campo email O telefono
- Campo note (opzionale, textarea)
- Pulsante "Avvia screening"

### Step 3 — Conferma
Dopo submit, il cliente vede:
- Codice caso (EO-XXXXXXXX)
- Riepilogo dati ricevuti
- Istruzioni per documenti facoltativi
- Link pagamento / prossima fase
- Tempi indicativi

---

## 5 Categorie

| # | Label | Descrizione per il cliente |
|---|-------|---------------------------|
| 1 | Prima casa | "Voglio capire se la casa che sto guardando è sicura prima di comprare." |
| 2 | Investimento immobiliare | "Voglio capire se l'immobile ha senso come investimento." |
| 3 | Asta immobiliare | "Voglio capire i rischi prima di fare offerta." |
| 4 | Compravendita immobiliare | "Sto comprando o vendendo e voglio una verifica prima di procedere." |
| 5 | Analisi tecnica / normativa | "Voglio verificare vizi, difformità, abusi, conformità, documenti o criticità tecniche." |

### Mapping interno (service field API)
| Categoria | `service` inviato al backend |
|-----------|------------------------------|
| Prima casa | `prima-casa` |
| Investimento immobiliare | `investimento` |
| Asta immobiliare | `asta` |
| Compravendita immobiliare | `compravendita` |
| Analisi tecnica / normativa | `analisi-tecnica` |

---

## Campi Form

### Obbligatori
- `categoria` — pulsante selezionato
- `urlAsta` — link annuncio/asta/portale immobile
- `email` — email o telefono cliente

### Facoltativi
- `note` — testo libero
- Allegati — dopo ricezione caseId, il cliente invia via email citando il codice

### Allegati accettati (indicazione post-submit)
Perizia, planimetria, APE, visure catastali, foto, documenti, computi, preventivi, PDF.

---

## Conferma Post-Submit

```
Caso creato: EO-[XXXXXXXX]
Abbiamo ricevuto il tuo link e la tua richiesta.

Prossima fase: pagamento screening → report entro 24-48h.

Se hai perizia, planimetria, APE o foto, inviaci i documenti
all'indirizzo documents@externalopinion.it indicando il codice:
EO-[XXXXXXXX]

[Procedi al pagamento] ← bottone con checkoutUrl
```

---

## Regole UX
- Non mostrare campo prima di selezione categoria
- Non più di 3 campi visibili contemporaneamente
- Nessun gergo tecnico ("tier", "jobId", "pipeline")
- Il codice caso deve essere visibile e copiabile
- Errori mostrati inline, non in modale
- Mobile-first (padding adeguato, font leggibile, tap target ≥ 44px)

---

## Tipi di accesso
La pagina è pubblica, senza autenticazione.  
URL: `/quick-intake` → serve `public/quick-intake.html`
