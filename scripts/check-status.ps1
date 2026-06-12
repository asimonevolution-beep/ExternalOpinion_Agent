#!/usr/bin/env pwsh
# check-status.ps1 — stato deploy Railway + ultime 20 righe log
# Dipendenze: RAILWAY_TOKEN (env) oppure railway CLI autenticato

$PROJECT_ID  = "885dcc5f-5be1-4294-b5f6-b0dbf2d31a98"
$SERVICE_ID  = "d734ac38-3e22-4a19-af58-e4ffd8cfc6da"
$ENV_ID      = "b270c571-d215-4e50-941a-51af3a613316"

# --- Risolvi token: env var oppure CLI
$token = $env:RAILWAY_TOKEN
if (-not $token) {
    $token = (railway whoami --json 2>$null | ConvertFrom-Json).token
}
if (-not $token) { Write-Error "RAILWAY_TOKEN non trovato"; exit 1 }

$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
$gqlUrl  = "https://backboard.railway.com/graphql/v2"

# --- Ultimo deploy
$q = @{
    query = 'query($sid:String!,$eid:String!){deployments(input:{serviceId:$sid,environmentId:$eid},first:1){edges{node{id status createdAt meta{commitHash}}}}}'
    variables = @{ sid = $SERVICE_ID; eid = $ENV_ID }
} | ConvertTo-Json -Compress
$r = Invoke-RestMethod -Uri $gqlUrl -Method POST -Headers $headers -Body $q
$dep = $r.data.deployments.edges[0].node
Write-Output "=== DEPLOY STATUS ==="
Write-Output "  ID:     $($dep.id)"
Write-Output "  Status: $($dep.status)"
Write-Output "  At:     $($dep.createdAt)"
Write-Output "  Commit: $($dep.meta.commitHash.Substring(0,8))"
Write-Output ""

# --- Ultime 20 righe log via CLI (path piu' semplice)
Write-Output "=== ULTIMI 20 LOG ==="
railway logs --service ExternalOpinion_Agent --lines 20 2>&1
