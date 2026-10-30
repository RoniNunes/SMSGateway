# Gera .env.production para EasyPanel (stack Next.js em web/)
# Uso: .\scripts\prepare-easypanel-web.ps1 -AppUrl "https://sms.seudominio.com"

param(
    [Parameter(Mandatory = $true)]
    [string]$AppUrl
)

$root = Split-Path $PSScriptRoot -Parent
$webRoot = Join-Path $root "web"
$example = Join-Path $webRoot ".env.easypanel.example"
$out = Join-Path $webRoot ".env.production"

if (-not (Test-Path $example)) {
    Write-Error ".env.easypanel.example nao encontrado em $webRoot"
    exit 1
}

function New-RandomHex([int]$Bytes = 32) {
    $buf = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return ([BitConverter]::ToString($buf) -replace '-', '').ToLower()
}

$migrateKey = New-RandomHex 32
$pairingSecret = New-RandomHex 32
$sessionSecret = New-RandomHex 32
$adminRecoverySecret = New-RandomHex 32
$appUrl = $AppUrl.TrimEnd('/')

$content = Get-Content $example -Raw
$content = $content -replace 'CHANGE_ME_RANDOM_SECRET', $migrateKey
$content = $content -replace 'CHANGE_ME_PAIRING_SECRET', $pairingSecret
$content = $content -replace 'CHANGE_ME_SESSION_SECRET', $sessionSecret
$content = $content -replace 'CHANGE_ME_ADMIN_RECOVERY_SECRET', $adminRecoverySecret
$content = $content -replace 'https://sms\.seudominio\.com', $appUrl

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($out, $content.TrimEnd() + "`n", $utf8NoBom)

Write-Host ""
Write-Host "Ficheiro gerado: web/.env.production" -ForegroundColor Green
Write-Host ""
Write-Host "Cole no EasyPanel (Environment do servico web):" -ForegroundColor Cyan
Write-Host ""
Get-Content $out | Where-Object { $_ -match '\S' -and $_ -notmatch '^\s*#' } | ForEach-Object { Write-Host $_ }
Write-Host ""
Write-Host "Dominio EasyPanel: proxy porta 80 + HTTPS" -ForegroundColor Yellow