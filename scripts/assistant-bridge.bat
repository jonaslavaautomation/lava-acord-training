@echo off
rem Runs the ACORD Assistant bridge (scripts\assistant-bridge.mjs) and restarts it if it ever crashes.
rem Exits quietly if it is already running (the bridge exits with code 0 in that case).
cd /d "%~dp0.."
:loop
node scripts\assistant-bridge.mjs >> "%TEMP%\acord-assistant-bridge.log" 2>&1
if %errorlevel%==0 exit /b 0
timeout /t 10 /nobreak >nul
goto loop
