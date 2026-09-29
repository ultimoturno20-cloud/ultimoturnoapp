$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$state = Get-Content -LiteralPath (Join-Path $projectRoot '.work\stock-offline\processes.json') -Raw | ConvertFrom-Json
foreach ($entry in @(@{Id=$state.apiPid;Port=4010;Match='apps/api/src/server.ts'},@{Id=$state.webPid;Port=5174;Match='apps/admin-web/vite.config.mjs'})) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($entry.Id)"
    if (-not $process) { continue }
    $listener = Get-NetTCPConnection -State Listen -LocalPort $entry.Port -ErrorAction SilentlyContinue
    if ($process.Name -ne 'node.exe' -or $process.CommandLine -notlike "*$($entry.Match)*" -or $listener.OwningProcess -ne $entry.Id) { throw 'El proceso no coincide con la app local; no se detuvo.' }
    Stop-Process -Id $entry.Id
}
Write-Output 'App local detenida.'
