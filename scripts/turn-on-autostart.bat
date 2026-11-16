@echo off
rem Double-click to make the ACORD Assistant start automatically (hidden) every time you sign in to Windows.
rem To turn it off again: press Win+R, type shell:startup, and delete "LAVA ACORD Assistant.vbs".
set "TARGET=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\LAVA ACORD Assistant.vbs"
> "%TARGET%" echo ' LAVA ACORD Assistant: starts the Claude Code bridge in the background when you sign in. Delete this file to stop it.
>> "%TARGET%" echo CreateObject("WScript.Shell").Run "wscript ""%~dp0start-assistant-hidden.vbs""", 0, False
echo The ACORD Assistant will now start automatically when you sign in to Windows.
echo To turn this off: press Win+R, type shell:startup, and delete "LAVA ACORD Assistant.vbs".
wscript "%~dp0start-assistant-hidden.vbs"
pause
