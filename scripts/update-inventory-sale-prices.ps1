[CmdletBinding()]
param(
  [string] $ApiBase = "http://127.0.0.1:4000",
  [ValidateSet("PreferTcgplayer", "PreferPriceCharting", "Tcgplayer", "PriceCharting", "Higher", "Lower")]
  [string] $Source = "PreferTcgplayer",
  [decimal] $BlueRate = 1540,
  [decimal] $MarkupPercent = 0,
  [int] $RoundTo = 100,
  [switch] $OnlyWithStock,
  [switch] $SkipGradedTcgplayer = $true,
  [switch] $Apply,
  [string] $OutputPath = ""
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

function Convert-ToRoundedArs {
  param([decimal] $Usd)
  $raw = $Usd * $BlueRate * (1 + ($MarkupPercent / 100))
  if ($RoundTo -le 1) {
    return [int][Math]::Round($raw, 0, [MidpointRounding]::AwayFromZero)
  }
  return [int]([Math]::Ceiling($raw / $RoundTo) * $RoundTo)
}

function Get-ReferencePrice {
  param($Item)

  $isGraded = -not [string]::IsNullOrWhiteSpace([string]$Item.variant.gradingCompany) -or -not [string]::IsNullOrWhiteSpace([string]$Item.variant.grade)
  $pc = $Item.priceReferences.priceCharting
  $tcg = $Item.priceReferences.tcgplayer
  $pcUsd = if ($pc -and $pc.usd -gt 0) { [decimal]$pc.usd } else { $null }
  $tcgUsd = if ($tcg -and $tcg.usd -gt 0 -and (-not ($SkipGradedTcgplayer -and $isGraded))) { [decimal]$tcg.usd } else { $null }

  if ($Source -eq "PriceCharting") {
    if ($pcUsd) { return @{ Source = "PriceCharting"; Usd = $pcUsd; Detail = "loose" } }
    return $null
  }
  if ($Source -eq "Tcgplayer") {
    if ($tcgUsd) { return @{ Source = "TCGplayer"; Usd = $tcgUsd; Detail = [string]$tcg.subTypeName } }
    return $null
  }
  if ($Source -eq "PreferPriceCharting") {
    if ($pcUsd) { return @{ Source = "PriceCharting"; Usd = $pcUsd; Detail = "loose" } }
    if ($tcgUsd) { return @{ Source = "TCGplayer"; Usd = $tcgUsd; Detail = [string]$tcg.subTypeName } }
    return $null
  }
  if ($Source -eq "Higher") {
    if ($pcUsd -and $tcgUsd) {
      if ($pcUsd -ge $tcgUsd) { return @{ Source = "PriceCharting"; Usd = $pcUsd; Detail = "loose" } }
      return @{ Source = "TCGplayer"; Usd = $tcgUsd; Detail = [string]$tcg.subTypeName }
    }
    if ($pcUsd) { return @{ Source = "PriceCharting"; Usd = $pcUsd; Detail = "loose" } }
    if ($tcgUsd) { return @{ Source = "TCGplayer"; Usd = $tcgUsd; Detail = [string]$tcg.subTypeName } }
    return $null
  }
  if ($Source -eq "Lower") {
    if ($pcUsd -and $tcgUsd) {
      if ($pcUsd -le $tcgUsd) { return @{ Source = "PriceCharting"; Usd = $pcUsd; Detail = "loose" } }
      return @{ Source = "TCGplayer"; Usd = $tcgUsd; Detail = [string]$tcg.subTypeName }
    }
    if ($pcUsd) { return @{ Source = "PriceCharting"; Usd = $pcUsd; Detail = "loose" } }
    if ($tcgUsd) { return @{ Source = "TCGplayer"; Usd = $tcgUsd; Detail = [string]$tcg.subTypeName } }
    return $null
  }

  if ($tcgUsd) { return @{ Source = "TCGplayer"; Usd = $tcgUsd; Detail = [string]$tcg.subTypeName } }
  if ($pcUsd) { return @{ Source = "PriceCharting"; Usd = $pcUsd; Detail = "loose" } }
  return $null
}

function New-InventoryUpdateBody {
  param($Item, [int] $PriceArs, [decimal] $PriceUsd)
  return @{
    sku = [string]$Item.sku
    name = [string]$Item.product.name
    expansion = [string]$Item.product.expansion
    number = [string]$Item.product.number
    imageUrl = [string]$Item.product.imageUrl
    language = [string]$Item.variant.language
    condition = [string]$Item.variant.condition
    finish = [string]$Item.variant.finish
    gradingCompany = [string]$Item.variant.gradingCompany
    grade = [string]$Item.variant.grade
    gradingCert = [string]$Item.variant.gradingCert
    location = [string]$Item.location
    intakeBatch = [string]$Item.intakeBatch
    inventoryStatus = [string]$Item.inventoryStatus
    quantityOnHand = [int]$Item.quantityOnHand
    quantityReserved = [int]$Item.quantityReserved
    priceArs = $PriceArs
    priceUsd = [double]$PriceUsd
    notes = ""
  }
}

$headers = Get-AccessHeaders
$stockResponse = Invoke-RestMethod -Uri "$ApiBase/stock" -Headers $headers -Method Get
$items = @($stockResponse.items)
$changes = New-Object System.Collections.Generic.List[object]
$skipped = 0

foreach ($item in $items) {
  if ($OnlyWithStock -and [int]$item.availableQuantity -le 0) {
    $skipped++
    continue
  }
  $reference = Get-ReferencePrice -Item $item
  if (-not $reference) {
    $skipped++
    continue
  }
  $nextArs = Convert-ToRoundedArs -Usd ([decimal]$reference.Usd)
  $currentArs = [int]$item.priceArs
  if ($nextArs -eq $currentArs) {
    continue
  }
  $changes.Add([pscustomobject]@{
    id = [string]$item.id
    sku = [string]$item.sku
    name = [string]$item.product.name
    expansion = [string]$item.product.expansion
    number = [string]$item.product.number
    presentation = if ($item.variant.gradingCompany -or $item.variant.grade) { "$($item.variant.gradingCompany) $($item.variant.grade)".Trim() } else { "RAW" }
    available = [int]$item.availableQuantity
    source = [string]$reference.Source
    sourceDetail = [string]$reference.Detail
    sourceUsd = [decimal]$reference.Usd
    currentArs = $currentArs
    nextArs = $nextArs
    deltaArs = $nextArs - $currentArs
  })
}

if (-not $OutputPath) {
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutputPath = Join-Path (Resolve-Path ".") "outputs\inventory-price-update-$timestamp.csv"
}
$outputDir = Split-Path -Parent $OutputPath
if ($outputDir) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}
$changes | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $OutputPath

Write-Host ""
Write-Host "UltimoTurno - Actualizador externo de precios" -ForegroundColor Cyan
Write-Host "API: $ApiBase"
Write-Host "Fuente: $Source | Blue: $BlueRate | Markup: $MarkupPercent% | Redondeo: $RoundTo"
Write-Host "Productos leidos: $($items.Count)"
Write-Host "Cambios detectados: $($changes.Count)"
Write-Host "Saltados sin fuente o filtro: $skipped"
Write-Host "Reporte: $OutputPath"
Write-Host ""

$changes |
  Select-Object -First 20 name, expansion, number, presentation, available, source, sourceDetail, sourceUsd, currentArs, nextArs, deltaArs |
  Format-Table -AutoSize

if (-not $Apply) {
  Write-Host ""
  Write-Host "Preview solamente. Para aplicar cambios, volver a correr con -Apply." -ForegroundColor Yellow
  exit 0
}

$updated = 0
foreach ($change in $changes) {
  $item = $items | Where-Object { $_.id -eq $change.id } | Select-Object -First 1
  if (-not $item) { continue }
  $body = New-InventoryUpdateBody -Item $item -PriceArs ([int]$change.nextArs) -PriceUsd ([decimal]$change.sourceUsd)
  $json = $body | ConvertTo-Json -Depth 8
  Invoke-RestMethod -Uri "$ApiBase/inventory/$($change.id)" -Headers $headers -Method Put -Body $json | Out-Null
  $updated++
  if ($updated % 25 -eq 0) {
    Write-Host "Actualizados: $updated / $($changes.Count)"
  }
}

Write-Host ""
Write-Host "Aplicado. Productos actualizados: $updated" -ForegroundColor Green
