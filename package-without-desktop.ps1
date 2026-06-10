# package-without-desktop.ps1 - 不包含桌面端的打包脚本

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "=== GTS System Package (Without Desktop) ===" -ForegroundColor Cyan
Write-Host ""

$DistDir = "dist\release"

# 1. Build GoScript
Write-Host "[1/3] Building GoScript..." -ForegroundColor Yellow
Push-Location gts
go build -ldflags="-s -w" -o gs.exe ./cmd/gs
if ($LASTEXITCODE -ne 0) { exit 1 }
Pop-Location
Write-Host "[OK] GoScript build complete" -ForegroundColor Green
Write-Host ""

# 2. Package Agent
Write-Host "[2/3] Packaging Agent..." -ForegroundColor Yellow
Push-Location gs-agent

# Clean unnecessary directories before packaging
Write-Host "Cleaning unnecessary files..." -ForegroundColor Gray
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue build, dist, docs, plugins, .agent, .claude

$GsExePath = Resolve-Path "..\gts\gs.exe"
& $GsExePath --timeout 60s dist . ..\dist\gs-agent.exe
if ($LASTEXITCODE -ne 0) { exit 1 }
Pop-Location
Write-Host "[OK] Agent package complete" -ForegroundColor Green
Write-Host ""

# 3. Package Gateway
Write-Host "[3/3] Packaging Gateway..." -ForegroundColor Yellow
Push-Location gs-gateway

# Clean unnecessary directories
Write-Host "Cleaning unnecessary files..." -ForegroundColor Gray
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue build, dist, docs, .gateway

$GsExePath = Resolve-Path "..\gts\gs.exe"
& $GsExePath --timeout 60s dist . ..\dist\gs-gateway.exe
if ($LASTEXITCODE -ne 0) { exit 1 }
Pop-Location
Write-Host "[OK] Gateway package complete" -ForegroundColor Green
Write-Host ""

# 4. Assemble release
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

# Try to copy desktop if exists
$DesktopPaths = @(
    "desktop\build\bin\desktop.exe",
    "desktop\bin\desktop.exe"
)
$desktopFound = $false
foreach ($Path in $DesktopPaths) {
    if (Test-Path $Path) {
        Copy-Item $Path "$DistDir\desktop.exe"
        $desktopFound = $true
        Write-Host "Found and copied desktop.exe" -ForegroundColor Green
        break
    }
}

if (-not $desktopFound) {
    Write-Host "Desktop.exe not found - build separately with: cd desktop && wails3 build" -ForegroundColor Yellow
}

# Create start scripts
@"
@echo off
start /B gs-gateway.exe
timeout /t 2 /nobreak >nul
if exist desktop.exe (
    start desktop.exe
) else (
    echo Desktop.exe not found
)
"@ | Out-File -FilePath "$DistDir\start.bat" -Encoding ASCII

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
   start.bat

Configuration:
- Gateway config: config\gateway.example.toml
- Agent config: config\agent.example.toml

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
