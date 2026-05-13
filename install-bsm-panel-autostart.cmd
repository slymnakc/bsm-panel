@echo off
setlocal

cd /d "%~dp0"

schtasks /Create /TN "BSM Panel Server Watchdog" /TR "wscript.exe \"%~dp0start-bsm-panel-watchdog.vbs\"" /SC ONLOGON /RL LIMITED /F
if not "%ERRORLEVEL%"=="0" (
  echo Task Scheduler autostart could not be created. Trying user Startup folder fallback...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$startup = [Environment]::GetFolderPath([Environment+SpecialFolder]::Startup); $startupFile = Join-Path $startup 'BSM Panel Server Watchdog.cmd'; $target = '%~dp0start-bsm-panel-watchdog.vbs'; Set-Content -LiteralPath $startupFile -Value @('@echo off', ('wscript.exe \"' + $target + '\"')) -Encoding ASCII"
  if not "%ERRORLEVEL%"=="0" (
    echo Startup fallback could not be created.
    exit /b 1
  )
  wscript.exe "%~dp0start-bsm-panel-watchdog.vbs"
  echo BSM Panel autostart installed via Startup folder.
  echo The panel will be available at http://127.0.0.1:3000/
  exit /b 0
)

schtasks /Run /TN "BSM Panel Server Watchdog"
echo BSM Panel autostart installed. The panel will be available at http://127.0.0.1:3000/
exit /b 0
