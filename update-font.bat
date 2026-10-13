@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   One Line - font opnieuw opbouwen
echo ================================================
echo.
echo Scant de map assets\onelinefont\ en bouwt het
echo ingesloten font (assets\onelinefont.js) en
echo manifest.json opnieuw op.
echo.
node "tools\build-onelinefont.js"
echo.
if errorlevel 1 (
  echo [FOUT] Opbouwen mislukt.
  echo        Is Node.js geinstalleerd en staat het in PATH?
) else (
  echo Klaar. Herstart of herlaad de app om het
  echo nieuwe font te laden.
)
echo.
pause
