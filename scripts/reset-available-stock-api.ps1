param(
  [switch] $Apply,
  [string] $ApiBase = "http://127.0.0.1:4000",
  [string] $OutDir = "outputs"
)

$ErrorActionPreference = "Stop"
$resolvedOut = Resolve-Path -LiteralPath . -ErrorAction Stop
$backupDir = Join-Path $resolvedOut.Path $OutDir

$stock = Invoke-RestMethod -Uri "$ApiBase/stock" -Method Get
$targets = @($stock.items | Where-Object { [int]$_.quantityOnHand -gt [int]$_.quantityReserved })
$unitsToRemove = ($targets | Measure-Object -Property availableQuantity -Sum).Sum
if ($null -eq $unitsToRemove) { $unitsToRemove = 0 }
$reservedPreserved = ($stock.items | Measure-Object -Property quantityReserved -Sum).Sum
if ($null -eq $reservedPreserved) { $reservedPreserved = 0 }

$stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ssZ")
$backupPath = Join-Path $backupDir "stock-before-reset-$stamp.json"
$backup = [ordered]@{
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  mode = $(if ($Apply) { "apply" } else { "dry-run" })
  apiBase = $ApiBase
  summary = $stock.summary
  rows = @($stock.items | ForEach-Object {
    [ordered]@{
      id = $_.id
      sku = $_.sku
      name = $_.product.name
      expansion = $_.product.expansion
      number = $_.product.number
      quantityOnHand = $_.quantityOnHand
      quantityReserved = $_.quantityReserved
      availableQuantity = $_.availableQuantity
      priceArs = $_.priceArs
      priceUsd = $_.priceUsd
      location = $_.location
    }
  })
}
$backup | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $backupPath -Encoding UTF8

if ($Apply) {
  foreach ($item in $targets) {
    $delta = [int]$item.quantityReserved - [int]$item.quantityOnHand
    $body = @{
      inventoryItemId = $item.id
      quantityDelta = $delta
      note = "Reset carga completa: disponible $($item.availableQuantity) -> 0"
    } | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Uri "$ApiBase/inventory-adjustments" -Method Post -ContentType "application/json" -Body $body | Out-Null
  }
  $after = Invoke-RestMethod -Uri "$ApiBase/stock" -Method Get
} else {
  $after = $null
}

[ordered]@{
  mode = $(if ($Apply) { "apply" } else { "dry-run" })
  backupPath = $backupPath
  totalSkus = $stock.summary.totalSkus
  touchedSkus = $targets.Count
  unitsToRemove = [int]$unitsToRemove
  reservedPreserved = [int]$reservedPreserved
  beforeAvailable = $stock.summary.availableUnits
  afterAvailable = $(if ($after) { $after.summary.availableUnits } else { $stock.summary.availableUnits })
  afterTotalUnits = $(if ($after) { $after.summary.totalUnits } else { $stock.summary.totalUnits })
} | ConvertTo-Json -Depth 5
