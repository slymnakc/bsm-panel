@echo off
setlocal

schtasks /Delete /TN "BSM Panel Server Watchdog" /F
powershell -NoProfile -ExecutionPolicy Bypass -Command "$startup = [Environment]::GetFolderPath([Environment+SpecialFolder]::Startup); $startupFile = Join-Path $startup 'BSM Panel Server Watchdog.cmd'; Remove-Item -LiteralPath $startupFile -Force -ErrorAction SilentlyContinue"
echo BSM Panel autostart task removed.
exit /b 0
