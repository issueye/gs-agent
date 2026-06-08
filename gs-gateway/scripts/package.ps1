param(
  [string]$GsExe = "E:\codes\gts\dist\gs.exe",
  [string]$AgentDist = "..\gs-agent\dist",
  [string]$Output = "dist\gs-gateway.exe"
)

$ErrorActionPreference = "Stop"

function Resolve-ProjectPath([string]$PathValue) {
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }
  return Join-Path $ProjectRoot $PathValue
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $ProjectRoot

$GsExe = Resolve-ProjectPath $GsExe
$AgentDist = Resolve-ProjectPath $AgentDist
$Output = Resolve-ProjectPath $Output
$OutputDir = Split-Path -Parent $Output
$PublishDir = Join-Path $ProjectRoot "build\gs-gateway-app"

if (!(Test-Path -LiteralPath $GsExe)) {
  throw "GoScript executable not found: $GsExe"
}

if (!(Test-Path -LiteralPath (Join-Path $AgentDist "gateway-task.gs"))) {
  throw "Agent publish directory is incomplete: $AgentDist"
}

Write-Host "==> project:   $ProjectRoot"
Write-Host "==> gs:        $GsExe"
Write-Host "==> agent:     $AgentDist"
Write-Host "==> output:    $Output"

Write-Host "==> preparing publish dir"
if (Test-Path -LiteralPath $PublishDir) {
  Remove-Item -LiteralPath $PublishDir -Recurse -Force
}

$ProjectDistDir = Join-Path $ProjectRoot "dist"
if ([System.IO.Path]::GetFullPath($OutputDir) -eq [System.IO.Path]::GetFullPath($ProjectDistDir)) {
  Remove-Item -LiteralPath $OutputDir -Recurse -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Force -Path $PublishDir | Out-Null

Copy-Item -Path (Join-Path $ProjectRoot "src") -Destination $PublishDir -Recurse

foreach ($File in @("main.gs", "project.toml", "README.md")) {
  Copy-Item -LiteralPath (Join-Path $ProjectRoot $File) -Destination $PublishDir
}

Write-Host "==> building exe"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
& $GsExe --timeout 60s dist $PublishDir $Output

if (!(Test-Path -LiteralPath $Output)) {
  throw "Package output was not created: $Output"
}

Copy-Item -Path (Join-Path $ProjectRoot "public") -Destination (Join-Path $OutputDir "public") -Recurse
Copy-Item -Path $AgentDist -Destination (Join-Path $OutputDir "gs-agent") -Recurse

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
[System.IO.File]::WriteAllText(
  (Join-Path $OutputDir "gateway.toml"),
  $GatewayConfig,
  [System.Text.UTF8Encoding]::new($false)
)

$Item = Get-Item -LiteralPath $Output
Write-Host "==> packaged: $($Item.FullName)"
Write-Host "==> config:   $(Join-Path $OutputDir "gateway.toml")"
Write-Host "==> public:   $(Join-Path $OutputDir "public")"
Write-Host "==> agent:    $(Join-Path $OutputDir "gs-agent")"
Write-Host "==> size:     $($Item.Length) bytes"
Write-Host "==> updated:  $($Item.LastWriteTime)"
