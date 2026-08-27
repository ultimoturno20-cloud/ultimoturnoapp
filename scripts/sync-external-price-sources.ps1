[CmdletBinding()]
param(
  [string] $ApiBase = "http://127.0.0.1:4000",
  [switch] $SkipPriceCharting,
  [switch] $SkipTcgplayer,
  [switch] $ForceTcgplayer = $true
)

$ErrorActionPreference = "Stop"

function Get-AccessHeaders {
  $headers = @{ "Content-Type" = "application/json" }
  $accessKey = [Environment]::GetEnvironmentVariable("ULTIMOTURNO_ACCESS_KEY", "User")
  if (-not $accessKey) {
    $accessKey = [Environment]::GetEnvironmentVariable("ULTIMOTURNO_ACCESS_KEY", "Process")
  }
  if ($accessKey) {
    $headers["X-UltimoTurno-Access-Key"] = $accessKey.Trim()
  }
  return $headers
}

function Write-SourceStatus {
  param([string] $Name, $Status)
  Write-Host ""
  Write-Host $Name -ForegroundColor Cyan
  $Status | ConvertTo-Json -Depth 8
}

$headers = Get-AccessHeaders

Write-Host ""
Write-Host "UltimoTurno - Sync externo de fuentes de precio" -ForegroundColor Cyan
Write-Host "API: $ApiBase"

try {
  $health = Invoke-RestMethod -Uri "$ApiBase/health" -Headers $headers -Method Get
  Write-Host "Base: $($health.environment.dataDir)"
  Write-Host "Perfil: $($health.environment.dataProfile)"
} catch {
  throw "No pude conectar con la API en $ApiBase. Abri UltimoTurno primero. Detalle: $($_.Exception.Message)"
}

if (-not $SkipPriceCharting) {
  Write-Host ""
  Write-Host "Actualizando PriceCharting CSV..." -ForegroundColor Yellow
  try {
    $pc = Invoke-RestMethod -Uri "$ApiBase/pricecharting-cache/refresh" -Headers $headers -Method Post -Body "{}"
    Write-SourceStatus -Name "PriceCharting OK" -Status $pc.status
  } catch {
    Write-Host "PriceCharting fallo: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Si falta token, ejecutar Configurar PriceCharting.cmd."
  }
}

if (-not $SkipTcgplayer) {
  Write-Host ""
  Write-Host "Actualizando TCGplayer via TCGCSV..." -ForegroundColor Yellow
  $body = @{ force = [bool]$ForceTcgplayer } | ConvertTo-Json
  $tcg = Invoke-RestMethod -Uri "$ApiBase/tcgplayer-prices/refresh" -Headers $headers -Method Post -Body $body
  Write-SourceStatus -Name "TCGplayer OK" -Status $tcg.status
}

Write-Host ""
Write-Host "Sync terminado." -ForegroundColor Green
