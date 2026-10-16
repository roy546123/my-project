@echo off
setlocal
title Moa Investment
cd /d "%~dp0"
if not exist "%~dp0scripts\windows-start.ps1" (
  echo Please extract the entire ZIP first, then run this file again.
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-start.ps1"
if errorlevel 1 (
  echo.
  echo Startup failed. Please send a screenshot of this window.
  pause
)
endlocal
