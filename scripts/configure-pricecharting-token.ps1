$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "UltimoTurno - Configurar PriceCharting" -ForegroundColor Cyan
Write-Host "Podes pegar el token o el link completo del boton API/Download." -ForegroundColor DarkGray
Write-Host "El token se guardara como variable privada de tu usuario de Windows." -ForegroundColor DarkGray
Write-Host "No se escribira dentro del repositorio." -ForegroundColor DarkGray
Write-Host ""

$secureToken = Read-Host "Pega el token de PriceCharting" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
  if ($token -match '[?&]t=([^&]+)') {
    $token = [System.Uri]::UnescapeDataString($Matches[1]).Trim()
  }
  if (-not $token) {
    throw "El token esta vacio. No se guardo ningun cambio."
  }
  if ($token.Length -ne 40) {
    throw "El token detectado tiene $($token.Length) caracteres. PriceCharting normalmente usa tokens de 40 caracteres."
  }
  [Environment]::SetEnvironmentVariable("PRICECHARTING_TOKEN", $token, "User")
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  $token = $null
}

Write-Host ""
Write-Host "Token configurado." -ForegroundColor Green
Write-Host "Cerra las ventanas actuales de API/Web y volve a abrir UltimoTurno." -ForegroundColor Yellow
Write-Host "Luego usa el boton Sincronizar cache dentro de Compras." -ForegroundColor Yellow
Write-Host ""
Read-Host "Presiona Enter para cerrar"
