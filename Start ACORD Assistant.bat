@echo off
rem Starts the ACORD Assistant on this PC (in the background, no window) and opens the live LAVA app.
wscript "%~dp0scripts\start-assistant-hidden.vbs"
timeout /t 4 /nobreak >nul
start "" https://lava-acord-training.vercel.app/admin
