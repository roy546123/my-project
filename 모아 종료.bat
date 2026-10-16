@echo off
setlocal
title Moa Stop
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-start.ps1" -Action stop
if errorlevel 1 pause
endlocal
