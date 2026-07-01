# External Opinion / CASCADE

> **DOCUMENTO MADRE DEL PROGETTO:**
> Leggere prima `FONDAMENTO_01_ROADMAP_ECONOMICA_MADRE.md`.
> Nessuna modifica strategica o tecnica è valida se contraddice la Roadmap Economica Madre.

---

## Cos'è External Opinion

Piattaforma di analisi indipendente per aste giudiziarie immobiliari.
Il cliente arriva con un dubbio/rischio sulla SUA asta — noi consegniamo una diagnosi tecnica operativa.

**Prodotto:** report PDF con diagnosi, criticità, impatto economico, decisione operativa.  
**Prezzi:** €69 / €129 / €299  
**Canale:** Google Search/Ads → landing → form → pagamento → report

---

## File fondamentali (leggere in ordine)

1. [`FONDAMENTO_01_ROADMAP_ECONOMICA_MADRE.md`](FONDAMENTO_01_ROADMAP_ECONOMICA_MADRE.md) — basamento del progetto
2. [`CURRENT_STATE.md`](CURRENT_STATE.md) — stato reale attuale
3. [`NEXT_TASK.md`](NEXT_TASK.md) — prossima azione
4. [`CHANGELOG.md`](CHANGELOG.md) — storico decisioni
5. [`ARCHIVE_ADVANCED_MODULES.md`](ARCHIVE_ADVANCED_MODULES.md) — moduli futuri archiviati

---

## Funnel principale (Fase 0)

```
landing → form → pre-analisi → paywall → pagamento → report → consegna → incasso
```

---

## Stack tecnico

- **Frontend:** HTML/CSS/JS statico — deploy su Netlify (`public/`)
- **Backend:** Node.js (`server-v18.3.js`) — deploy su Railway
- **Database:** PostgreSQL via Prisma (`prisma/`)
- **Pagamenti:** Stripe LIVE
- **Email:** Resend
- **AI:** Claude API (consenso multi-modello)
- **Dominio:** externalopinion.it (Cloudflare)

---

## Fase attuale

**FASE 0 — PRIMO INCASSO**

Gate di uscita: 10 report venduti OPPURE €1K MRR reale.

---

## CASCADE

Il motore tecnico del progetto. Non è la direzione commerciale.
Serve il funnel, automatizza la consegna, aumenta potenza quando l'incasso lo richiede.

Documentazione tecnica: [`docs/`](docs/)
