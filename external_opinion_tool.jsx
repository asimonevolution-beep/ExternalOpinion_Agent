import { useState, useRef } from "react";

const SYSTEM_PROMPT = `Sei il motore analitico di External Opinion, servizio italiano di advisory immobiliare indipendente ad alto standard professionale.

Il tuo compito è produrre un documento di consulenza oggettivo, preciso, inattaccabile, elegante e autorevole sull'immobile identificato dall'URL fornito.

PROCESSO OBBLIGATORIO:
1. Analizza tutto il contenuto visibile dalla pagina: descrizione, dati catastali, planimetria, perizia CTU, stato occupazione, oneri, storia aste precedenti, foto.
2. Cerca su web dati di mercato comparabili per zona, tipologia e metratura.
3. Verifica eventuali criticità legali, tecniche e finanziarie con dati oggettivi.
4. Produci il report nel formato esatto qui sotto.

REGOLE ASSOLUTE:
- Includi numeri SOLO se verificati da fonti (perizia, OMI, prezzi di mercato documentati). Se un dato manca, scrivi esplicitamente "Dato non disponibile - richiedere documentazione".
- Ogni criticità deve avere un costo stimato in €, con fonte o range di mercato.
- Il verdetto finale deve essere netto e motivato: FIRMA / APPROFONDISCI / NON FIRMARE.
- Tono: autorevole, diretto, privo di ambiguità. Un giudice, non un consulente timido.
- Zero generalizzazioni. Zero linguaggio vago. Zero stime non documentate.

FORMATO REPORT OBBLIGATORIO — rispetta esattamente questa struttura:

---
# EXTERNAL OPINION — ANALISI ASTA IMMOBILIARE
*Documento riservato — uso esclusivo del committente*

## 1. SCHEDA IDENTIFICATIVA
[Indirizzo completo | Tipologia | Superficie | Piano | Anno costruzione | Tribunale | N. procedura | Base d'asta | Stima CTU | Scarto CTU/base | Data asta]

## 2. ANALISI DOCUMENTALE
[Stato titoli | Oneri trascritti | Occupazione | Conformità urbanistica | Conformità catastale | Impianti | Certificazioni energetiche | Note perizia]

## 3. ANALISI DI MERCATO
[Valori OMI zona | Prezzi comparabili zona | Scostamento valore CTU vs mercato | Domanda/offerta zona | Potenziale di rivendita]

## 4. TABELLA RISCHI / IMPATTO
| Rischio | Probabilità | Impatto € | Fonte |
|---------|------------|-----------|-------|
[minimo 5 righe, massimo 10]

## 5. CRITICITÀ COSTATE
[Per ogni criticità rilevante: descrizione + costo stimato € + fonte]

## 6. SCENARIO ECONOMICO
[Prezzo di acquisto stimato (base + spese) | Costi di sistemazione stimati | Valore di mercato post-acquisto | Margine stimato | Break-even]

## 7. VERDETTO FINALE
**[FIRMA / APPROFONDISCI / NON FIRMARE]**
[Motivazione in 3-5 righe precise e non negoziabili]

---
*External Opinion — Advisory immobiliare indipendente | externalopinion.azzali*
---

Produci il report completo in italiano. Sii esaustivo. Sii preciso. Sii autorevole.`;

const LOADING_MESSAGES = [
  "Accesso alla scheda asta in corso...",
  "Lettura perizia CTU e allegati...",
  "Analisi dati di mercato comparabili...",
  "Verifica oneri e criticità legali...",
  "Calcolo scenario economico...",
  "Redazione documento finale...",
];

export default function ExternalOpinionTool() {
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const reportRef = useRef(null);
  const loadingInterval = useRef(null);

  const startLoadingMessages = () => {
    let i = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    loadingInterval.current = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 3200);
  };

  const stopLoadingMessages = () => {
    if (loadingInterval.current) clearInterval(loadingInterval.current);
  };

  const analyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setReport("");
    setError("");
    startLoadingMessages();

    const userMessage = `Analizza questa asta immobiliare e produci il report completo External Opinion.

URL ASTA: ${url.trim()}
${notes.trim() ? `\nNOTE AGGIUNTIVE DEL COMMITTENTE: ${notes.trim()}` : ""}

Segui il processo: 1) leggi tutto il contenuto della pagina, 2) cerca dati di mercato comparabili, 3) produci il report completo nel formato obbligatorio.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      });

      const data = await response.json();
      stopLoadingMessages();

      if (data.error) {
        setError("Errore API: " + data.error.message);
        setLoading(false);
        return;
      }

      const text = data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      setReport(text);
    } catch (err) {
      stopLoadingMessages();
      setError("Errore di connessione. Riprova.");
    }
    setLoading(false);
  };

  const copyReport = () => {
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const renderReport = (text) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("# ")) return <h1 key={i} style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4, marginTop: 8 }}>{line.slice(2)}</h1>;
      if (line.startsWith("## ")) return <h2 key={i} style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)", marginTop: 20, marginBottom: 6, paddingBottom: 4, borderBottom: "0.5px solid var(--color-border-tertiary)" }}>{line.slice(3)}</h2>;
      if (line.startsWith("**") && line.endsWith("**")) return <p key={i} style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", margin: "8px 0", padding: "10px 14px", background: "var(--color-background-secondary)", borderRadius: 8 }}>{line.slice(2, -2)}</p>;
      if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**")) return <p key={i} style={{ fontSize: 11, color: "var(--color-text-tertiary)", fontStyle: "italic", margin: "4px 0" }}>{line.slice(1, -1)}</p>;
      if (line.startsWith("---")) return <hr key={i} style={{ border: "none", borderTop: "0.5px solid var(--color-border-tertiary)", margin: "12px 0" }} />;
      if (line.startsWith("|")) {
        const cells = line.split("|").filter((c) => c.trim());
        const isHeader = lines[i + 1]?.includes("---");
        const isSep = line.includes("---");
        if (isSep) return null;
        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: `2fr 1fr 1fr 1fr`, gap: 0, borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
            {cells.map((cell, j) => (
              <div key={j} style={{ padding: "6px 8px", fontSize: 12, fontWeight: isHeader ? 500 : 400, color: isHeader ? "var(--color-text-primary)" : "var(--color-text-secondary)", background: isHeader ? "var(--color-background-secondary)" : "transparent" }}>
                {cell.trim()}
              </div>
            ))}
          </div>
        );
      }
      if (line.startsWith("- ") || line.startsWith("• ")) return <div key={i} style={{ display: "flex", gap: 8, margin: "3px 0" }}><span style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}>·</span><span style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{line.slice(2)}</span></div>;
      if (line.trim() === "") return <div key={i} style={{ height: 6 }} />;
      return <p key={i} style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.7, margin: "2px 0" }}>{line}</p>;
    });
  };

  return (
    <div style={{ padding: "1.5rem 0", fontFamily: "var(--font-sans)" }}>

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", border: "0.5px solid var(--color-border-tertiary)" }}>
            <i className="ti ti-building-estate" style={{ fontSize: 16, color: "var(--color-text-secondary)" }} aria-hidden="true" />
          </div>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>External Opinion</span>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-tertiary)" }}>AI-powered · human-verified</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>Incolla il link dell'asta. Il sistema analizza tutto e produce il documento di consulenza completo.</p>
      </div>

      {/* Input area */}
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.25rem", marginBottom: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>
          <i className="ti ti-link" style={{ fontSize: 14, verticalAlign: -2, marginRight: 5 }} aria-hidden="true" />
          URL asta immobiliare
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.astegiudiziarie.it/immobile/... oppure tribunale, portali aste..."
          style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontFamily: "var(--font-sans)" }}
          onKeyDown={(e) => e.key === "Enter" && !loading && analyze()}
          disabled={loading}
        />
      </div>

      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.25rem", marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>
          <i className="ti ti-notes" style={{ fontSize: 14, verticalAlign: -2, marginRight: 5 }} aria-hidden="true" />
          Note aggiuntive <span style={{ fontWeight: 400, color: "var(--color-text-tertiary)" }}>(facoltativo)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Es: interessato principalmente per investimento, budget max €200k incluse spese, zona prioritaria..."
          rows={2}
          style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", resize: "none" }}
          disabled={loading}
        />
      </div>

      <button
        onClick={analyze}
        disabled={loading || !url.trim()}
        style={{ width: "100%", padding: "10px 0", fontSize: 14, fontWeight: 500, cursor: loading || !url.trim() ? "not-allowed" : "pointer", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", background: loading || !url.trim() ? "var(--color-background-secondary)" : "var(--color-background-primary)", color: loading || !url.trim() ? "var(--color-text-tertiary)" : "var(--color-text-primary)", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        {loading ? (
          <>
            <i className="ti ti-loader" style={{ fontSize: 16, animation: "spin 1s linear infinite" }} aria-hidden="true" />
            {loadingMsg}
          </>
        ) : (
          <>
            <i className="ti ti-search" style={{ fontSize: 16 }} aria-hidden="true" />
            Analizza e genera report
          </>
        )}
      </button>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Error */}
      {error && (
        <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--color-background-danger)", border: "0.5px solid var(--color-border-danger)", borderRadius: "var(--border-radius-md)", fontSize: 13, color: "var(--color-text-danger)" }}>
          <i className="ti ti-alert-circle" style={{ marginRight: 6 }} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Report output */}
      {report && (
        <div style={{ marginTop: 20 }} ref={reportRef}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Documento di consulenza</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={copyReport} style={{ fontSize: 12, padding: "4px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", background: "var(--color-background-primary)", color: "var(--color-text-secondary)", cursor: "pointer", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", gap: 5 }}>
                <i className={`ti ti-${copied ? "check" : "copy"}`} style={{ fontSize: 13 }} aria-hidden="true" />
                {copied ? "Copiato" : "Copia testo"}
              </button>
            </div>
          </div>

          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.25rem 1.5rem" }}>
            {renderReport(report)}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => { setUrl(""); setNotes(""); setReport(""); setError(""); }}
              style={{ fontSize: 12, padding: "6px 14px", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", background: "var(--color-background-primary)", color: "var(--color-text-secondary)", cursor: "pointer", fontFamily: "var(--font-sans)" }}
            >
              <i className="ti ti-refresh" style={{ fontSize: 13, marginRight: 5 }} aria-hidden="true" />
              Nuova analisi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
