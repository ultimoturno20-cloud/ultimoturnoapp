[CmdletBinding()]
param(
  [string] $ApiBase = "http://127.0.0.1:4000",
  [int] $PriceChartingBatchSize = 2000,
  [int] $TcgGroupBatchSize = 5,
  [int] $ImageBatchSize = 1000,
  [switch] $SkipPriceChartingRefresh,
  [switch] $SkipCardIndexRebuild,
  [switch] $SkipTcgplayerPrices,
  [switch] $SkipTcgplayerLinks,
  [switch] $SkipImages
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

function Invoke-UltimoTurnoJson {
  param(
    [Parameter(Mandatory = $true)] [string] $Path,
    [string] $Method = "GET",
    [object] $Body = $null,
    [int] $TimeoutSec = 900
  )
  $params = @{
    Uri = "$ApiBase$Path"
    Method = $Method
    Headers = $script:Headers
    TimeoutSec = $TimeoutSec
  }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 8)
  }
  Invoke-RestMethod @params
}

function Write-Step {
  param([string] $Message)
  Write-Host ""
  Write-Host $Message -ForegroundColor Cyan
}

function Write-Json {
  param($Value)
  $Value | ConvertTo-Json -Depth 8
}

$script:Headers = Get-AccessHeaders

Write-Step "UltimoTurno - sincronizacion segura de catalogo"
$health = Invoke-UltimoTurnoJson -Path "/health" -TimeoutSec 20
Write-Host "API: $ApiBase"
Write-Host "Perfil: $($health.environment.dataProfile)"
Write-Host "Base: $($health.environment.dataDir)"
Write-Host "Imagenes: $($health.environment.priceChartingImageDir)"

if (-not $SkipPriceChartingRefresh) {
  Write-Step "1. PriceCharting CSV"
  $result = Invoke-UltimoTurnoJson -Path "/pricecharting-cache/refresh" -Method "POST"
  Write-Json $result.status
}

if (-not $SkipCardIndexRebuild) {
  Write-Step "2. Indice maestro desde PriceCharting"
  $afterId = ""
  $processed = 0
  do {
    $body = @{ limit = $PriceChartingBatchSize }
    if ($afterId) { $body.afterId = $afterId }
    $batch = Invoke-UltimoTurnoJson -Path "/card-index/rebuild-pricecharting-batch" -Method "POST" -Body $body
    $processed += [int] $batch.processed
    $afterId = [string] $batch.nextAfterId
    Write-Host ("  +{0} procesadas, indice={1}, imagenes={2}, siguiente={3}" -f $batch.processed, $batch.status.totalEntries, $batch.status.imageLinkedEntries, $afterId)
  } until ($batch.complete -or -not $afterId)
  Write-Json $batch.status
}

if (-not $SkipTcgplayerPrices) {
  Write-Step "3. Precios TCGPlayer via TCGCSV"
  $result = Invoke-UltimoTurnoJson -Path "/tcgplayer-prices/refresh" -Method "POST" -Body @{ force = $true } -TimeoutSec 1200
  Write-Json $result.status
}

if (-not $SkipTcgplayerLinks) {
  Write-Step "4. Links TCGPlayer al indice maestro"
  $offset = 0
  do {
    $batch = Invoke-UltimoTurnoJson -Path "/card-index/sync-tcgcsv" -Method "POST" -Body @{ groupOffset = $offset; groupLimit = $TcgGroupBatchSize } -TimeoutSec 300
    Write-Host ("  grupos {0}-{1}/{2}: vistos={3}, fuertes={4}, debiles={5}, conflictos={6}, linked={7}" -f ($batch.groupOffset + 1), ($batch.groupOffset + $batch.groupsProcessed), $batch.totalGroups, $batch.rowsSeen, $batch.rowsMatched, $batch.rowsWeak, $batch.rowsConflict, $batch.status.tcgplayerLinkedEntries)
    $offset = if ($null -ne $batch.nextGroupOffset) { [int] $batch.nextGroupOffset } else { -1 }
  } until ($batch.complete -or $offset -lt 0)
  Write-Json $batch.status
}

if (-not $SkipImages) {
  Write-Step "5. Reindexado local de imagenes"
  $local = Invoke-UltimoTurnoJson -Path "/pricecharting-images/reindex-local" -Method "POST" -Body @{ limit = $ImageBatchSize } -TimeoutSec 600
  Write-Json @{ indexed = $local.indexed; skipped = $local.skipped; status = $local.status }

  Write-Step "6. URLs de imagen por indice externo"
  $external = Invoke-UltimoTurnoJson -Path "/pricecharting-images/external-index" -Method "POST" -Body @{ includeAll = $true; batchSize = $ImageBatchSize } -TimeoutSec 900
  Write-Json @{ processed = $external.processed; urlFound = $external.urlFound; skipped = $external.skipped; failed = $external.failed; status = $external.status }

  Write-Step "7. URLs de imagen por PriceCharting Storage directo"
  $storage = Invoke-UltimoTurnoJson -Path "/pricecharting-images/discover" -Method "POST" -Body @{ includeAll = $true; batchSize = $ImageBatchSize; concurrency = 20; sourceMode = "pricecharting-storage" } -TimeoutSec 900
  Write-Json @{ processed = $storage.processed; urlFound = $storage.urlFound; failed = $storage.failed; status = $storage.status }
}

Write-Step "Estado final"
Write-Json @{
  priceCharting = (Invoke-UltimoTurnoJson -Path "/pricecharting-cache/status" -TimeoutSec 30)
  tcgplayer = (Invoke-UltimoTurnoJson -Path "/tcgplayer-prices/status" -TimeoutSec 30)
  cardIndex = (Invoke-UltimoTurnoJson -Path "/card-index/status" -TimeoutSec 30)
  images = (Invoke-UltimoTurnoJson -Path "/pricecharting-images/status" -TimeoutSec 30)
}
