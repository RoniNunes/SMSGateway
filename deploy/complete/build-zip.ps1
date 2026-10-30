# Gera ZIP alternativo (build context = raiz, Dockerfile em deploy/complete)
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$out = Join-Path $root "SMSGateway-container-completo.zip"
if (Test-Path $out) { Remove-Item $out -Force }

Push-Location $root
try {
    tar -a -c -f $out `
        --exclude=".git" `
        --exclude="app" `
        --exclude=".gradle" `
        --exclude="terminals" `
        --exclude="SMSGateway-easypanel*.zip" `
        --exclude="SMSGateway-container-completo.zip" `
        deploy/complete `
        php `
        MySQL_DB.sql `
        .env.example
} finally {
    Pop-Location
}

Write-Host "ZIP: $out" -ForegroundColor Green
Write-Host "EasyPanel: Compose = deploy/complete/compose.easypanel.yaml (servico smsgateway)" -ForegroundColor Cyan
Write-Host "Alternativa mais simples: scripts/deploy-easypanel.ps1 -> compose.easypanel.yaml na raiz" -ForegroundColor Yellow