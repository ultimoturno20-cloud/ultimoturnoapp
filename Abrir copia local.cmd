@echo off
cd /d "%~dp0"
pwsh -NoProfile -File scripts\start-local-stock.ps1
if errorlevel 1 (
  pause
  exit /b 1
)
start "" http://127.0.0.1:5174/inventario
