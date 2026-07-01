# ============================================================
# EXTERNAL OPINION — PATCH quick-intake.html (v1)
# Fix pagamento Stripe LIVE 10 EUR + PWA + impatto mobile
# Esegui dalla cartella del sito (dove sta quick-intake.html):
#   powershell -ExecutionPolicy Bypass -File .\patch-quick-intake.ps1
# ============================================================

$ErrorActionPreference = 'Stop'
$file = Join-Path (Get-Location) 'quick-intake.html'
if (-not (Test-Path $file)) { Write-Host 'ERRORE: quick-intake.html non trovato in questa cartella' -ForegroundColor Red; exit 1 }

# Backup
Copy-Item $file "$file.bak" -Force
$html = Get-Content $file -Raw

# Idempotenza: se gia' patchato, esci
if ($html -match 'eo-headline') { Write-Host 'GIA'' PATCHATO: nessuna modifica necessaria' -ForegroundColor Yellow; exit 0 }

# ---------- 1. HEAD: manifest PWA + theme color + icona + CSS mobile ----------
$anchorHead = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />'
$headAdd = @'
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#0a0a0e" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<style>
#eo-headline{width:100%;max-width:940px;text-align:center;margin:2px 0 14px}
#eo-headline .h{font-weight:700;font-size:clamp(15px,4.4vw,22px);letter-spacing:.06em;color:var(--gold-bright)}
#eo-headline .p{display:inline-block;margin-top:8px;padding:5px 14px;border:1px solid var(--line);border-radius:999px;font-size:12.5px;color:var(--ink);background:rgba(246,224,140,.06)}
#eo-headline .p strong{color:var(--gold-bright)}
@media (max-width:560px){
  .row{position:sticky;bottom:0;background:var(--bg-0);padding:10px 0;z-index:50}
  .confirm-actions{position:sticky;bottom:0;background:var(--bg-0);padding:10px 0;z-index:50}
}
</style>
'@
if (-not $html.Contains($anchorHead)) { Write-Host 'ERRORE: anchor HEAD non trovato' -ForegroundColor Red; exit 1 }
$html = $html.Replace($anchorHead, $headAdd)

# ---------- 2. HEADLINE + BADGE PREZZO subito dopo la nav ----------
$headline = @'
</nav>

<div id="eo-headline">
  <div class="h">PRIMA DI MUOVERE SOLDI, GUARDA COSA RISCHI</div>
  <div class="p">Screening <strong>&#8364;10</strong> &#8212; verdetto in 24-48h</div>
</div>
'@
$html = $html.Replace('</nav>', $headline)

# ---------- 3. FIX BOTTONE PAGAMENTO: Payment Link LIVE ----------
$anchorPay = 'id="checkout-btn" href="#"'
if (-not $html.Contains($anchorPay)) { Write-Host 'ATTENZIONE: anchor checkout href="#" non trovato (forse gia'' impostato da JS)' -ForegroundColor Yellow }
$html = $html.Replace($anchorPay, 'id="checkout-btn" href="https://buy.stripe.com/6oUeV54fFbZ16jdfJ9ffy06"')

# ---------- 4. SW + client_reference_id sul pagamento ----------
$anchorBody = '</body>'
$bodyAdd = @'
<script>
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }
(function () {
  var STRIPE = 'https://buy.stripe.com/6oUeV54fFbZ16jdfJ9ffy06';
  var btn = document.getElementById('checkout-btn');
  if (btn) {
    btn.setAttribute('href', STRIPE);
    btn.addEventListener('click', function () {
      var el = document.getElementById('display-case-id');
      var code = el ? el.textContent.trim() : '';
      if (code && code !== 'EO---------') {
        this.href = STRIPE + '?client_reference_id=' + encodeURIComponent(code);
      }
    });
  }
})();
</script>
</body>
'@
$html = $html.Replace($anchorBody, $bodyAdd)

Set-Content -Path $file -Value $html -Encoding UTF8
Write-Host ''
Write-Host 'PATCH APPLICATO. Backup salvato in quick-intake.html.bak' -ForegroundColor Green
Write-Host 'Ora copia nella stessa cartella: manifest.json, sw.js e la cartella icons\ dal pacchetto eo-pwa-pack.zip' -ForegroundColor Cyan
