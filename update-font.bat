@echo off
cd /d "%~dp0"
powershell -NoProfile -Command ^
  "$files = Get-ChildItem 'assets\onelinefont\*.svg' | Sort-Object Name | ForEach-Object { $_.Name }; " ^
  "$json = $files | ConvertTo-Json; " ^
  "if ($files.Count -eq 1) { $json = '[ ' + $json + ' ]' }; " ^
  "[System.IO.File]::WriteAllLines('assets\onelinefont\manifest.json', $json, [System.Text.UTF8Encoding]::new($false))"
echo manifest.json bijgewerkt met %files% bestanden.
echo.
pause
