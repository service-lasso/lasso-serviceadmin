$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$packageRoot = Join-Path $root '.package'
$staging = Join-Path $packageRoot '@serviceadmin-win32'
$zipPath = Join-Path $dist '@serviceadmin-win32.zip'

if (-not (Test-Path (Join-Path $dist 'index.html'))) {
  throw 'Build output missing. Run npm run build first.'
}

New-Item -ItemType Directory -Force -Path $dist | Out-Null
New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Force -Path $staging | Out-Null

Copy-Item -Force (Join-Path $root 'service.json') (Join-Path $staging 'service.json')
Copy-Item -Recurse -Force (Join-Path $root 'runtime\win32') (Join-Path $staging 'runtime')
Copy-Item -Force (Join-Path $root 'runtime\server.js') (Join-Path $staging 'runtime\server.js')
Copy-Item -Recurse -Force (Join-Path $root 'config') (Join-Path $staging 'config')
New-Item -ItemType Directory -Force -Path (Join-Path $staging 'dist') | Out-Null
Copy-Item -Force (Join-Path $dist 'index.html') (Join-Path $staging 'dist\index.html')
Copy-Item -Recurse -Force (Join-Path $dist 'assets') (Join-Path $staging 'dist\assets')
Copy-Item -Recurse -Force (Join-Path $dist 'images') (Join-Path $staging 'dist\images')
Copy-Item -Recurse -Force (Join-Path $dist 'services') (Join-Path $staging 'dist\services')

if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipPath
Write-Host "Created $zipPath"
