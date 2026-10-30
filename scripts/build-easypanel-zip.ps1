# Cria ZIP versionado para deploy EasyPanel (mantém versões anteriores)
# Uso: .\scripts\build-easypanel-zip.ps1
#      .\scripts\build-easypanel-zip.ps1 -Version 3

param(
    [int]$Version = 0
)

$root = Split-Path $PSScriptRoot -Parent

function Get-NextZipVersion([string]$basePath) {
    $max = 0
    Get-ChildItem $basePath -Filter "SMSGateway-easypanel-v*.zip" -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.Name -match 'v(\d+)\.zip$') {
            $max = [Math]::Max($max, [int]$Matches[1])
        }
    }
    if (Test-Path (Join-Path $basePath "SMSGateway-easypanel.zip")) {
        $max = [Math]::Max($max, 1)
    }
    return $max + 1
}

if ($Version -le 0) {
    $Version = Get-NextZipVersion $root
}

$zipName = Join-Path $root ("SMSGateway-easypanel-v{0}.zip" -f $Version)

if (Test-Path $zipName) {
    Write-Error "Ja existe: $zipName. Escolha outra versao com -Version."
    exit 1
}

Push-Location $root
try {
    tar -a -c -f $zipName `
        --exclude=".git" `
        --exclude="app" `
        --exclude="gradle" `
        --exclude="gradlew" `
        --exclude="gradlew.bat" `
        --exclude="build.gradle" `
        --exclude="settings.gradle" `
        --exclude="gradle.properties" `
        --exclude=".gradle" `
        --exclude="build" `
        --exclude=".idea" `
        --exclude=".vscode" `
        --exclude=".env" `
        --exclude=".env.local" `
        --exclude=".env.production" `
        --exclude="terminals" `
        --exclude="local.properties" `
        --exclude="captures" `
        --exclude="*.iml" `
        --exclude="abrir-firewall.bat" `
        --exclude="SMSGateway-easypanel*.zip" `
        Dockerfile `
        docker-compose.yml `
        compose.yaml `
        compose.easypanel.yaml `
        docker `
        php `
        MySQL_DB.sql `
        .env.example `
        .dockerignore `
        EASYPANEL.md `
        scripts
} finally {
    Pop-Location
}

$item = Get-Item $zipName
$allZips = Get-ChildItem $root -Filter "SMSGateway-easypanel*.zip" | Sort-Object Name

Write-Host ""
Write-Host "ZIP criado: $($item.FullName)" -ForegroundColor Green
Write-Host "Versao: v$Version" -ForegroundColor Green
Write-Host "Tamanho: $([math]::Round($item.Length / 1MB, 2)) MB" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pacotes disponiveis:" -ForegroundColor Cyan
$allZips | ForEach-Object {
    $size = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  - $($_.Name) ($size MB)"
}
Write-Host ""
Write-Host "EasyPanel: Compose + docker-compose.yml + 1 servico 'web' (sem DB_HOST)" -ForegroundColor Yellow