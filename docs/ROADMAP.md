# EXTERNAL OPINION — ROADMAP
**Aggiornato: 2026-06-06 · Fonte: BUSINESS_PLAN_ExternalOpinion_2025-2028.txt, REPORT_ANALISI_STRATEGICA_2026.md**

---

## POSIZIONE ATTUALE: FASE 0 — VALIDAZIONE

> Settimana 0: Railway build + primo pagamento reale.
> Tutte le proiezioni partono da questa data come T=0.

---

## FASE 0 — QUICK WIN (T+0 → T+6 settimane)
**Obiettivo: primo €1.000–1.500 MRR · Probabilità: 60%**

### Target
- Segmento: investitori privati aste giudiziarie, CTU
- Prodotto: analisi on-demand €69–€129
- Canali: forum Perizie.net, gruppi LinkedIn "Periti Immobiliari", passaparola

### Milestone
- [ ] Railway build verde ← **ADESSO**
- [ ] Primo pagamento Stripe processato
- [ ] Import dati OMI (microzone catastali)
- [ ] Confidence score (Alta/Media/Bassa)
- [ ] PDF professionale firmabile
- [ ] 5 beta CTU gratuiti → feedback → calibrazione
- [ ] Landing `/aste` attiva e funzionante

### Unit Economics Fase 0
| Metrica | Valore |
|---------|--------|
| ARPU on-demand | €69–€129 |
| Costo LLM/report | €6–12 |
| Gross Margin | ~70–75% |
| Break-even costi diretti | €500–800 MRR (5-10 report/mese) |
| Infrastruttura mensile | €60 (Railway + PostgreSQL) |

---

## FASE 1 — MVP SAAS (T+2 → T+7 mesi)
**Obiettivo: €5.000–8.000 MRR · Probabilità: 45%**

### Target
- Segmento: agenzie immobiliari, studi peritali, professionisti RE
- Prodotto: subscription €199–€999/mese (bundle report + dashboard)
- Canali: LinkedIn outreach diretto, referral beta tester

### Milestone
- [ ] 10 clienti paganti on-demand (prerequisito per SaaS)
- [ ] Auth multi-tenant
- [ ] Dashboard clienti (job history, report scaricabili)
- [ ] Comparable sales engine (3-5 comparabili per report)
- [ ] Subscription mensile attiva su Stripe
- [ ] Feedback loop da CTU beta → iterazione prodotto

### Nota strategica
Non costruire la subscription prima di 10 clienti on-demand che tornano.
Il rischio principale è costruire features prima di validare la domanda.

---

## FASE 2 — CRESCITA AVM (T+9 → T+13 mesi)
**Obiettivo: €12.000–18.000 MRR · Probabilità: 35%**

### Target
- Segmento: agenzie digitali, proptech, investitori istituzionali piccoli
- Prodotto: AVM Italia + forecast 12M + comparable sales avanzato

### Milestone
- [ ] AVM calibrato su scala nazionale (dati OMI 2015-2026)
- [ ] Forecast 12 mesi per province (Prophet/ARIMA)
- [ ] Firma digitale perizie (DocuSign/Namirial)
- [ ] Outreach enterprise avviato (banche, servicer NPL) ← iniziare al mese 6
- [ ] AI Act compliance: explainability + audit trail completo

---

## FASE 3 — API ECOSYSTEM (T+14 → T+18 mesi)
**Obiettivo: €20.000–30.000 MRR · Probabilità: 25%**

### Target
- Segmento: proptech, fintech, lenders, agenzie digitali
- Prodotto: API per-call €0.50–€5.00 + developer portal

### Milestone
- [ ] OpenAPI spec documentata (solo dopo 50+ clienti SaaS)
- [ ] Batch endpoint POST /valuations/bulk + webhook
- [ ] CSV/Excel export per portafogli
- [ ] Developer portal + pricing tier
- [ ] Primi 2-3 deal enterprise early stage

---

## FASE 4 — ENTERPRISE (T+20 → T+24 mesi)
**Obiettivo: €30.000–45.000 MRR · Probabilità: 20%**

### Target
- Segmento: banche, SGR, servicer NPL/UTP (Prelios, doValue, Cerved)
- Prodotto: white-label €2.000–€10.000/mese + SLA 99.9%

### Milestone
- [ ] White-label mode (tenant isolation Prisma)
- [ ] SLA 99.9% garantito contrattualmente
- [ ] Firma digitale certificata + workflow approvazione perito
- [ ] AI Act "high risk" compliance completa
- [ ] Almeno 1 contratto servicer NPL firmato

---

## PROIEZIONI MRR (scenario realistico)

| Fase | Timeline | MRR Target | Probabilità |
|------|----------|-----------|-------------|
| Fase 0 | Mese 2-3 | €1.000–1.500 | 60% |
| Fase 1 | Mese 5-7 | €5.000–8.000 | 45% |
| Fase 2 | Mese 9-13 | €12.000–18.000 | 35% |
| Fase 3 | Mese 14-18 | €20.000–30.000 | 25% |
| Fase 4 | Mese 20-24 | €30.000–45.000 | 20% |

**Break-even full-time (incluso costo opportunità fondatore):** ~€8.000–10.000 MRR (mese 7-9 scenario realistico)

**Nota:** Il business plan originale è ottimistico del 40-60% sui tempi. Questi numeri sono già corretti al ribasso.

---

## PRICING UFFICIALE

| Servizio | Prezzo | Delivery |
|---------|--------|----------|
| Analisi Asta Starter | €69 | 24h |
| Full Report Professional | €129 | 48h |
| Investor Report | €299 | 48h |
| Due Diligence Completa | €690 | 48h |
| SaaS Base (futuro) | €199/mese | — |
| SaaS Pro (futuro) | €999/mese | — |
| API per-call (futuro) | €0.50–€5/call | — |
| White-label Enterprise (futuro) | €2.000–€10.000/mese | — |

---

## ARCHITETTURA TARGET V19+ (post-revenue)

- [ ] Kubernetes deployment con HPA
- [ ] Vector database pgvector per RAG catastale
- [ ] Computer Vision per rilevamento abusi edilizi
- [ ] Monte Carlo financial simulations
- [ ] Multi-cloud LLM consensus
- [ ] RBAC admin dashboard
- [ ] Batch processing portafogli (BullMQ già pronto)
