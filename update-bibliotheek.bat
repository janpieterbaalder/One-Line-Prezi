@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   One Line - bibliotheek opnieuw opbouwen
echo ================================================
echo.
echo Scant de map assets\svglibrary\ en bouwt de
echo ingebouwde bibliotheek opnieuw op.
echo.
node "tools\build-svglibrary.js"
echo.
if errorlevel 1 (
  echo [FOUT] Opbouwen mislukt.
  echo        Is Node.js geinstalleerd en staat het in PATH?
) else (
  echo Klaar. Herstart of herlaad de app om de
  echo nieuwe bibliotheek te laden.
)
echo.
pause
