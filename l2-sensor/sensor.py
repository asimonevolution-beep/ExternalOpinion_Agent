"""
L2 SENSOR — Google Alerts RSS — External Opinion / CASCADE
Worker continuo: esegue scan ogni SCAN_INTERVAL_MINUTES (default 60).
Output: stdout JSON + /app/output/l2_signals.json
"""

import os
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import feedparser
from dotenv import load_dotenv

load_dotenv()

RSS_URL             = os.getenv("GOOGLE_ALERTS_RSS_URL", "")
SCAN_INTERVAL_MIN   = int(os.getenv("SCAN_INTERVAL_MINUTES", "60"))
OUTPUT_DIR          = Path("/app/output")
OUTPUT_FILE         = OUTPUT_DIR / "l2_signals.json"

KEYWORDS = {
    "aste":       ["asta", "aste", "aggiudicazione", "offerta minima", "pignoramento",
                   "vendita giudiziaria", "pvp", "esecuzione immobiliare", "tribunale"],
    "immobili":   ["immobile", "immobili", "casa", "appartamento", "catasto", "perizia",
                   "geometra", "rogito", "preliminare", "difformità catastale", "abuso edilizio"],
    "rischio":    ["costi nascosti", "ipoteca", "irregolarità", "difformità", "abuso",
                   "oneri condominiali", "truffa immobiliare", "prima di firmare"],
    "opportunità":["sotto prezzo", "occasione", "affare", "svendita",
                   "prezzo ribassato", "vendita urgente"],
    "economico":  ["acquisto casa", "investimento immobiliare", "mercato immobiliare",
                   "valutazione indipendente", "diagnostica immobiliare", "cosa controllare"],
}

WEIGHTS = {"aste": 35, "rischio": 30, "immobili": 20, "opportunità": 25, "economico": 15}

MOCK_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>MOCK</title>
<item><title>Asta giudiziaria immobile via Roma 45 — Tribunale Milano</title>
<link>https://pvp.giustizia.it/mock/1</link>
<description>Immobile pignorato. Offerta minima €180.000. Ipoteca presente. Aggiudicazione 30gg.</description>
<pubDate>Mon, 09 Jun 2026 08:00:00 +0000</pubDate></item>
<item><title>Acquisto casa: difformità catastale prima del rogito</title>
<link>https://forum.immobiliare.it/mock/2</link>
<description>Sto per firmare il preliminare ma ho dubbi su abuso edilizio. Come verificare?</description>
<pubDate>Mon, 09 Jun 2026 09:30:00 +0000</pubDate></item>
<item><title>Vendita urgente appartamento Milano — prezzo ribassato</title>
<link>https://www.subito.it/mock/3</link>
<description>Vendo urgentemente 80mq navigli. Prezzo ribassato. Trattative riservate.</description>
<pubDate>Mon, 09 Jun 2026 10:15:00 +0000</pubDate></item>
<item><title>Mercato immobiliare Milano trend 2026</title>
<link>https://news.example.it/mock/4</link>
<description>Andamento mercato immobiliare terzo trimestre 2026.</description>
<pubDate>Mon, 09 Jun 2026 07:00:00 +0000</pubDate></item>
<item><title>Offerta lavoro segreteria</title>
<link>https://lavoro.example.it/mock/5</link>
<description>Studio legale cerca segretaria part-time.</description>
<pubDate>Mon, 09 Jun 2026 06:00:00 +0000</pubDate></item>
</channel></rss>"""


def score_text(text: str) -> tuple[int, list[str]]:
    tl = text.lower()
    score, matched = 0, []
    for cat, kws in KEYWORDS.items():
        for kw in kws:
            if kw in tl:
                score += WEIGHTS[cat]
                if cat not in matched:
                    matched.append(cat)
                break
    return min(score, 100), matched


def classify(score: int) -> str:
    if score >= 60: return "L2_HIGH"
    if score >= 30: return "L2_MEDIUM"
    return "L1_LOW"


def parse(url: str, mock: bool = False) -> list[dict]:
    feed = feedparser.parse(MOCK_RSS if mock else url)
    out = []
    for e in feed.entries:
        title   = getattr(e, "title",   "")
        link    = getattr(e, "link",    "")
        summary = getattr(e, "summary", "")
        pub     = getattr(e, "published", datetime.now(timezone.utc).isoformat())
        score, cats = score_text(f"{title} {summary}")
        out.append({
            "title":         title,
            "link":          link,
            "summary":       summary[:300],
            "published":     pub,
            "urgency_score": score,
            "categories":    cats,
            "level":         classify(score),
            "source":        "MOCK" if mock else url,
            "processed_at":  datetime.now(timezone.utc).isoformat(),
        })
    return out


def run_scan() -> dict:
    mock = not bool(RSS_URL)
    if mock:
        print("[L2] GOOGLE_ALERTS_RSS_URL non trovata — MOCK_FEED attivo", flush=True)
    else:
        print(f"[L2] Feed: {RSS_URL}", flush=True)

    signals = parse(RSS_URL, mock=mock)
    high   = [s for s in signals if s["level"] == "L2_HIGH"]
    medium = [s for s in signals if s["level"] == "L2_MEDIUM"]
    low    = [s for s in signals if s["level"] == "L1_LOW"]

    result = {
        "run_at":      datetime.now(timezone.utc).isoformat(),
        "source_type": "MOCK" if mock else "LIVE",
        "feed_url":    RSS_URL or "MOCK",
        "stats":       {"total": len(signals), "L2_HIGH": len(high),
                        "L2_MEDIUM": len(medium), "L1_LOW": len(low)},
        "signals":     signals,
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"[L2] Segnali totali: {len(signals)} | HIGH: {len(high)} | MEDIUM: {len(medium)} | LOW: {len(low)}", flush=True)
    for s in high:
        print(f"[L2] HIGH [{s['urgency_score']:3d}] {s['title'][:80]}", flush=True)

    if not high and not medium:
        print("[L2] GATE: nessun segnale qualificato — BLOCCO", flush=True)

    return result


def main():
    print(f"[L2] Worker avviato — scan ogni {SCAN_INTERVAL_MIN} minuti", flush=True)
    while True:
        try:
            run_scan()
        except Exception as e:
            print(f"[L2] ERRORE: {e}", flush=True)
        print(f"[L2] Prossimo scan tra {SCAN_INTERVAL_MIN} minuti", flush=True)
        time.sleep(SCAN_INTERVAL_MIN * 60)


if __name__ == "__main__":
    main()
