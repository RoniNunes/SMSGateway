$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
docker compose down
Write-Host "Container parado." -ForegroundColor Yellow