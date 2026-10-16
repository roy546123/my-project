@echo off
setlocal
title Moa Connection Check
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-start.ps1" -Action diagnose
pause
endlocal
