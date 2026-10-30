# Inicia o container completo (para outros stacks SMS Gateway primeiro)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path (Split-Path $here -Parent) -Parent
Set-Location $here

if (!(Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "Criado .env" -ForegroundColor Yellow
}

Write-Host "A parar stacks antigos..." -ForegroundColor Yellow
docker compose -f "$root\compose.all-in-one.yaml" -f "$root\docker-compose.local.yml" down 2>$null
docker compose -f "$root\docker-compose.yml" down 2>$null
docker rm -f smsgateway-app-1 smsgateway-complete 2>$null

Write-Host "A construir e iniciar..." -ForegroundColor Cyan
docker compose up -d --build --remove-orphans

Start-Sleep -Seconds 15
$health = try {
    (Invoke-WebRequest -Uri "http://localhost:8081/health.php" -UseBasicParsing -TimeoutSec 10).Content
} catch { "ERRO: $($_.Exception.Message)" }

Write-Host ""
Write-Host "Estado:" -ForegroundColor Cyan
docker compose ps
Write-Host ""
Write-Host "Health: $health" -ForegroundColor $(if ($health -match 'connected') { 'Green' } else { 'Red' })
Write-Host ""
Write-Host "Dashboard: http://localhost:8081/login.php" -ForegroundColor Green
Write-Host "Login:     admin@smsgateway.local / admin123" -ForegroundColor Cyan