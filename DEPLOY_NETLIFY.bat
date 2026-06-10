@echo off
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   External Opinion — Deploy Netlify          ║
echo  ║   Richiede: NETLIFY_AUTH_TOKEN impostato     ║
echo  ╚══════════════════════════════════════════════╝
echo.

REM ── Se il token è già nell'ambiente, salta il prompt ──
IF "%NETLIFY_AUTH_TOKEN%"=="" (
  echo  TOKEN NON TROVATO.
  echo.
  echo  Ottieni il token su: https://app.netlify.com/user/applications
  echo  Sezione: Personal access tokens → New access token
  echo.
  set /p NETLIFY_AUTH_TOKEN="  Incolla il token e premi INVIO: "
  echo.
)

echo  Deploying public/ su externalopinion.netlify.app ...
echo.

npx --yes netlify-cli deploy ^
  --dir=public ^
  --prod ^
  --site=externalopinion ^
  --auth=%NETLIFY_AUTH_TOKEN%

echo.
echo  ✓ Se vedi "Deploy is live" sopra, il deploy è riuscito.
pause
