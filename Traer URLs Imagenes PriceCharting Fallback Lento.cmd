@echo off
cd /d "%~dp0"
echo Verificando API local en http://localhost:4000...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Method Get -Uri 'http://localhost:4000/health' -TimeoutSec 5 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo.
  echo La API local no esta respondiendo.
  echo Primero abri "Abrir UltimoTurno Piloto Real.cmd" y espera a que diga que API y Web estan listas.
  echo Despues volve a abrir este archivo.
  echo.
  pause
  exit /b 1
)
echo API OK. Iniciando fallback lento y estable por PriceCharting HTML...
npx tsx tools\pricecharting-image-worker.ts --save=url --source=pricecharting-url --batch=200 --concurrency=1 --delay-ms=1100 --sleep-ms=0 --loop
pause
