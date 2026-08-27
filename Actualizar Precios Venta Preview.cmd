@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "scripts\update-inventory-sale-prices.ps1"
echo.
pause
