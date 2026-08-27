@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-new-platform.ps1" -DataProfile "PILOTO REAL" -DataDir "apps\api\.data\ultimoturno-pilot-real" -AllowExamples 0 -ImageDir "D:\UltimoTurno\pricecharting-images"
endlocal
