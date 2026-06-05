@echo off
echo.
echo  ╔══════════════════════════════════════╗
echo  ║   External Opinion — Deploy Netlify  ║
echo  ╚══════════════════════════════════════╝
echo.
echo  Passo 1/2: Login Netlify (si apre il browser — clicca Authorize)
echo.
npx --yes netlify-cli login
echo.
echo  Passo 2/2: Deploy su externalopinion.netlify.app ...
echo.
npx netlify-cli deploy --dir=public --prod --site=externalopinion
echo.
echo  ✓ Deploy completato!
pause
