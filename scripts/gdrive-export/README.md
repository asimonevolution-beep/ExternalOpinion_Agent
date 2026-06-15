# Export Google Docs (.gdoc) → repo

Esporta i Google Docs di External Opinion dal Drive e li salva come **Markdown** dentro
`assets/canonical/DRIVE_EXTERNALOPINION/<CATEGORIA>/_da_gdoc/`.

Risolve il limite per cui i `.gdoc` sono cloud-only e non leggibili dal filesystem.

---

## Setup (una volta sola) — ~3 minuti

### 1. Installa le dipendenze
```
cd scripts/gdrive-export
npm install
```

### 2. Crea le credenziali OAuth su Google Cloud
Questo passo richiede il TUO account Google (io non ho accesso alla Console).

1. Vai su <https://console.cloud.google.com/>
2. In alto, crea (o seleziona) un progetto, es. **"External Opinion Export"**.
3. Menu → **API e servizi → Libreria** → cerca **"Google Drive API"** → **Abilita**.
4. Menu → **API e servizi → Schermata consenso OAuth**:
   - Tipo utente: **Esterno** → Crea
   - Compila solo i campi obbligatori (nome app, email di supporto = la tua, email sviluppatore = la tua) → Salva e continua fino in fondo.
   - In **Utenti di test** aggiungi la tua email `a.simonevolution@gmail.com` → Salva.
5. Menu → **API e servizi → Credenziali** → **+ Crea credenziali → ID client OAuth**:
   - Tipo di applicazione: **App desktop** → Crea.
6. Scarica il JSON (pulsante **Scarica JSON**) e salvalo come:
   ```
   scripts/gdrive-export/credentials.json
   ```
   (il nome deve essere esattamente `credentials.json`)

### 3. Primo avvio (autorizzazione)
```
npm run export
```
- Si apre il browser → accedi con la tua Google → "L'app non è verificata": clicca **Avanzate → Vai a External Opinion Export (non sicuro)** → consenti (sola lettura del Drive).
- Viene salvato `token.json`: dalle volte successive niente più browser.

---

## Uso

| Comando | Cosa fa |
|---|---|
| `npm run export` | Esporta solo i doc in `gdoc-list.json` nelle rispettive categorie |
| `npm run export:all` | Esporta **tutti** i Google Docs/Sheet del Drive in `_export_completo/` |

Modifica `gdoc-list.json` per cambiare quali doc esportare e in che categoria.

---

## Sicurezza
- `credentials.json` e `token.json` sono in `.gitignore`: **non finiscono mai su git**.
- Lo scope richiesto è **sola lettura** (`drive.readonly`): lo script non può modificare/cancellare nulla sul Drive.
