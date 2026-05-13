@echo off
setlocal

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/health -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if "%ERRORLEVEL%"=="0" (
  echo BSM Panel server already running: http://127.0.0.1:3000/
  exit /b 0
)

echo Starting BSM Panel server on http://127.0.0.1:3000/
start "BSM Panel Server" /MIN node server.js
exit /b 0
