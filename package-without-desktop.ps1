# package-without-desktop.ps1 - 不包含桌面端的打包脚本

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

function Write-Utf8NoBom([string]$PathValue, [string]$Content) {
    [System.IO.File]::WriteAllText($PathValue, $Content, [System.Text.UTF8Encoding]::new($false))
}

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
Write-Host "Running agent preflight syntax/import check..." -ForegroundColor Gray
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
Write-Host "Running gateway preflight syntax/import check..." -ForegroundColor Gray
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
New-Item -ItemType Directory -Path "$DistDir\gateway" | Out-Null
New-Item -ItemType Directory -Path "$DistDir\gateway\gs-agent" | Out-Null

# Copy gateway runtime
Copy-Item dist\gs-gateway.exe "$DistDir\gateway\"
Copy-Item gs-gateway\public "$DistDir\gateway\public" -Recurse

# Copy agent runtime used by the gateway bridge.
Copy-Item dist\gs-agent.exe "$DistDir\gateway\gs-agent\"
Copy-Item gs-agent\src "$DistDir\gateway\gs-agent\src" -Recurse
Copy-Item gs-agent\programs "$DistDir\gateway\gs-agent\programs" -Recurse
Copy-Item gs-agent\main.gs "$DistDir\gateway\gs-agent\"
Copy-Item gs-agent\gateway-task.gs "$DistDir\gateway\gs-agent\"
Copy-Item gs-agent\project.toml "$DistDir\gateway\gs-agent\"
Copy-Item gs-agent\agent.example.toml "$DistDir\gateway\gs-agent\"
New-Item -ItemType Directory -Path "$DistDir\gateway\gs-agent\workspace" | Out-Null

# Write gateway config in the directory that gs-gateway.exe uses as cwd.
$GatewayConfig = @"
[gateway]
port = 18878
dataDir = ".gateway"
database = ".gateway/gateway.db"
agentRoot = "./gs-agent"

[im]
enabled = true

[scheduler]
enabled = true
"@
Write-Utf8NoBom "$DistDir\gateway\gateway.toml" $GatewayConfig

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
pushd "%~dp0gateway"
start /B gs-gateway.exe --timeout 0
popd
timeout /t 2 /nobreak >nul
if exist desktop.exe (
    start "" "%~dp0desktop.exe"
) else (
    echo Desktop.exe not found
)
"@ | Out-File -FilePath "$DistDir\start.bat" -Encoding ASCII

@"
`$ErrorActionPreference = "Stop"
`$Root = Split-Path -Parent `$MyInvocation.MyCommand.Path
`$GatewayDir = Join-Path `$Root "gateway"
`$GatewayExe = Join-Path `$GatewayDir "gs-gateway.exe"
`$DesktopExe = Join-Path `$Root "desktop.exe"

if (!(Test-Path -LiteralPath `$GatewayExe)) {
  throw "Gateway executable not found: `$GatewayExe"
}

`$Existing = Get-NetTCPConnection -LocalPort 18878 -State Listen -ErrorAction SilentlyContinue
if (!`$Existing) {
  Start-Process -FilePath `$GatewayExe -ArgumentList "--timeout","0" -WorkingDirectory `$GatewayDir -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

if (Test-Path -LiteralPath `$DesktopExe) {
  Start-Process -FilePath `$DesktopExe -WorkingDirectory `$Root
}
"@ | Out-File -FilePath "$DistDir\start.ps1" -Encoding UTF8

# Create README
@"
GTS System - Release Package
=============================

Files:
- desktop.exe                   Desktop application
- gateway/gs-gateway.exe        Gateway executable
- gateway/gateway.toml          Gateway configuration
- gateway/gs-agent/             Agent runtime used by gateway

Quick Start:
1. Configure Agent API Key:
   copy gateway\gs-agent\agent.example.toml gateway\gs-agent\agent.toml
   notepad gateway\gs-agent\agent.toml

2. Run:
   start.bat

Configuration:
- Gateway config: gateway\gateway.toml
- Agent config: gateway\gs-agent\agent.toml

Environment Variables:
  GATEWAY_PORT=18878       Gateway port

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
