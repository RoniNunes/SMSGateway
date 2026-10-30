# Prepara e empacota o projeto para upload no EasyPanel
# Uso: .\scripts\deploy-easypanel.ps1 -AppUrl "https://sms.seudominio.com"

param(
    [Parameter(Mandatory = $true)]
    [string]$AppUrl,
    [string]$DbHost = "",
    [int]$ZipVersion = 0
)

$root = Split-Path $PSScriptRoot -Parent

Write-Host ""
Write-Host "=== SMS Gateway - preparar EasyPanel ===" -ForegroundColor Cyan
Write-Host ""

& (Join-Path $PSScriptRoot "prepare-easypanel.ps1") -AppUrl $AppUrl -DbHost $DbHost

$zipArgs = @{}
if ($ZipVersion -gt 0) { $zipArgs.Version = $ZipVersion }
& (Join-Path $PSScriptRoot "build-easypanel-zip.ps1") @zipArgs

$healthUrl = ($AppUrl.TrimEnd('/')) + '/health.php'

Write-Host ""
Write-Host "=== Proximos passos no EasyPanel ===" -ForegroundColor Green
Write-Host "1. Add Service -> Compose"
Write-Host "2. Upload do ZIP mais recente (SMSGateway-easypanel-v*.zip)"
if ($DbHost -eq '') {
    Write-Host "3. Ficheiro Compose: docker-compose.yml (detectado automaticamente)"
    Write-Host "4. Servico: web -> Domains -> porta 80 -> HTTPS"
    Write-Host "   APAGUE variavel DB_HOST se existir no Environment"
} else {
    Write-Host "3. Ficheiro Compose: compose.web-external-mysql.yaml"
    Write-Host "4. Servico: web -> Domains -> porta 80 -> HTTPS"
}
Write-Host "5. Cole as variaveis de .env.production no Environment"
Write-Host "6. Deploy e aguarde ~2 min (primeira vez)"
Write-Host ("7. Verifique: " + $healthUrl)
Write-Host ""