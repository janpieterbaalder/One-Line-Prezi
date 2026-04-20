$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "One Line Presentaties.lnk"
$target  = "$env:LOCALAPPDATA\Programs\one-line-presentaties\One Line Presentaties.exe"
$icon    = "C:\Users\rogst\Desktop\Baalderborg Groep\one line prezie\one line prezi color\assets\snelkoppeling-one-line-color.ico"

if (-not (Test-Path $target)) {
    Write-Error "App niet gevonden op: $target"
    exit 1
}

$wsh = New-Object -ComObject WScript.Shell
$sc  = $wsh.CreateShortcut($lnkPath)
$sc.TargetPath   = $target
$sc.WorkingDirectory = Split-Path $target
$sc.Description  = "One Line Presentaties - retro Y2K stijl"
if (Test-Path $icon) { $sc.IconLocation = "$icon,0" }
$sc.Save()

Write-Output "Snelkoppeling aangemaakt op: $lnkPath"
Write-Output "Wijst naar: $target"
