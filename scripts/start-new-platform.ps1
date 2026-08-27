[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string] $DataProfile = "PILOTO REAL",
  [string] $DataDir = "apps\api\.data\ultimoturno-pilot-real",
  [string] $AllowExamples = "false",
  [string] $ImageDir = "D:\UltimoTurno\pricecharting-images"
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

function Import-UltimoTurnoUserEnvironment {
  $priceChartingToken = [Environment]::GetEnvironmentVariable("PRICECHARTING_TOKEN", "User")
  if ($priceChartingToken) {
    $env:PRICECHARTING_TOKEN = $priceChartingToken.Trim()
  }

  $priceChartingCategory = [Environment]::GetEnvironmentVariable("PRICECHARTING_CATEGORY", "User")
  if ($priceChartingCategory) {
    $env:PRICECHARTING_CATEGORY = $priceChartingCategory.Trim()
  }

  $priceChartingAutoRefreshTime = [Environment]::GetEnvironmentVariable("PRICECHARTING_AUTO_REFRESH_TIME", "User")
  if ($priceChartingAutoRefreshTime) {
    $env:PRICECHARTING_AUTO_REFRESH_TIME = $priceChartingAutoRefreshTime.Trim()
  }

  $priceChartingAutoRefreshEnabled = [Environment]::GetEnvironmentVariable("PRICECHARTING_AUTO_REFRESH_ENABLED", "User")
  if ($priceChartingAutoRefreshEnabled) {
    $env:PRICECHARTING_AUTO_REFRESH_ENABLED = $priceChartingAutoRefreshEnabled.Trim()
  }

  $tcgCsvBaseUrl = [Environment]::GetEnvironmentVariable("TCGCSV_BASE_URL", "User")
  if ($tcgCsvBaseUrl) {
    $env:TCGCSV_BASE_URL = $tcgCsvBaseUrl.Trim()
  }

  $tcgplayerPriceCategoryId = [Environment]::GetEnvironmentVariable("TCGPLAYER_PRICE_CATEGORY_ID", "User")
  if ($tcgplayerPriceCategoryId) {
    $env:TCGPLAYER_PRICE_CATEGORY_ID = $tcgplayerPriceCategoryId.Trim()
  }

  $tcgplayerPriceAutoRefreshTime = [Environment]::GetEnvironmentVariable("TCGPLAYER_PRICE_AUTO_REFRESH_TIME", "User")
  if ($tcgplayerPriceAutoRefreshTime) {
    $env:TCGPLAYER_PRICE_AUTO_REFRESH_TIME = $tcgplayerPriceAutoRefreshTime.Trim()
  }

  $tcgplayerPriceAutoRefreshEnabled = [Environment]::GetEnvironmentVariable("TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED", "User")
  if ($tcgplayerPriceAutoRefreshEnabled) {
    $env:TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED = $tcgplayerPriceAutoRefreshEnabled.Trim()
  }
}

function Stop-UltimoTurnoListener {
  param(
    [Parameter(Mandatory = $true)]
    [int] $Port
  )

  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    $commandLine = [string] $process.CommandLine
    $belongsToProject = $commandLine.IndexOf([string] $projectRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0

    if (-not $belongsToProject) {
      throw "El puerto $Port esta ocupado por otro programa. No se cerro ningun proceso."
    }

    if ($PSCmdlet.ShouldProcess("PID $($listener.OwningProcess) en puerto $Port", "Cerrar servidor anterior de UltimoTurno")) {
      Stop-Process -Id $listener.OwningProcess -Force
    }
  }
}

function Start-UltimoTurnoWindow {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Title,
    [Parameter(Mandatory = $true)]
    [string] $Command
  )

  $script = @"
`$Host.UI.RawUI.WindowTitle = "$Title"
Set-Location -LiteralPath "$projectRoot"
Write-Host ""
Write-Host "UltimoTurno - $Title" -ForegroundColor Cyan
Write-Host "Carpeta: $projectRoot" -ForegroundColor DarkGray
Write-Host ""
$Command
Write-Host ""
Write-Host "El proceso termino. Presiona Enter para cerrar esta ventana." -ForegroundColor Yellow
Read-Host
"@

  if ($PSCmdlet.ShouldProcess($Title, "Abrir PowerShell y ejecutar $Command")) {
    Start-Process powershell.exe -ArgumentList @(
      "-NoExit",
      "-ExecutionPolicy", "Bypass",
      "-Command", $script
    )
  }
}

Import-UltimoTurnoUserEnvironment

$env:ULTIMOTURNO_DATA_PROFILE = $DataProfile
$examplesEnabled = @("1", "true", "yes", "si", "sí") -contains $AllowExamples.ToLowerInvariant()
$env:ULTIMOTURNO_ALLOW_EXAMPLES = if ($examplesEnabled) { "true" } else { "false" }
if ($DataDir) {
  $resolvedDataDir = if ([System.IO.Path]::IsPathRooted($DataDir)) { $DataDir } else { Join-Path $projectRoot $DataDir }
  $env:PGLITE_DATA_DIR = $resolvedDataDir
}
if ($ImageDir) {
  $resolvedImageDir = if ([System.IO.Path]::IsPathRooted($ImageDir)) { $ImageDir } else { Join-Path $projectRoot $ImageDir }
  $env:PRICECHARTING_IMAGE_DIR = $resolvedImageDir
}

Stop-UltimoTurnoListener -Port 4000
Stop-UltimoTurnoListener -Port 5173

Start-UltimoTurnoWindow -Title "API local" -Command "npm run dev:api"
Start-Sleep -Seconds 2
Start-UltimoTurnoWindow -Title "Web admin" -Command "npm run dev:web"

Write-Host ""
if ($WhatIfPreference) {
  Write-Host "Simulacion lista. No se abrieron ventanas." -ForegroundColor Yellow
} else {
  Write-Host "Listo. Se abrieron dos ventanas:" -ForegroundColor Green
  Write-Host "- Perfil: $DataProfile"
  if ($DataDir) {
    Write-Host "- Base: $env:PGLITE_DATA_DIR"
  }
  if ($ImageDir) {
    Write-Host "- Imagenes: $env:PRICECHARTING_IMAGE_DIR"
  }
  Write-Host "- API local: http://localhost:4000"
  Write-Host "- Web admin: http://localhost:5173"
}
Write-Host ""
