[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $DatabaseUrl,
  [string] $AccessKey = "",
  [int] $ApiPort = 4010,
  [int] $WebPort = 5174,
  [switch] $Tunnel
)

$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$runStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stateDir = Join-Path $projectRoot ".work\staging-web"
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

function Stop-UltimoTurnoProjectListener {
  param([Parameter(Mandatory = $true)][int] $Port)
  $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  foreach ($listener in $listeners) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    $commandLine = [string] $process.CommandLine
    if ($commandLine.IndexOf([string] $projectRoot, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
      throw "El puerto $Port esta ocupado por otro programa. No se cerro ningun proceso."
    }
    Stop-Process -Id $listener.OwningProcess -Force
  }
}

Stop-UltimoTurnoProjectListener -Port $ApiPort
Stop-UltimoTurnoProjectListener -Port $WebPort

$env:ULTIMOTURNO_ENV = "staging"
$env:ULTIMOTURNO_DB_DRIVER = "postgres"
$env:DATABASE_URL = $DatabaseUrl
$env:ULTIMOTURNO_DATABASE_SSL = "true"
$env:ULTIMOTURNO_ALLOWED_ORIGINS = "http://localhost:$WebPort,http://127.0.0.1:$WebPort"
$env:ULTIMOTURNO_ALLOW_EXAMPLES = "false"
$env:PRICECHARTING_AUTO_REFRESH_ENABLED = "false"
$env:TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED = "false"
$env:API_PORT = [string] $ApiPort
if ($AccessKey) { $env:ULTIMOTURNO_ACCESS_KEY = $AccessKey }

$apiOut = Join-Path $projectRoot "api.supabase-staging.$runStamp.out.log"
$apiErr = Join-Path $projectRoot "api.supabase-staging.$runStamp.err.log"
$api = Start-Process -FilePath "C:\Program Files\nodejs\node.exe" `
  -ArgumentList @("--import", "tsx", "apps/api/src/server.ts") `
  -WorkingDirectory $projectRoot `
  -RedirectStandardOutput $apiOut `
  -RedirectStandardError $apiErr `
  -WindowStyle Hidden `
  -PassThru

Start-Sleep -Seconds 6

$env:ADMIN_WEB_PORT = [string] $WebPort
$env:ULTIMOTURNO_API_PROXY_TARGET = "http://localhost:$ApiPort"
$webOut = Join-Path $projectRoot "web.supabase-staging.$runStamp.out.log"
$webErr = Join-Path $projectRoot "web.supabase-staging.$runStamp.err.log"
$web = Start-Process -FilePath "npm.cmd" `
  -ArgumentList @("run", "dev", "-w", "@ultimoturno/admin-web", "--", "--host", "127.0.0.1", "--port", [string] $WebPort, "--strictPort") `
  -WorkingDirectory $projectRoot `
  -RedirectStandardOutput $webOut `
  -RedirectStandardError $webErr `
  -WindowStyle Hidden `
  -PassThru

Start-Sleep -Seconds 6

$tunnelProcess = $null
$tunnelOut = ""
$tunnelErr = ""
if ($Tunnel) {
  $tunnelOut = Join-Path $projectRoot "cloudflared.supabase-staging.$runStamp.out.log"
  $tunnelErr = Join-Path $projectRoot "cloudflared.supabase-staging.$runStamp.err.log"
  $tunnelProcess = Start-Process -FilePath "cloudflared" `
    -ArgumentList @("tunnel", "--url", "http://localhost:$WebPort") `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $tunnelOut `
    -RedirectStandardError $tunnelErr `
    -WindowStyle Hidden `
    -PassThru
  Start-Sleep -Seconds 10
}

$state = [pscustomobject]@{
  startedAt = (Get-Date).ToString("o")
  apiPid = $api.Id
  webPid = $web.Id
  tunnelPid = if ($tunnelProcess) { $tunnelProcess.Id } else { $null }
  apiPort = $ApiPort
  webPort = $WebPort
  apiUrl = "http://localhost:$ApiPort"
  webUrl = "http://localhost:$WebPort"
  apiLog = $apiOut
  apiErrorLog = $apiErr
  webLog = $webOut
  webErrorLog = $webErr
  tunnelLog = $tunnelOut
  tunnelErrorLog = $tunnelErr
}

$statePath = Join-Path $stateDir "latest.json"
$state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding UTF8
$state | ConvertTo-Json -Depth 4
