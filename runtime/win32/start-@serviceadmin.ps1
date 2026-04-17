$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$env:SERVICE_HOST = if ($env:SERVICE_HOST) { $env:SERVICE_HOST } else { '127.0.0.1' }
$env:SERVICE_PORT = if ($env:SERVICE_PORT) { $env:SERVICE_PORT } else { '17700' }
$env:SERVICE_DIST_DIR = if ($env:SERVICE_DIST_DIR) { $env:SERVICE_DIST_DIR } else { 'dist' }

Set-Location $root
node .\runtime\server.js
