# EXTERNAL OPINION — COMPETITOR ANALYSIS
**Aggiornato: 2026-06-06 · Fonte: analisi_competitiva_2026.html + REPORT_ANALISI_STRATEGICA_2026.md**

---

## DATI DI MERCATO

| Indicatore | Valore | Fonte |
|---|---|---|
| Compravendite residenziali IT 2025 | ~750.000 | OMI / Agenzia Entrate |
| Aste giudiziarie IT/anno | ~108.000 | Osservatorio Brick/Berry |
| Prezzo medio nazionale €/mq (mar 2026) | €2.179 (+4.31% YoY) | Idealista / Nomisma |
| Procedure esecutive immobiliari/anno | ~80.000 | Ministero Giustizia |
| Agenzie immobiliari attive IT | 37.000+ | FIMAA |
| Crediti NPL/UTP con collaterale RE | €40B+ in workout | Banca d'Italia |
| Target mercato PropTech IT | ~€2.1B | stima aggregata |
| AI applicata al RE (globale 2026) | $4.5–6B | ⚠️ NON $404.9B — dato errato nel doc originale |

---

## MAPPA COMPETITOR

### TIER 1 — Benchmark tecnico (non operano in Italia)

| Player | Sede | Funding | Modello | Gap vs IT |
|--------|------|---------|---------|-----------|
| **HouseCanary** | 🇺🇸 USA | Custom | API $0.30–$6/call | USA only |
| **CoreLogic/Cotality** | 🇺🇸 USA | Enterprise | Licenza bulk | USA/AU only |
| **PriceHubble** | 🇨🇭 CH/EU | €34M | B2B SaaS + white-label | IT via TECMA ⚠️ |
| **OneDome** | 🇬🇧 UK | $46.9M | SaaS RE workflow | UK focus |

### TIER 2 — Competitor diretti IT (bassa AI)

| Player | Sede | Funding | Modello | Debolezza |
|--------|------|---------|---------|-----------|
| **Casavo** | 🇮🇹 Milano | $817M | Marketplace + fee | B2C, non monetizza dati |
| **Wikicasa** | 🇮🇹 Milano | $3.3M | Portal + data B2B | Zero AI avanzata |
| **idealista/data** | 🇪🇸/🇮🇹 | N/D | SaaS + portal | No AI narrativa |
| **Tecnocasa** | 🇮🇹 Network | Privata | Interno no API | Zero AI, dati non accessibili |

### TIER 3 — USA mid-market (non rilevanti IT)

| Player | Modello | Gap |
|--------|---------|-----|
| **ATTOM Data** | API tiered $95/mo | USA only |
| **Cherre / Agent.STUDIO** | Enterprise AI custom | USA/globale |
| **AppFolio AI** | SaaS property mgmt | USA only |

---

## MATRICE FEATURE

| Feature | **ExternalOpinion** | HouseCanary | PriceHubble | Casavo | Wikicasa |
|---------|---------------------|-------------|-------------|--------|----------|
| Report AI narrativo | ✅ **UNICO** | ✗ | ✗ | ✗ | ✗ |
| Pipeline multi-agent | ✅ **UNICO** | ✗ | ✗ | ✗ | ✗ |
| Perizia aste/CTU | ✅ **UNICO** | ✗ | ✗ | ✗ | ✗ |
| AVM automatico | ⚡ In build | ✅ Gold std | ✅ EU | ✅ IT/ES | ◑ Base |
| Confidence score | ⚡ Da fare | ✅ Standard | ✅ | ◑ | ✗ |
| RAG dati catastali IT | ✅ Modulo | ✗ | ◑ | ◑ | ✗ |
| Copertura mercato IT | ✅ Target | ✗ | ◑ via TECMA | ✅ | ✅ |
| API pubblica | ◑ Roadmap | ✅ | ✅ | ✗ | ✗ |
| White-label | ◑ Roadmap | ✅ | ✅ Core | ✗ | ✅ |
| Batch portfolio | ◑ Roadmap | ✅ | ✅ | ✗ | ✗ |
| Dati transazionali reali | ❌ GAP | ✅ | ✅ | ✅ parziale | ✗ |
| Conformità normativa IT | ✅ by design | ✗ | ◑ | ◑ | ✅ |
| Firma professionale reale | ✅ Geom. Azzali | ✗ | ✗ | ✗ | ✗ |

**Posizionamento:** ExternalOpinion occupa il quadrante "Alta profondità AI + Alta copertura IT" — genuinamente vuoto nel mercato attuale.

---

## GAP CRITICI DA COLMARE

### Priorità 1 — Bloccanti per la vendita

| Gap | Impatto | Azione |
|----|---------|--------|
| **Confidence Score** | Blocca adozione B2B professionale (CTU, banche) | Tre livelli (Alta/Media/Bassa) basati su dati OMI + comparabili |
| **Dati OMI integrati** | AVM non credibile senza valori €/mq per microzona | Import CSV gratuiti Agenzia Entrate in PostgreSQL (2-3 giorni) |
| **PDF professionale** | Il cliente compra un documento, non "un'analisi" | Template fisso: intestazione, sezioni fisse, spazio firma |

### Priorità 2 — Crescita (non per lancio)

| Gap | Timing | Azione |
|----|--------|--------|
| API pubblica documentata | Fase 3 (mesi 10-14) | OpenAPI spec + developer portal |
| White-label per banche/agenzie | Fase 4 (mesi 15+) | Tenant isolation Prisma + SLA 99.9% |
| Forecast 12-36 mesi | Fase 2 | Prophet/ARIMA su dati OMI storici |
| Batch API portfolio NPL | Fase 3 | POST /valuations/bulk + webhook |
| Comparable sales engine | Fase 2 | Clustering zona+tipologia+superficie |
| Firma digitale perizie | Fase 2 | DocuSign/Namirial + workflow perito |

---

## SWOT COMPETITIVO

### Strengths
- Unico AI-native con pipeline multi-agent per perizie IT
- Modulo aste/CTU non replicato da nessun competitor
- Copertura normativa italiana by design (AI Act EU)
- Costi fissi bassi (Railway ~€60/mese)
- Firma professionale Geom. Azzali — responsabilità tecnica reale

### Weaknesses
- Zero dati transazionali proprietari (dipendenza OMI pubblici)
- AVM non calibrato su scala nazionale
- Nessuna API pubblica oggi
- Brand awareness zero
- Team piccolo: rischio esecuzione roadmap ambiziosa

### Opportunities
- 80.000 procedure esecutive/anno: zero competitor AI in questo segmento
- Mercato NPL/UTP €40B+: un contratto servicer = €50K–500K/anno
- 37.000 agenzie RE: se 2% adotta Starter (€199/mese) = €148K MRR
- AI Act EU: chi ha audit trail ora ha vantaggio regolatorio 2-3 anni

### Threats
- **PriceHubble (urgente):** già presente IT via TECMA, €34M funding — può chiudere segmento bancario
- **LLM commodity:** il report AI diventa replicabile — il moat sono i dati e lo scoring proprietario
- **Casavo pivot B2B data:** ha i migliori dati transazionali IT — se li monetizza, è competitor pericoloso
- **Immobiliare.it/Idealista feature AI:** distribuzione + AI = competitor potenzialmente devastante

---

## OPPORTUNITÀ BLUE OCEAN (segmenti non serviti)

| # | Segmento | Ticket | Tag |
|---|----------|--------|-----|
| 1 | Perizie CTU per procedure esecutive | €500–2.000/perizia | QUICKWIN MVP |
| 2 | Portfolio NPL/UTP per servicer | €50K–500K/contratto/anno | HIGH VALUE |
| 3 | AI-Assisted Appraisal (bozza AI + firma perito) | €99–299/perizia | DIFFERENZIANTE |
| 4 | White-label agenzie franchise (RE/MAX, Coldwell) | €199–499/sede/mese | SCALABILE |
| 5 | Compliance AI Act per valutazioni RE | — | MOAT REGOLATORIO |
| 6 | Due diligence RE per M&A e fondi | €2.000–10.000/portafoglio | HIGH TICKET |
