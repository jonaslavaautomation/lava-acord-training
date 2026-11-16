' Starts the ACORD Assistant bridge in the background, with no window.
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "cmd /c """ & dir & "\assistant-bridge.bat""", 0, False
