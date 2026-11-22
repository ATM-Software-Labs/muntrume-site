# MMT Sync - Instalador oficial para Windows 10/11 (PowerShell 5.1+)
# Uso: irm https://muntru.me/install.ps1 | iex

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host ""
Write-Host "  MMT Sync - Instalador oficial (Muntrume Motorsport)" -ForegroundColor Green
Write-Host "  ---------------------------------------------------" -ForegroundColor DarkGray

$apiUrl = "https://api.github.com/repos/ATM-Software-Labs/muntrume-site/releases/latest"
Write-Host "[1/3] Consultando ultima version en GitHub Releases..." -ForegroundColor Cyan

$headers = @{ "User-Agent" = "MMT-Sync-Installer/1.0" }
$release = Invoke-RestMethod -Uri $apiUrl -Headers $headers -UseBasicParsing
$asset = $release.assets | Where-Object { $_.name -like "*-setup.exe" } | Select-Object -First 1

if (-not $asset) {
    throw "No se encontro el instalador (-setup.exe) en la ultima release ($($release.tag_name))."
}

$version = $release.tag_name
$outFile = Join-Path $env:TEMP $asset.name

Write-Host "[2/3] Descargando $($asset.name) ($version)..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $outFile -Headers $headers -UseBasicParsing

# Elimina la marca Mark-of-the-Web (Zone.Identifier) para evitar el bloqueo de SmartScreen en la descarga local
try { Unblock-File -Path $outFile -ErrorAction SilentlyContinue } catch {}

Write-Host "[3/3] Iniciando instalador de MMT Sync..." -ForegroundColor Cyan
Start-Process -FilePath $outFile -Wait

Write-Host ""
Write-Host "  Instalacion completada. Ya puedes abrir MMT Sync desde el Menu Inicio." -ForegroundColor Green
Write-Host ""
