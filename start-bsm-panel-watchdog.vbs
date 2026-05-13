Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
basePath = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run """" & basePath & "\watch-bsm-panel-server.cmd" & """", 0, False
