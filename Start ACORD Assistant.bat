@echo off
title ACORD Assistant - keep this window open while you use it
cd /d "%~dp0"
rem If the app is already running, just open it.
powershell -NoProfile -Command "try { Invoke-WebRequest http://localhost:5173 -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel%==0 (
  start "" http://localhost:5173/admin
  exit /b
)
echo Starting the LAVA ACORD app on this PC. Your browser will open in a few seconds.
echo Keep this window open while you use the ACORD Assistant. Close it to stop.
call npm run dev -- --port 5173 --strictPort --open /admin
pause
