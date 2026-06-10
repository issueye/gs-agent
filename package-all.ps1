# package-all.ps1 - PowerShell 完整打包脚本

$ErrorActionPreference = "Stop"

# Ensure we're in the project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "=== GTS System Complete Package ===" -ForegroundColor Cyan
Write-Host ""

$DistDir = "dist\release"

# 1. Build GoScript
Write-Host "[1/4] Building GoScript..." -ForegroundColor Yellow
Push-Location gts
go build -ldflags="-s -w" -o gs.exe ./cmd/gs
if ($LASTEXITCODE -ne 0) { exit 1 }
Pop-Location
Write-Host "[OK] GoScript build complete" -ForegroundColor Green
Write-Host ""

# 2. Package Agent
Write-Host "[2/4] Packaging Agent..." -ForegroundColor Yellow
Push-Location gs-agent
$GsExePath = Resolve-Path "..\gts\gs.exe"
& $GsExePath --timeout 60s dist . ..\dist\gs-agent.exe
if ($LASTEXITCODE -ne 0) { exit 1 }
Pop-Location
Write-Host "[OK] Agent package complete" -ForegroundColor Green
Write-Host ""

# 3. Package Gateway
Write-Host "[3/4] Packaging Gateway..." -ForegroundColor Yellow
Push-Location gs-gateway
$GsExePath = Resolve-Path "..\gts\gs.exe"
& $GsExePath --timeout 60s dist . ..\dist\gs-gateway.exe
if ($LASTEXITCODE -ne 0) { exit 1 }
Pop-Location
Write-Host "[OK] Gateway package complete" -ForegroundColor Green
Write-Host ""

# 4. Build Desktop
Write-Host "[4/4] Building Desktop..." -ForegroundColor Yellow
Push-Location desktop

wails3 build
if ($LASTEXITCODE -ne 0) { exit 1 }
Pop-Location
Write-Host "[OK] Desktop build complete" -ForegroundColor Green
Write-Host ""

# 5. Assemble release
Write-Host "Assembling release package..." -ForegroundColor Yellow
if (Test-Path $DistDir) {
    Remove-Item $DistDir -Recurse -Force
}
New-Item -ItemType Directory -Path $DistDir | Out-Null
New-Item -ItemType Directory -Path "$DistDir\config" | Out-Null

# Copy executables
Copy-Item dist\gs-agent.exe $DistDir\
Copy-Item dist\gs-gateway.exe $DistDir\

# Copy config templates
Copy-Item gs-gateway\gateway.example.toml "$DistDir\config\"
Copy-Item gs-agent\agent.example.toml "$DistDir\config\"

# Copy desktop (try different paths)
$DesktopPaths = @(
    "desktop\build\bin\desktop.exe",
    "desktop\bin\desktop.exe",
    "desktop\build\bin\desktop-windows-amd64.exe"
)
foreach ($Path in $DesktopPaths) {
    if (Test-Path $Path) {
        Copy-Item $Path "$DistDir\desktop.exe"
        break
    }
}

# Create start script
@"
@echo off
start /B gs-gateway.exe
timeout /t 2 /nobreak >nul
start desktop.exe
"@ | Out-File -FilePath "$DistDir\start.bat" -Encoding ASCII

# Create PowerShell start script
@"
Start-Process -FilePath .\gs-gateway.exe -WindowStyle Hidden
Start-Sleep -Seconds 2
Start-Process -FilePath .\desktop.exe
"@ | Out-File -FilePath "$DistDir\start.ps1" -Encoding UTF8

# Create README
@"
GTS System - Release Package
=============================

Files:
- gs-agent.exe          Agent executable
- gs-gateway.exe        Gateway executable
- desktop.exe           Desktop application
- config/               Configuration templates

Quick Start:
1. Configure Agent API Key:
   copy config\agent.example.toml config\agent.local.toml
   notepad config\agent.local.toml
   (Fill in your Anthropic API key)

2. Run:
   Windows (Batch):      start.bat
   Windows (PowerShell): .\start.ps1

Configuration:
- Gateway: config\gateway.example.toml
- Agent:   config\agent.example.toml

Environment Variables:
  GATEWAY_PORT=18878       Gateway port
  TASK_TIMEOUT=30000       Task timeout (ms)

Version: 1.0.0
"@ | Out-File -FilePath "$DistDir\README.txt" -Encoding UTF8

Write-Host ""
Write-Host "=== Package Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Release package: $DistDir" -ForegroundColor White
Write-Host ""

Get-ChildItem $DistDir | ForEach-Object {
    $size = if ($_.Length -lt 1MB) { "{0:N2} KB" -f ($_.Length / 1KB) } else { "{0:N2} MB" -f ($_.Length / 1MB) }
    Write-Host "  $($_.Name.PadRight(25)) $size" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Total size: $((Get-ChildItem $DistDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB | ForEach-Object { '{0:N2} MB' -f $_ })" -ForegroundColor Yellow
