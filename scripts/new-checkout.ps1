#!/usr/bin/env pwsh
# new-checkout.ps1 — genera sessione checkout live fresca e stampa URL
# Uso: .\new-checkout.ps1 [-Email foo@bar.com] [-Indirizzo "Via X, Citta"]

param(
    [string]$Email     = "a.simonevolution@gmail.com",
    [string]$Indirizzo = "Via Test 1, Milano",
    [string]$Telefono  = "+39 333 0000000",
    [string]$Lotto     = ""
)

$BASE_URL = "https://externalopinionagent-production-1f66.up.railway.app"

$body = @{
    indirizzo = $Indirizzo
    email     = $Email
    telefono  = $Telefono
    note      = "Sessione test generata da new-checkout.ps1"
} | ConvertTo-Json
if ($Lotto) { $body = ($body | ConvertFrom-Json); $body | Add-Member -NotePropertyName lotto -NotePropertyValue $Lotto; $body = $body | ConvertTo-Json }

$headers = @{ "Content-Type" = "application/json" }

try {
    $r = Invoke-RestMethod -Uri "$BASE_URL/aste/checkout" -Method POST -Headers $headers -Body $body
    Write-Output ""
    Write-Output "=== CHECKOUT URL (valido 24h) ==="
    Write-Output $r.checkoutUrl
    Write-Output ""
    Write-Output "  jobId:     $($r.jobId)"
    Write-Output "  sessionId: $($r.sessionId)"
} catch {
    Write-Error "Errore: $($_.Exception.Message)"
    exit 1
}
