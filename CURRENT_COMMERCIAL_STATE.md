# CURRENT_COMMERCIAL_STATE.md
*Frozen: 18 giugno 2026 — STATO COMMERCIALE AL MOMENTO DEL FREEZE OUTREACH*

---

## DECISIONE OPERATIVA

**OUTREACH COMMERCIALE SOSPESO.**
Motivo: verificare che il funnel minimo sia vendibile prima di bruciare i contatti importanti.
Riprendere solo dopo che FUNNEL_HEALTHCHECK.md dichiara: **OK automatico** oppure **OK manuale controllato**.

---

## COSA È STATO FATTO FINORA

### File creati (18 giugno 2026):
- `external_opinion_broker_leads.csv` — 30 contatti B2B mappati da fonti pubbliche
- `external_opinion_broker_outreach.md` — messaggi, script, tabella priorità, prossime azioni
- `CURRENT_COMMERCIAL_STATE.md` — questo file
- `FUNNEL_HEALTHCHECK.md` — analisi tecnica stato funnel
- `CUSTOMER_TEST_SCRIPT.md` — script test simulato cliente

### Ricerche effettuate:
- Credipass (sito, contatti, struttura rete)
- Auxilia Finance (sede Milano, email diretta, sede Roma)
- Kìron / Tecnocasa (sede Milano, franchising lombardi Pavia / Corsico / Brescia)
- Euroansa (sede Milano, agenzie Brescia e Parma con telefono diretto)
- WeUnit Group (struttura, numero consulenti)
- MutuiOnline (sede, email, struttura corporate)
- Consulenti aste Lombardia: Asta Consulting, FLX Managers, AICS, Gruppocasa
- Piattaforme: AstaInsieme, Avvocato360, IustLab, Dove.it

---

## CONTATTI MAPPATI — STATO

| Azienda | Contatto disponibile | Stato | Note |
|---|---|---|---|
| Auxilia Finance | info@auxiliafinance.it / +39 02 495.422.00 | **NON CONTATTARE ANCORA** | Email pronta nel file MD |
| Credipass | Form su /contatti | **NON CONTATTARE ANCORA** | 900+ agenti, priorità alta |
| Kìron Milano | +39 02 2804 0166 | **NON CONTATTARE ANCORA** | Prima rete creditizia IT |
| Euroansa Brescia | 030 317758 | **NON CONTATTARE ANCORA** | Telefono diretto |
| Euroansa Parma | +39 349 1335964 | **NON CONTATTARE ANCORA** | Telefono diretto |
| MutuiOnline | richieste@mutuionline.it | **NON CONTATTARE ANCORA** | Gruppo quotato, ciclo lungo |
| Asta Consulting | Via sito astaconsulting.it | **NON CONTATTARE ANCORA** | Alta rilevanza, piccola struttura |
| FLX Managers | Via sito flxmanagers.it | **NON CONTATTARE ANCORA** | Area Milano, risposta rapida |
| AICS | Via sito asteimmobiliarics.it | **NON CONTATTARE ANCORA** | Copre tutti i tribunali Lombardia |
| AstaInsieme | Via sito astainsieme.it | **NON CONTATTARE ANCORA** | Rete nazionale professionisti |
| WeUnit Group | Via sito weunit.it | **NON CONTATTARE ANCORA** | 500+ consulenti |
| RE/MAX Italia | Via LinkedIn | **NON CONTATTARE ANCORA** | Ciclo lungo |
| Fimaa Milano | Via segreteria | **NON CONTATTARE ANCORA** | Canale istituzionale |
| FIAIP Lombardia | Via segreteria | **NON CONTATTARE ANCORA** | Canale istituzionale |

**REGOLA:** Nessun contatto commerciale fino a verifica funnel completata.

---

## COSA MANCA PER IL LANCIO COMMERCIALE

### Pre-requisiti tecnici (da FUNNEL_HEALTHCHECK.md):
- [ ] Verifica che il frontend abbia i 5 tasti categoria + campo URL
- [ ] Verifica che PostgreSQL e Redis siano attivi su Railway
- [ ] Verifica che il webhook Stripe sia configurato e funzionante
- [ ] Verifica che la consegna report/email funzioni dopo il pagamento
- [ ] Fallback manuale documentato e attivo

### Pre-requisiti commerciali (dopo verifica funnel):
- [ ] Report di esempio da allegare alle email (il materiale più convincente)
- [ ] Prezzo B2B definitivo per partnership
- [ ] Pagina /partner su externalopinion.it
- [ ] Mappatura Sud + Roma + Bologna (non ancora fatta)

---

## PROSSIMA FASE DOPO VERIFICA FUNNEL

1. **Se funnel OK automatico:** avviare outreach partendo da priorità 1 (Auxilia Finance email)
2. **Se funnel OK manuale:** avviare outreach con disclaimer "report in 24-72 ore, consegna via email"
3. **Se funnel KO:** fixare prima il blocco critico, poi ricominciare da questo file

---

*Congelato. Non riprendere outreach senza aggiornare questo file.*
