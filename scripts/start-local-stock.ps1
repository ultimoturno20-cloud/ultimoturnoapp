$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stateDir = Join-Path $projectRoot '.work\stock-offline'
if (-not (Test-Path -LiteralPath (Join-Path $stateDir 'import-report.json'))) { throw 'Importar primero con tools/import-local-stock.mts.' }
foreach ($portNumber in @(4010,5174)) {
    if (Get-NetTCPConnection -LocalPort $portNumber -State Listen -ErrorAction SilentlyContinue) { throw "Puerto $portNumber ocupado. No se detuvo ningun proceso." }
}
$env:ULTIMOTURNO_ENV = 'local'
$env:ULTIMOTURNO_DB_DRIVER = 'pglite'
$env:PGLITE_DATA_DIR = Join-Path $projectRoot '.data\stock-offline'
$env:ULTIMOTURNO_DATA_PROFILE = 'COPIA LOCAL - PRUEBAS'
$env:ULTIMOTURNO_ALLOW_EXAMPLES = 'false'
$env:ULTIMOTURNO_ALLOWED_ORIGINS = 'http://127.0.0.1:5174,http://localhost:5174'
$env:ULTIMOTURNO_ACCESS_KEY = ''
$env:DATABASE_URL = ''
$env:POSTGRES_URL = ''
$env:POSTGRES_PRISMA_URL = ''
$env:POSTGRES_URL_NON_POOLING = ''
$env:PRICECHARTING_TOKEN = ''
$env:PRICECHARTING_AUTO_REFRESH_ENABLED = 'false'
$env:TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED = 'true'
$env:TCGPLAYER_PRICE_AUTO_REFRESH_TIME = '06:30'
$env:API_HOST = '127.0.0.1'
$env:API_PORT = '4010'
$env:ADMIN_WEB_PORT = '5174'
$env:ULTIMOTURNO_API_PROXY_TARGET = 'http://127.0.0.1:4010'
$env:VITE_API_BASE_URL = '/api'
$nodePath = (Get-Command node.exe).Source
$api = Start-Process -FilePath $nodePath -ArgumentList @('--import','tsx','apps/api/src/server.ts') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateDir 'api.log') -RedirectStandardError (Join-Path $stateDir 'api-error.log') -PassThru
$web = Start-Process -FilePath $nodePath -ArgumentList @('node_modules/vite/bin/vite.js','apps/admin-web','--config','apps/admin-web/vite.config.mjs','--configLoader','native','--host','127.0.0.1','--port','5174','--strictPort') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateDir 'web.log') -RedirectStandardError (Join-Path $stateDir 'web-error.log') -PassThru
@{ apiPid=$api.Id;webPid=$web.Id;url='http://127.0.0.1:5174/inventario' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stateDir 'processes.json')
Write-Output 'App local: http://127.0.0.1:5174/inventario'
