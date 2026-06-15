# GO-TO-MARKET — EXTERNALOPINION

---

## MERCATO

- ~121.269 aste giudiziarie in Italia (2024). Altre fonti: ~108.000/anno (~€18,5 mld).
- Pool stimato: 200.000-500.000 valutatori seri/anno.
- Blue ocean: pochi competitor AI diretti al lancio.
- Mercato NAZIONALE (tutta Italia), NON geo-limitato. Outreach Modena/Bologna differito fino a validazione su traffico nazionale anonimo (regola reputazione locale).

## COMPETITOR

- **AI Aste (aiaste.it):** vende analisi perizia €3,90-4,90/report via AI "Tessa". Il loro disclaimer dice che NON sostituiscono un geometra → vantaggio di posizionamento per EO.
- AI Immobili/Tessati: valida la domanda, smentisce l'assunzione "zero competitor".
- PriceHubble (IT via TECMA, €34M), Casavo (EVA), Wikicasa. Gap: no confidence score, no API pubblica, no white-label.

## CANALI CONFERMATI

1. **Rete personale** — messaggi diretti (drafted). 5 contatti caldi inviati, incluso Abramo.
2. **Pagina Facebook External Opinion** (creata 12 giugno) — consulenza immobiliare, bio aste, sito externalopinion.it.
3. **Gruppi Facebook aste giudiziarie** — nazionali, +5.000 iscritti, MAI Modena. Regola d'oro: prima leggi e commenti da esperto SENZA link (2-3 giorni), poi posti. Account nuovo che spamma viene bannato.
4. **Forum:** FinanzaOnline (sezione Immobiliare, account EXTERNAL OPINION), InvestireOggi (891 thread aste), Substack pcavallari.
5. **Referral:** primo cliente che porta altri riceve analisi gratis.
6. **Google Ads** — campagna Search su keyword alta intenzione (file CAMPAGNA_GOOGLE_ADS_EO-Search-Aste-01.md). ~€10/giorno → 3-5 vendite/mese stimato.

## I POST FACEBOOK — SISTEMA 50 CASI / 5 BLOCCHI

Pagina alimentata da 50 casi-tipo, programmati con Meta Business Suite (1 post/giorno, ore 7:30 o 19:30). Verdetto in cima, taglio "tagliare la paura".

Primi due post pubblicati (12 giugno): caso usufrutto, caso condominio ("Il conto del passato lo paghi tu"), entrambi ROSSO in cima.

**5 BLOCCHI tematici:**
- BLOCCO 1 — DIRITTI: usufrutto, nuda proprietà, quota 50%, servitù
- BLOCCO 2 — SOLDI NASCOSTI: condominio, imposte 9%, impianti, tetto
- BLOCCO 3 — OCCUPAZIONE: debitore collaborativo, affitto opponibile, senza titolo, comodato
- BLOCCO 4 — ABUSI EDILIZI: sanabili 30k, abuso non sanabile, crepa, amianto (terreno da tecnico)
- BLOCCO 5 — METODO + AFFARE VERO: 24-48 ore, il rosso che salva, affare vero VERDE, perché External Opinion

## AUTOMAZIONE

- Meta Business Suite: carichi i post, si pubblicano da soli per settimane.
- forum-monitor.js: monitoraggio RSS orario con push ntfy (eo-dev-83562128).
- lead-radar.js: scoring lotti pubblici per urgenza × rischio × valore, filtra Modena.
- grazie.html: thank-you page post-pagamento con GA4 + Google Ads conversion tracking.

## MODELLO FINANZIARIO

F0→F4 in Excel (8 fogli). Sensitivity: conversion rate e prezzo medio dominano il cashflow (~€2.300/mese ciascuno a ±20%); costo AI quasi irrilevante (~€9/mese). Gate F1: quasi passa, fallisce su CAC (€41,7 vs €40) e LTV/CAC (1,46x vs 3x) → serve ridurre CPC o alzare prezzo a ~€89.