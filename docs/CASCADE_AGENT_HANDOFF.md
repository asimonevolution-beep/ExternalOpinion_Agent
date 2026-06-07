# CASCADE AGENT HANDOFF

## LEGGE CENTRALE CASCADE
Minimizzare dispersione per massimizzare potenza validata.
Oggettivo o non entra.
Verificato o non passa.
PASS o non avanza.

## REGOLE ANTI-FALSO-PASS
- File obbligatorio mancante = FAIL.
- Artifact mancante = FAIL.
- Formula non verificata = FAIL.
- safeRoiCalculation non eseguita = FAIL.
- safeRoiCalculation non importabile = FAIL.
- ROI -32,3% o -32.3% presente = FAIL.
- ROI -30,6% o -30.6% assente = FAIL.
- YELLOW o GIALLO assente = FAIL.
- PDF solo esistente = NON VALIDO.
- PDF non verificato nel contenuto = ACTION2_STATUS ACTIVE_NOT_DONE.
- Verifica parziale = mai DONE.
- Output plausibile senza evidenza = INVALIDO.

## STATO OPERATIVO
- DONE: Azione 1 — Semaforo / decisione Abramo / YELLOW-HIGH — PASS.
- ACTIVE: Azione 2 — ROI -30,6% tramite safeRoiCalculation in HTML, Markdown e PDF.
- LOCKED: Azione 3 — PDF template collegato a worker-scoring solo dopo Azione 2 PASS completo.
- FORBIDDEN: Saltare Azione 2. Dichiarare ROI validato senza formula coerente. Passare ad Azione 3. Rifare Railway. Rifare CORS. Rifare Netlify. Rifare lead-event. Rifare zero-friction. Rifare dati Abramo. Rifare strategia generale. Generare teoria. Esporre linguaggio interno al cliente.

## DATI SORGENTE
- expectedRevenue = 180450
- totalCosts = 260000

## FORMULA ROI
ROI = ((expectedRevenue - totalCosts) / totalCosts) * 100

## RISULTATI
- Risultato corretto: ROI = -30,6%
- Errore da correggere: ROI precedente -32,3% non coerente.

## CRITERIO PASS AZIONE 2
- Handoff letto e valido.
- Calcolo ROI matematico -30.6 verificato.
- safeRoiCalculation importata ed eseguita con esito -30.6.
- File obbligatori HTML e Markdown esistenti.
- Valore -32,3% e -32.3% assente.
- Valore -30,6% o -30.6% presente.
- YELLOW o GIALLO presente.
- Artifact JSON creato e aggiornato.
- Produzione non toccata.
- Email non inviata.
- Deploy non eseguito.
- PDF_STATUS = NOT_VERIFIED finché PDF non viene verificato nel contenuto.
- ACTION2_STATUS = ACTIVE_NOT_DONE finché PDF non viene verificato nel contenuto.

## DIVIETI PERMANENTI
Non usare puntini.
Non usare placeholder.
Non usare costrutti ipotetici senza blocco reale.
Non dichiarare completato senza prova.
Non saltare azioni.
Non rifare sistemi già chiusi.
Non chiedere a Simone dati già presenti.
Non trasformare un obiettivo in stato raggiunto.
Non consegnare report nel corpo email.
Non dichiarare delivery proof senza allegato reale.
