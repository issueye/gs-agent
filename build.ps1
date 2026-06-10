# build.ps1 - GTS PowerShell Build Script

# Ensure we're in the project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "=== GTS System Build ===" -ForegroundColor Cyan
Write-Host ""

# Check Go
if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Go not found" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Go installed" -ForegroundColor Green

# Check npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] npm not found" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] npm installed" -ForegroundColor Green
Write-Host ""

# Build GoScript
Write-Host "Building GoScript..." -ForegroundColor Yellow
Push-Location gts
go build -o gs.exe ./cmd/gs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] GoScript build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "[OK] GoScript build success" -ForegroundColor Green
Pop-Location
Write-Host ""

# Build Desktop
Write-Host "Building Desktop..." -ForegroundColor Yellow
Push-Location desktop\frontend
npm install
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Desktop build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "[OK] Desktop build success" -ForegroundColor Green
Pop-Location
Write-Host ""

# Copy files
Write-Host "Copying binaries..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path dist\bin | Out-Null
Copy-Item gts\gs.exe dist\bin\
Write-Host "[OK] Copy complete" -ForegroundColor Green
Write-Host ""

# Create scripts
Write-Host "Creating start scripts..." -ForegroundColor Yellow

@"
@echo off
cd gs-gateway
..\dist\bin\gs.exe main.gs
"@ | Out-File -FilePath dist\start-gateway.bat -Encoding ASCII

@"
@echo off
cd gs-agent
..\dist\bin\gs.exe main.gs
"@ | Out-File -FilePath dist\start-agent.bat -Encoding ASCII

@"
Set-Location gs-gateway
..\dist\bin\gs.exe main.gs
"@ | Out-File -FilePath dist\start-gateway.ps1 -Encoding UTF8

@"
Set-Location gs-agent
..\dist\bin\gs.exe main.gs
"@ | Out-File -FilePath dist\start-agent.ps1 -Encoding UTF8

Write-Host "[OK] Scripts created" -ForegroundColor Green
Write-Host ""

Write-Host "=== Build Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Binaries:" -ForegroundColor White
Write-Host "  - dist\bin\gs.exe" -ForegroundColor Gray
Write-Host ""
Write-Host "Start:" -ForegroundColor White
Write-Host "  - Gateway: .\dist\start-gateway.ps1" -ForegroundColor Gray
Write-Host "  - Agent:   .\dist\start-agent.ps1" -ForegroundColor Gray
Write-Host ""
