# External Opinion — MAPPA PASSAGGI DI CERTIFICAZIONE

## Catena operativa

Cliente
→ Interfaccia
→ Caso
→ CaseId
→ Pagamento
→ Analisi
→ Report
→ Consegna
→ Incasso

---

## Punto 1 — Prima linea cliente

Domanda:
Quale link può aprire oggi un cliente reale?

OK se:
- link certo;
- ambiente identificato;
- nessuna confusione tra VPS, Netlify, Hostinger;
- pagina accessibile.

Stato:
DA VERIFICARE.

---

## Punto 2 — Creazione caso

Domanda:
Il sistema salva categoria, link, contatto e genera caseId?

OK se:
- categoria salvata;
- link salvato;
- contatto salvato;
- caseId generato;
- caso recuperabile.

Stato:
DA VERIFICARE.

---

## Punto 3 — Pagamento collegato

Domanda:
Stripe collega pagamento e caseId?

OK se:
- Checkout dinamico;
- client_reference_id presente;
- metadata con caseId/jobId;
- webhook riceve pagamento;
- caso aggiornato come pagato.

Stato:
DA VERIFICARE.

---

## Punto 4 — Analisi / report

Domanda:
Dopo pagamento viene prodotto qualcosa di consegnabile?

OK se:
- screening o report esiste;
- anche manuale assistito va bene se dichiarato;
- nessun cliente resta senza consegna.

Stato:
DA VERIFICARE.

---

## Punto 5 — Consegna

Domanda:
Il cliente riceve output in modo tracciato?

OK se:
- email/link/PDF/messaggio;
- caseId collegato;
- report recuperabile.

Stato:
DA VERIFICARE.

---

## Punto 6 — Incasso e archivio

Domanda:
Caso, pagamento, cliente e report restano collegati?

OK se:
- cliente identificato;
- pagamento identificato;
- caseId identificato;
- report collegato;
- stato aggiornato.

Stato:
DA VERIFICARE.
