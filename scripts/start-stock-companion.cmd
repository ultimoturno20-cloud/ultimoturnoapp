@echo off
setlocal
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo Necesitas Node.js 22 para abrir el programa.
  pause
  exit /b 1
)
if not exist "node_modules\csv-parse" (
  echo Faltan dependencias. Ejecuta npm ci en esta carpeta y volve a abrir el programa.
  pause
  exit /b 1
)
echo Abriendo UltimoTurno - Carga de cartas...
echo Entra a http://127.0.0.1:4318 cuando aparezca la direccion.
echo Conserva esta ventana abierta. Ctrl+C para cerrar.
node tools\stock-companion\server.mjs
pause
