@echo off
setlocal
cd /d "%~dp0"

echo UltimoTurno - Mejorar calidad de imagenes
echo.
echo Requiere que la API local este corriendo en http://localhost:4000
echo Para subir a Supabase, configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY como variables de entorno.
echo.

npm run images:quality:daemon -- --loop --upload-every=3 --sleep-ms=30000

echo.
pause
