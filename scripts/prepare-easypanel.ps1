# Gera valores seguros para o EasyPanel (.env de produção)
# Uso: .\scripts\prepare-easypanel.ps1 -AppUrl "https://sms.seudominio.com"

param(
    [Parameter(Mandatory = $true)]
    [string]$AppUrl,
    [string]$DbHost = ""
)

$root = Split-Path $PSScriptRoot -Parent
$example = Join-Path $root ".env.example"
$out = Join-Path $root ".env.production"

if (-not (Test-Path $example)) {
    Write-Error ".env.example não encontrado em $root"
    exit 1
}

function New-RandomHex([int]$Bytes = 32) {
    $buf = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return ([BitConverter]::ToString($buf) -replace '-', '').ToLower()
}

function New-RandomPassword([int]$Length = 24) {
    $chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%'
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] $Length
    $rng.GetBytes($bytes)
    return -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

$dbPass = New-RandomPassword
$rootPass = New-RandomPassword
$migrateKey = New-RandomHex 32
$pairingSecret = New-RandomHex 32

$content = Get-Content $example -Raw
$content = $content -replace 'CHANGE_ME_STRONG_PASSWORD', $dbPass
$content = $content -replace 'CHANGE_ME_ROOT_PASSWORD', $rootPass
$content = $content -replace 'CHANGE_ME_RANDOM_SECRET', $migrateKey
$content = $content -replace 'CHANGE_ME_PAIRING_SECRET', $pairingSecret
$content = $content -replace 'https://sms\.seudominio\.com', $AppUrl.TrimEnd('/')

if ($DbHost -ne '') {
    $content = $content -replace '# DB_HOST=db', "DB_HOST=$DbHost"
}

Set-Content -Path $out -Value $content -Encoding UTF8

Write-Host ""
Write-Host "Ficheiro gerado: .env.production" -ForegroundColor Green
Write-Host ""
Write-Host "Copie estas variáveis para o EasyPanel (Environment do serviço Compose):" -ForegroundColor Cyan
Write-Host ""
Write-Host "# Modo recomendado: compose.easypanel.yaml (servico app, all-in-one)" -ForegroundColor DarkGray
$allInOneVars = @(
    'DB_PASSWORD', 'DB_NAME', 'DB_USER', 'APP_URL', 'MIGRATE_KEY', 'PAIRING_SECRET', 'MIGRATE_ON_START', 'TZ'
)
Get-Content $out | Where-Object { $_ -match '\S' -and $_ -notmatch '^\s*#' } | ForEach-Object {
    $key = ($_ -split '=', 2)[0]
    if ($DbHost -eq '' -and $key -in @('DB_HOST', 'MYSQL_ROOT_PASSWORD', 'PMA_USER', 'PMA_PASSWORD')) { return }
    if ($DbHost -ne '' -and $key -eq 'MYSQL_ROOT_PASSWORD') { return }
    Write-Host $_
}
Write-Host ""
Write-Host "Guarde as passwords num gestor de credenciais. Nao as partilhe no Git." -ForegroundColor Yellow