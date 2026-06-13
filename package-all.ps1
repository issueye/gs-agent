# package-all.ps1 - PowerShell 完整打包脚本

$ErrorActionPreference = "Stop"

# Ensure we're in the project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

function Write-Utf8NoBom([string]$PathValue, [string]$Content) {
    [System.IO.File]::WriteAllText($PathValue, $Content, [System.Text.UTF8Encoding]::new($false))
}

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
Write-Host "Running agent preflight syntax/import check..." -ForegroundColor Gray
& $GsExePath --timeout 60s dist . ..\dist\gs-agent.exe
if ($LASTEXITCODE -ne 0) { exit 1 }
Pop-Location
Write-Host "[OK] Agent package complete" -ForegroundColor Green
Write-Host ""

# 3. Package Gateway
Write-Host "[3/4] Packaging Gateway..." -ForegroundColor Yellow
Push-Location gs-gateway
$GsExePath = Resolve-Path "..\gts\gs.exe"
Write-Host "Running gateway preflight syntax/import check..." -ForegroundColor Gray
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
New-Item -ItemType Directory -Path "$DistDir\gateway" | Out-Null
New-Item -ItemType Directory -Path "$DistDir\gateway\gs-agent" | Out-Null

# Copy gateway runtime
Copy-Item dist\gs-gateway.exe "$DistDir\gateway\"
Copy-Item gs-gateway\public "$DistDir\gateway\public" -Recurse

# Copy agent runtime used by the gateway bridge.
Copy-Item dist\gs-agent.exe "$DistDir\gateway\gs-agent\"
Copy-Item gs-agent\src "$DistDir\gateway\gs-agent\src" -Recurse
if (Test-Path gs-agent\programs) {
    Copy-Item gs-agent\programs "$DistDir\gateway\gs-agent\programs" -Recurse
}
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

[gateway.defaultAgent]
enabled = false
name = "default"
modelProvider = "anthropic"
modelName = "deepseek-v4-flash"
baseUrl = "https://api.deepseek.com/anthropic"
systemPrompt = "You are a concise coding agent. Before acting, analyze the user's request, identify the concrete tasks needed, and state or maintain a brief task plan. Then work through the tasks in order, using tools when useful. Complete the user's requested task and stop when you have a final answer."
maxIterations = 10
toolWhitelist = ["read_file", "list_dir", "grep", "todo"]
apiKeyEnv = "GS_AGENT_API_KEY"

[im]
enabled = true

[im.outbound]
enabled = true
adapter = "console"
retryMax = 3
retryDelayMs = 1000
webhookUrl = ""

[scheduler]
enabled = true
"@
Write-Utf8NoBom "$DistDir\gateway\gateway.toml" $GatewayConfig

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
pushd "%~dp0gateway"
start /B gs-gateway.exe --timeout 0
popd
timeout /t 2 /nobreak >nul
start "" "%~dp0desktop.exe"
"@ | Out-File -FilePath "$DistDir\start.bat" -Encoding ASCII

# Create PowerShell start script
@"
$ErrorActionPreference = "Stop"
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

Start-Sleep -Seconds 2
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
   Windows (Batch):      start.bat
   Windows (PowerShell): .\start.ps1

Configuration:
- Gateway: gateway\gateway.toml
- Agent:   gateway\gs-agent\agent.toml

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
Write-Host "Total size: $((Get-ChildItem $DistDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB | ForEach-Object { '{0:N2} MB' -f $_ })" -ForegroundColor Yellow
