@echo off
rem Runs the ACORD Assistant bridge (scripts\assistant-bridge.mjs). Exits by itself if it is already running.
cd /d "%~dp0.."
node scripts\assistant-bridge.mjs >> "%TEMP%\acord-assistant-bridge.log" 2>&1
