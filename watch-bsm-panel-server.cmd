@echo off
setlocal

cd /d "%~dp0"
echo BSM Panel watchdog started. Keep this task running to protect localhost:3000.

:loop
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/health -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if not "%ERRORLEVEL%"=="0" (
  echo [%DATE% %TIME%] BSM Panel server is down. Restarting...
  start "BSM Panel Server" /MIN node server.js
)

timeout /t 60 /nobreak >nul
goto loop
