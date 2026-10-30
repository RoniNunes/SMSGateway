# Prepara e empacota Next.js para EasyPanel
# Uso: .\scripts\deploy-easypanel-web.ps1 -AppUrl "https://sms.seudominio.com"

param(
    [Parameter(Mandatory = $true)]
    [string]$AppUrl,
    [int]$ZipVersion = 0
)

$root = Split-Path $PSScriptRoot -Parent

Write-Host ""
Write-Host "=== SMS Gateway Web Next.js - EasyPanel ===" -ForegroundColor Cyan
Write-Host ""

& (Join-Path $PSScriptRoot "prepare-easypanel-web.ps1") -AppUrl $AppUrl
& (Join-Path $PSScriptRoot "sync-apk-meta.ps1") -AppUrl $AppUrl

$zipArgs = @{}
if ($ZipVersion -gt 0) { $zipArgs.Version = $ZipVersion }
& (Join-Path $PSScriptRoot "build-easypanel-web-zip.ps1") @zipArgs

$base = $AppUrl.TrimEnd('/')
Write-Host ""
Write-Host "=== Proximos passos no EasyPanel ===" -ForegroundColor Green
Write-Host "1. Add Service -> Compose"
Write-Host "2. Upload: SMSGateway-easypanel-next-v*.zip"
Write-Host "3. Compose: docker-compose.yml"
Write-Host "4. Environment: cole web/.env.production"
Write-Host "5. Domains: proxy porta 80 + HTTPS"
Write-Host "6. Deploy e aguarde build"
Write-Host ('7. Verifique: ' + $base + '/health')
Write-Host ('8. Login: ' + $base + '/login')
Write-Host ""