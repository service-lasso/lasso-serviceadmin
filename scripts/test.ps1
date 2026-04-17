$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$required = @(
  (Join-Path $root 'service.json'),
  (Join-Path $root 'verify\service-harness.json'),
  (Join-Path $root 'runtime\server.js'),
  (Join-Path $root 'runtime\win32\start-service-admin.ps1'),
  (Join-Path $root 'dist\index.html')
)

foreach ($path in $required) {
  if (-not (Test-Path $path)) {
    throw "Missing required file: $path"
  }
}

$service = Get-Content (Join-Path $root 'service.json') -Raw | ConvertFrom-Json
if ($service.id -ne 'service-admin') {
  throw 'service.json id mismatch'
}

$contract = Get-Content (Join-Path $root 'verify\service-harness.json') -Raw | ConvertFrom-Json
if ($contract.serviceId -ne 'service-admin') {
  throw 'service-harness.json serviceId mismatch'
}

$port = 17711
$env:SERVICE_PORT = "$port"
$env:SERVICE_HOST = '127.0.0.1'
$job = Start-Process -FilePath node -ArgumentList @('runtime/server.js') -WorkingDirectory $root -PassThru -WindowStyle Hidden
try {
  $deadline = (Get-Date).AddSeconds(15)
  do {
    Start-Sleep -Milliseconds 500
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port" -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        Write-Host 'Template tests passed (Windows)'
        return
      }
    } catch {}
  } while ((Get-Date) -lt $deadline)

  throw 'Service Admin runtime health check failed'
} finally {
  if ($job -and -not $job.HasExited) {
    $job | Stop-Process -Force
  }
}
