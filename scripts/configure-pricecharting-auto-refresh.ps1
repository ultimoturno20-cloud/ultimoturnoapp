$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "UltimoTurno - Actualizacion automatica de PriceCharting" -ForegroundColor Cyan
Write-Host "Configura la hora diaria en formato 24 hs, por ejemplo 06:00 o 23:30." -ForegroundColor DarkGray
Write-Host "La hora se guarda como variable privada de tu usuario de Windows." -ForegroundColor DarkGray
Write-Host ""

$currentEnabled = [Environment]::GetEnvironmentVariable("PRICECHARTING_AUTO_REFRESH_ENABLED", "User")
$currentTime = [Environment]::GetEnvironmentVariable("PRICECHARTING_AUTO_REFRESH_TIME", "User")
if (-not $currentEnabled) { $currentEnabled = "true" }
if (-not $currentTime) { $currentTime = "06:00" }

Write-Host "Estado actual: enabled=$currentEnabled / hora=$currentTime" -ForegroundColor Yellow
Write-Host ""

$enabledInput = Read-Host "Activar actualizacion diaria? (S/n)"
$enabled = if ($enabledInput.Trim().ToLowerInvariant() -in @("n", "no")) { "false" } else { "true" }

if ($enabled -eq "true") {
  $time = Read-Host "Hora diaria (HH:mm, Enter mantiene $currentTime)"
  if (-not $time.Trim()) { $time = $currentTime }
  if ($time.Trim() -notmatch '^([01]?\d|2[0-3]):[0-5]\d$') {
    throw "Hora invalida. Usa formato HH:mm, por ejemplo 06:00 o 23:30."
  }
  $parts = $time.Trim().Split(":")
  $time = "{0:D2}:{1:D2}" -f [int]$parts[0], [int]$parts[1]
  [Environment]::SetEnvironmentVariable("PRICECHARTING_AUTO_REFRESH_TIME", $time, "User")
}

[Environment]::SetEnvironmentVariable("PRICECHARTING_AUTO_REFRESH_ENABLED", $enabled, "User")

Write-Host ""
if ($enabled -eq "true") {
  Write-Host "Actualizacion diaria activada a las $time hs." -ForegroundColor Green
} else {
  Write-Host "Actualizacion diaria desactivada." -ForegroundColor Yellow
}
Write-Host "Cerra las ventanas actuales de API/Web y volve a abrir UltimoTurno para tomar el cambio." -ForegroundColor Yellow
Write-Host ""
Read-Host "Presiona Enter para cerrar"
