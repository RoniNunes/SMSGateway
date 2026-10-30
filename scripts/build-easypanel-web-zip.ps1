# ZIP para EasyPanel - stack Next.js (pasta web/)
# Uso: .\scripts\build-easypanel-web-zip.ps1

param(
    [int]$Version = 0
)

$root = Split-Path $PSScriptRoot -Parent
$webRoot = Join-Path $root "web"

function Get-NextZipVersion([string]$basePath) {
    $max = 0
    Get-ChildItem $basePath -Filter "SMSGateway-easypanel-next-v*.zip" -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.Name -match 'v(\d+)\.zip$') {
            $max = [Math]::Max($max, [int]$Matches[1])
        }
    }
    return $max + 1
}

if ($Version -le 0) {
    $Version = Get-NextZipVersion $root
}

$zipName = Join-Path $root ("SMSGateway-easypanel-next-v{0}.zip" -f $Version)

if (Test-Path $zipName) {
    Write-Error "Ja existe: $zipName"
    exit 1
}

& (Join-Path $PSScriptRoot "sync-apk-meta.ps1")

Push-Location $webRoot
try {
    tar -a -c -f $zipName `
        --exclude="node_modules" `
        --exclude=".next" `
        --exclude="data" `
        --exclude=".env" `
        --exclude=".env.local" `
        --exclude=".env.production" `
        Dockerfile `
        docker-compose.yml `
        package.json `
        package-lock.json `
        server.ts `
        next.config.ts `
        tsconfig.json `
        prisma `
        public `
        src `
        .dockerignore `
        .env.easypanel.example `
        EASYPANEL.md `
        LEIA-ME-EASYPANEL.txt
} finally {
    Pop-Location
}

$item = Get-Item $zipName
Write-Host ""
Write-Host "ZIP criado: $($item.FullName)" -ForegroundColor Green
Write-Host "Versao: next-v$Version" -ForegroundColor Green
Write-Host "Tamanho: $([math]::Round($item.Length / 1MB, 2)) MB" -ForegroundColor Cyan
Write-Host "EasyPanel: Compose + proxy porta 80" -ForegroundColor Yellow