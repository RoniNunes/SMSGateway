# Sincroniza APK + metadados de versão para web/public (download versionado)
# Uso: .\scripts\sync-apk-meta.ps1 -AppUrl "https://sms.seudominio.com"

param(
    [string]$AppUrl = ""
)

$root = Split-Path $PSScriptRoot -Parent
$gradleProps = Join-Path $root "gradle.properties"
$envProd = Join-Path $root "web\.env.production"
$gradleFile = Join-Path $root "app\build.gradle"
# Nunca usar app-release-unsigned.apk — Android rejeita pacotes não assinados.
$apkCandidates = @(
    (Join-Path $root "app\build\outputs\apk\release\app-release.apk"),
    (Join-Path $root "app\build\outputs\apk\debug\app-debug.apk"),
    (Join-Path $root "php\SMSGateway.apk")
)
$publicDir = Join-Path $root "web\public"
$apkDst = Join-Path $publicDir "SMSGateway.apk"
$metaDst = Join-Path $publicDir "apk-meta.json"

if (-not $AppUrl -and (Test-Path $envProd)) {
    $line = Get-Content $envProd | Where-Object { $_ -match '^\s*APP_URL=' } | Select-Object -First 1
    if ($line -match 'APP_URL=(.+)') { $AppUrl = $Matches[1].Trim().Trim('"') }
}

if ($AppUrl) {
    $AppUrl = $AppUrl.Trim().TrimEnd('/')
    if (Test-Path $gradleProps) {
        $props = Get-Content $gradleProps
        $updated = $false
        $props = $props | ForEach-Object {
            if ($_ -match '^\s*SMS_GATEWAY_DEFAULT_SERVER=') {
                $updated = $true
                "SMS_GATEWAY_DEFAULT_SERVER=$AppUrl"
            } else { $_ }
        }
        if (-not $updated) { $props += "SMS_GATEWAY_DEFAULT_SERVER=$AppUrl" }
        $utf8 = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($gradleProps, ($props -join "`r`n") + "`r`n", $utf8)
        Write-Host "gradle.properties: SMS_GATEWAY_DEFAULT_SERVER=$AppUrl"
    }
}

$versionName = "0"
$versionCode = 0

if (Test-Path $gradleFile) {
    $gradle = Get-Content $gradleFile -Raw
    if ($gradle -match 'versionName\s+"([^"]+)"') { $versionName = $Matches[1] }
    if ($gradle -match 'versionCode\s+(\d+)') { $versionCode = [int]$Matches[1] }
}

$apkSrc = $apkCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
New-Item -ItemType Directory -Force -Path $publicDir | Out-Null

if ($apkSrc) {
    Copy-Item $apkSrc $apkDst -Force
    Copy-Item $apkSrc (Join-Path $root "php\SMSGateway.apk") -Force
    Write-Host "APK: $apkSrc -> web/public/SMSGateway.apk"
} elseif (!(Test-Path $apkDst)) {
    Write-Warning "APK nao encontrado. Compile: .\gradlew.bat assembleDebug"
}

$metaObj = @{
    version_name = $versionName
    version_code = $versionCode
    built_at     = (Get-Date).ToUniversalTime().ToString("o")
    download_filename = "SMSGateway-v$versionName.apk"
}
if ($AppUrl) { $metaObj.server_url = $AppUrl }
$meta = $metaObj | ConvertTo-Json -Compress

$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($metaDst, $meta + "`n", $utf8)
Write-Host "Meta: apk-meta.json (v$versionName / build $versionCode)"
Write-Host "Download: SMSGateway-v$versionName.apk"