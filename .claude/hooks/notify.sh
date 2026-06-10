#!/usr/bin/env bash
# Notification/Stop hook -> ping ntfy. Mai bloccante.
set -uo pipefail
NTFY="https://ntfy.sh/eo-dev-83562128"
case "${1:-}" in
  attesa) T="Claude ti aspetta"; M="Serve la tua attenzione in sessione."; TAG="bell";             P=4 ;;
  fine)   T="Sessione conclusa";  M="Claude ha terminato il giro di lavoro."; TAG="white_check_mark"; P=3 ;;
  *)      T="External Opinion";   M="${1:-notifica}";                          TAG="robot";            P=3 ;;
esac
curl -s "$NTFY" -H "Title: $T" -H "Priority: $P" -H "Tags: $TAG" -d "$M" >/dev/null || true
exit 0
