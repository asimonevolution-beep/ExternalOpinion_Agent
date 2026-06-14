#!/usr/bin/env bash
# PreToolUse(Write|Edit) — protezione asset canonici.
# Comandamento 1: l'asset canonico ESISTENTE non si tocca.
#   - target dentro assets/canonical/ E file già esistente  -> BLOCCA (exit 2)
#   - nuova creazione dentro assets/canonical/ (file assente) -> permetti
#   - target fuori da assets/canonical/                       -> permetti
set -uo pipefail

input=$(cat)

# path target dello strumento (Write ed Edit usano tool_input.file_path)
fp=$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""')

# nessun path -> non interferire
[ -z "$fp" ] && exit 0

# normalizza i backslash di Windows in slash per match ed esistenza
norm=${fp//\\//}

case "$norm" in
  */assets/canonical/*|assets/canonical/*)
    # blocca solo se il file ESISTE già (= modifica di un canonico)
    if [ -e "$norm" ]; then
      echo "BLOCCATO: asset canonico esistente, modifica vietata. Comandamento 1." >&2
      exit 2
    fi
    ;;
esac

exit 0
