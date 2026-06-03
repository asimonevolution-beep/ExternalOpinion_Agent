#!/usr/bin/env bash
# Giro autonomo NON presidiato. Avanza sulla checklist, NON improvvisa, si ferma da solo.
# Termina su: CASCADE_DONE (obiettivo) | gate negato/timeout | MAX iterazioni.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
MAX="${1:-12}"
NTFY="https://ntfy.sh/eo-dev-83562128"

for i in $(seq 1 "$MAX"); do
  out=$(claude -p "Continua il piano in AGENT_STEPS.md rispettando COMMIT_CHECKLIST.md e i vincoli P0 in CLAUDE.md. \
Esegui SOLO il prossimo step non completato, committa, aggiorna la checklist. \
Niente esplorazione, niente refactor non richiesti. \
Quando tutti gli step sono completati rispondi con la sola riga: CASCADE_DONE." \
    --permission-mode acceptEdits 2>&1) || true
  printf '%s\n' "$out"
  if printf '%s' "$out" | grep -q "CASCADE_DONE"; then
    curl -s "$NTFY" -H "Title: Obiettivo raggiunto" -H "Tags: tada" -d "Checklist completata in $i giri." >/dev/null || true
    exit 0
  fi
done
curl -s "$NTFY" -H "Title: Limite giri" -H "Tags: warning" -d "Fermato dopo $MAX iterazioni. Controlla lo stato." >/dev/null || true
