#!/usr/bin/env bash
# PreToolUse(Bash) — blocco P0 (linee di programma) + gate approvazione dal telefono.
# Decisione: deny via JSON; allow = exit 0 senza output (passa al flusso permessi normale).
set -uo pipefail

NTFY_NOTIFY="https://ntfy.sh/eo-dev-83562128"
NTFY_APPROVE="https://ntfy.sh/eo-approve-83562128"

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')

deny() {
  jq -Rn --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

# --- P0 HARD BLOCK: vietato finché non ci sono 3 vendite confermate ----
case "$cmd" in
  *puppeteer*|*bullmq*|*ingest*omi*|*OMI_INGEST*)
    deny "P0: BullMQ / Puppeteer / OMI-ingest bloccati finché non hai 3 vendite reali confermate." ;;
esac

# --- GATED: serve un tap dal telefono ---------------------------------
gated=0
case "$cmd" in
  *"git push"*|*"railway up"*|*"railway redeploy"*|*"railway deploy"*|*"prisma migrate deploy"*|*"prisma db push"*)
    gated=1 ;;
esac

if [ "$gated" -eq 1 ]; then
  token="g$(date +%s)$RANDOM"
  start=$(date +%s)
  curl -s "$NTFY_NOTIFY" -H "Content-Type: application/json" -d "$(jq -Rn --arg c "$cmd" --arg t "$token" --arg url "$NTFY_APPROVE" '{
    topic:"eo-dev-83562128",
    title:"Approvazione richiesta — External Opinion",
    message:("Claude vuole eseguire:\n" + $c),
    priority:4, tags:["warning"],
    actions:[
      {action:"http",label:"Approva",url:$url,method:"POST",body:("ok-"+$t),clear:true},
      {action:"http",label:"Nega",url:$url,method:"POST",body:("no-"+$t),clear:true}
    ]
  }')" >/dev/null || true

  deadline=$((start + 720))   # 12 min, poi deny per sicurezza
  while [ "$(date +%s)" -lt "$deadline" ]; do
    resp=$(curl -s "$NTFY_APPROVE/json?poll=1&since=$start" \
      | jq -r '.message // empty' 2>/dev/null | grep -E "(ok|no)-$token" | tail -n1 || true)
    case "$resp" in
      "ok-$token") exit 0 ;;                       # approvato -> passa
      "no-$token") deny "Negato dal telefono." ;;
    esac
    sleep 5
  done
  deny "Timeout approvazione (12 min) — bloccato."
fi

exit 0   # tutto il resto: flusso permessi normale (allow list / acceptEdits)
