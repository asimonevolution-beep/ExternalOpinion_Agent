"""
L2 SENSOR — Google Alerts RSS
External Opinion / CASCADE
2026-06-09

Input:  GOOGLE_ALERTS_RSS_URL (env var) — RSS feed Google Alerts
Output: STATION/output/l2_signals.json

Livelli:
  L2_HIGH   urgency_score >= 60  — segnale qualificato, entra in pipeline
  L2_MEDIUM urgency_score >= 30  — segnale da monitorare
  L1_LOW    urgency_score <  30  — rumore di fondo
"""

import os
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import feedparser
from dotenv import load_dotenv

load_dotenv()

# ── Configurazione ─────────────────────────────────────────────────────────────

RSS_URL = os.getenv("GOOGLE_ALERTS_RSS_URL", "")

OUTPUT_DIR = Path(__file__).parent.parent / "output"
OUTPUT_FILE = OUTPUT_DIR / "l2_signals.json"

KEYWORDS = {
    "aste": [
        "asta", "aste", "aggiudicazione", "offerta minima",
        "tribunale", "pignoramento", "vendita giudiziaria",
        "pvp", "esecuzione immobiliare",
    ],
    "immobili": [
        "immobile", "immobili", "casa", "appartamento", "edificio",
        "catasto", "perizia", "geometra", "rogito", "preliminare",
        "difformità catastale", "abuso edilizio",
    ],
    "rischio": [
        "costi nascosti", "ipoteca", "irregolarità", "difformità",
        "abuso", "vincolo", "oneri condominiali", "truffa immobiliare",
        "prima di firmare", "rischio acquisto",
    ],
    "opportunità": [
        "sotto prezzo", "occasione", "affare", "svendita",
        "prezzo ribassato", "vendita urgente", "trattative riservate",
    ],
    "economico": [
        "acquisto casa", "investimento immobiliare", "mercato immobiliare",
        "valutazione indipendente", "diagnostica immobiliare",
        "ispezione immobile", "cosa controllare",
    ],
}

# pesi per categoria (somma per calcolare score)
WEIGHTS = {
    "aste":       35,
    "rischio":    30,
    "immobili":   20,
    "opportunità": 25,
    "economico":  15,
}

# ── Scoring ────────────────────────────────────────────────────────────────────

def score_text(text: str) -> tuple[int, list[str]]:
    text_lower = text.lower()
    score = 0
    matched = []

    for category, keywords in KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                score += WEIGHTS[category]
                if category not in matched:
                    matched.append(category)
                break  # un match per categoria è sufficiente

    return min(score, 100), matched


def classify_level(score: int) -> str:
    if score >= 60:
        return "L2_HIGH"
    elif score >= 30:
        return "L2_MEDIUM"
    else:
        return "L1_LOW"


# ── Parser feed ────────────────────────────────────────────────────────────────

def parse_feed(url: str) -> list[dict]:
    feed = feedparser.parse(url)
    signals = []

    for entry in feed.entries:
        title   = getattr(entry, "title",   "")
        link    = getattr(entry, "link",    "")
        summary = getattr(entry, "summary", "")
        published = getattr(entry, "published", datetime.now(timezone.utc).isoformat())

        score, categories = score_text(f"{title} {summary}")
        level = classify_level(score)

        signals.append({
            "title":          title,
            "link":           link,
            "summary":        summary[:300],
            "published":      published,
            "urgency_score":  score,
            "categories":     categories,
            "level":          level,
            "source":         url,
            "processed_at":   datetime.now(timezone.utc).isoformat(),
        })

    return signals


# ── Mock feed (usato quando RSS_URL è assente) ─────────────────────────────────

MOCK_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Google Alerts — MOCK</title>
    <item>
      <title>Asta giudiziaria immobile via Roma 45 — Tribunale di Milano</title>
      <link>https://pvp.giustizia.it/mock/1</link>
      <description>Immobile pignorato in asta giudiziaria. Offerta minima €180.000. Presenza ipoteca. Aggiudicazione prevista entro 30 giorni.</description>
      <pubDate>Mon, 09 Jun 2026 08:00:00 +0000</pubDate>
    </item>
    <item>
      <title>Acquisto casa: cosa controllare prima del rogito</title>
      <link>https://forum.immobiliare.it/mock/2</link>
      <description>Sto per firmare il preliminare ma ho dubbi su difformità catastale. Qualcuno sa come verificare abuso edilizio prima di procedere?</description>
      <pubDate>Mon, 09 Jun 2026 09:30:00 +0000</pubDate>
    </item>
    <item>
      <title>Vendita urgente appartamento Milano — prezzo ribassato</title>
      <link>https://www.subito.it/mock/3</link>
      <description>Vendo urgentemente appartamento 80mq zona navigli. Prezzo ribassato per vendita rapida. Trattative riservate.</description>
      <pubDate>Mon, 09 Jun 2026 10:15:00 +0000</pubDate>
    </item>
    <item>
      <title>Mercato immobiliare Milano Luglio 2026</title>
      <link>https://news.example.it/mock/4</link>
      <description>Andamento del mercato immobiliare milanese nel terzo trimestre 2026.</description>
      <pubDate>Mon, 09 Jun 2026 07:00:00 +0000</pubDate>
    </item>
    <item>
      <title>Offerta lavoro — segreteria studio legale</title>
      <link>https://lavoro.example.it/mock/5</link>
      <description>Studio legale cerca segretaria part-time con esperienza. Inviare CV.</description>
      <pubDate>Mon, 09 Jun 2026 06:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>"""


def parse_mock_feed() -> list[dict]:
    feed = feedparser.parse(MOCK_RSS)
    signals = []

    for entry in feed.entries:
        title   = getattr(entry, "title",   "")
        link    = getattr(entry, "link",    "")
        summary = getattr(entry, "summary", "")
        published = getattr(entry, "published", datetime.now(timezone.utc).isoformat())

        score, categories = score_text(f"{title} {summary}")
        level = classify_level(score)

        signals.append({
            "title":          title,
            "link":           link,
            "summary":        summary[:300],
            "published":      published,
            "urgency_score":  score,
            "categories":     categories,
            "level":          level,
            "source":         "MOCK_FEED",
            "processed_at":   datetime.now(timezone.utc).isoformat(),
        })

    return signals


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if RSS_URL:
        print(f"[L2] Lettura feed RSS: {RSS_URL}")
        signals = parse_feed(RSS_URL)
        source_type = "LIVE"
    else:
        print("[L2] GOOGLE_ALERTS_RSS_URL non trovata — uso MOCK_FEED")
        signals = parse_mock_feed()
        source_type = "MOCK"

    # filtro e statistiche
    high   = [s for s in signals if s["level"] == "L2_HIGH"]
    medium = [s for s in signals if s["level"] == "L2_MEDIUM"]
    low    = [s for s in signals if s["level"] == "L1_LOW"]

    output = {
        "run_at":      datetime.now(timezone.utc).isoformat(),
        "source_type": source_type,
        "feed_url":    RSS_URL or "MOCK",
        "stats": {
            "total":    len(signals),
            "L2_HIGH":  len(high),
            "L2_MEDIUM": len(medium),
            "L1_LOW":   len(low),
        },
        "signals": signals,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"[L2] Output salvato: {OUTPUT_FILE}")
    print(f"[L2] Totale segnali: {len(signals)}")
    print(f"[L2] L2_HIGH:        {len(high)}")
    print(f"[L2] L2_MEDIUM:      {len(medium)}")
    print(f"[L2] L1_LOW:         {len(low)}")

    if high:
        print("\n[L2] Segnali L2_HIGH:")
        for s in high:
            print(f"     [{s['urgency_score']:3d}] {s['title'][:80]}")

    # Gate: se 0 segnali HIGH → segnala blocco
    if not high and not medium:
        print("\n[L2] BLOCCO: nessun segnale qualificato rilevato in questo run.")
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
