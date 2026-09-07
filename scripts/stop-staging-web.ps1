[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$statePath = Join-Path $projectRoot ".work\staging-web\latest.json"

if (-not (Test-Path -LiteralPath $statePath)) {
  Write-Output "No hay una version staging registrada para cerrar."
  exit 0
}

$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$pids = @($state.tunnelPid, $state.webPid, $state.apiPid) | Where-Object { $_ }

foreach ($processId in $pids) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $processId -Force
    Write-Output "Cerrado PID $processId"
  }
}

Remove-Item -LiteralPath $statePath -Force
