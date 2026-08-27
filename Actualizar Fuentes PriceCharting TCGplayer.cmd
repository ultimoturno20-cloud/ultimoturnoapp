@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "scripts\sync-external-price-sources.ps1"
echo.
pause
