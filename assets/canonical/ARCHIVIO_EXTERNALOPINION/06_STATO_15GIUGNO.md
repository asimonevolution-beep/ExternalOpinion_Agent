# STATO OPERATIVO — aggiornato 15 giugno 2026

---

## FATTO (committato nel repo)

- **docs/COMANDAMENTI.md** — tre comandamenti (commit 2b3fff3)
- **assets/canonical/** — cartella asset intoccabili
- **guard-canonical.sh** — muro PreToolUse Write/Edit (commit fbab099). Attivo al riavvio di Claude Code.
- **docs/SISTEMA_OPERATIVO.md** — modello operativo orchestrazione (commit ccb59a5)
- 3 report PDF pronti per Abramo (Carpi, Serramazzoni, Finale Emilia)
- Messaggio Abramo usufrutto inviato

## BLOCCHI ATTIVI (in ordine di priorità)

1. **🔴 STRIPE LIVE — il blocco n.1.** Il Payment Link €20 è in MODALITÀ TEST → non incassa. Va ricreato in live. Senza questo nessun pagamento è mai andato a buon fine. Verificare onboarding live (P.IVA, IBAN — risulta fatto).
2. **DNS Resend** — 3 record da aggiungere in Cloudflare (zone d8f01ad8…, Zone/DNS/Edit su externalopinion.it). Blocca email domain.
3. **2 bug display** — ROI mostra 0.0%, valoreAttuale mostra "—" (NEXT_TASK.md).
4. **1 residuo bonifica** — stripe-webhook-handler.js riga 178: Perizie → Analisi.
5. **G2** — validazione idempotency via resend test.
6. **G3** — consolidare le due pipeline in una.

## PROSSIME AZIONI (sequenza)

**Domani mattina (sessione dedicata Stripe):**
1. Verifica test/live prodotto €20
2. Crea Payment Link in live
3. Verifica onboarding live completo
4. Testa tu stesso il link → si apre pagamento vero?
5. Manda link buono ad Abramo

**Poi (sessioni separate):**
- Mettere CENTRALE_NUCLEARE.md e questo archivio in assets/canonical/ (base permanente)
- Riavviare Claude Code per attivare il muro guard-canonical
- Scraper contatti intermediari Lombardia (Code, fonte vera, URL sorgente obbligatorio, robots.txt prima)

## FRONTE APERTO — ACQUISIZIONE CONTATTI

Target: intermediari creditizi/immobiliari, singoli e sub-agenti, Lombardia (NON colossi).
Metodo pulito: contatti GIÀ pubblicati dal professionista per essere contattato (base giuridica = dato pubblico a fini commerciali). Fonte pubblica ufficiale.
Gemini ha fallito 2 volte (liste inventate senza link fonte). Strumento giusto = Code con scraper vero, URL sorgente obbligatorio per riga.

## NOTA — IL VERO PROBLEMA DI FONDO

Troppe ore spese a recuperare cose già fatte/stabilite invece di averle in una base fissa. La soluzione è questo archivio + assets/canonical/: da qui in poi la base è scritta, fissa, intoccabile. Si riparte da terra solida. Mai più notti a recuperare.