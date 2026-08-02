#!/usr/bin/env pwsh
# check-email.ps1 — stato verifica dominio Resend per externalopinion.it
# Dipendenze: RESEND_API_KEY impostata nell'ambiente

$RESEND_KEY = $env:RESEND_API_KEY
if ([string]::IsNullOrWhiteSpace($RESEND_KEY)) {
    throw "RESEND_API_KEY non configurata. Impostala nell'ambiente prima di eseguire questo script."
}
$DOMAIN_ID  = "ae4f3fcc-cc14-441b-8a05-829dd900321f"

$headers = @{ "Authorization" = "Bearer $RESEND_KEY" }
$d = Invoke-RestMethod -Uri "https://api.resend.com/domains/$DOMAIN_ID" -Method GET -Headers $headers

Write-Output "=== RESEND DOMAIN STATUS ==="
Write-Output "  Dominio: $($d.name)"
Write-Output "  Status:  $($d.status)"
Write-Output "  Regione: $($d.region)"
Write-Output ""
Write-Output "=== RECORD DNS ==="
foreach ($rec in $d.records) {
    $icon = if ($rec.status -eq "verified") { "[OK]" } elseif ($rec.status -eq "pending") { "[..] " } else { "[!!]" }
    Write-Output "  $icon $($rec.record_type) $($rec.name): $($rec.status)"
}
