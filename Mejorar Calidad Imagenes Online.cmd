@echo off
setlocal
cd /d "%~dp0"

echo UltimoTurno - Mejorar calidad de imagenes online
echo.
echo Este worker queda corriendo contra la API de produccion.
echo Requiere estas variables de entorno de usuario:
echo - ULTIMOTURNO_ACCESS_KEY
echo - SUPABASE_URL
echo - SUPABASE_SERVICE_ROLE_KEY
echo - SUPABASE_STORAGE_BUCKET
echo - PRICECHARTING_IMAGE_DIR
echo.

npm run images:storage:daemon -- --loop --priority-only --api=https://ultimoturnoapp-api.vercel.app/api --sleep-ms=60000 --batch=80 --url-batch=1000 --concurrency=4

echo.
pause
