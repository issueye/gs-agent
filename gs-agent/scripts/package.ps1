param(
  [string]$GsExe = "E:\codes\gts\dist\gs.exe",
  [string]$Output = "dist\gs-agent.exe",
  [switch]$SkipSmoke
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
$Output = Resolve-ProjectPath $Output
$PublishDir = Join-Path $ProjectRoot "build\gs-agent-app"
$OutputDir = Split-Path -Parent $Output

if (!(Test-Path -LiteralPath $GsExe)) {
  throw "GoScript executable not found: $GsExe"
}

Write-Host "==> project: $ProjectRoot"
Write-Host "==> gs:      $GsExe"
Write-Host "==> output:  $Output"

if (!$SkipSmoke) {
  Write-Host "==> running smoke tests"
  & $GsExe --timeout 20s smoke-test.gs
  & $GsExe --timeout 20s provider-test.gs
  & $GsExe --timeout 20s app-root-smoke-test.gs
  & $GsExe --timeout 20s file-tools-smoke-test.gs
  & $GsExe --timeout 20s invalid-tool-streak-smoke-test.gs
  & $GsExe --timeout 20s agent-cancel-smoke-test.gs
  & $GsExe --timeout 20s anthropic-empty-body-smoke-test.gs
  & $GsExe --timeout 20s anthropic-retry-smoke-test.gs
  & $GsExe --timeout 20s llm-body-log-smoke-test.gs
  & $GsExe --timeout 20s todo-tool-smoke-test.gs
  & $GsExe --timeout 20s todo-status-smoke-test.gs
  & $GsExe --timeout 20s tool-result-sanitize-smoke-test.gs
  & $GsExe --timeout 20s dynamic-tool-smoke-test.gs
  & $GsExe --timeout 20s skill-system-smoke-test.gs
  & $GsExe --timeout 20s create-skill-tool-smoke-test.gs
  & $GsExe --timeout 20s skill-write-guard-smoke-test.gs
  & $GsExe --timeout 20s child-tools-smoke-test.gs
  & $GsExe --timeout 20s subagent-smoke-test.gs
  & $GsExe --timeout 20s run-skill-smoke-test.gs
  & $GsExe --timeout 20s run-skill-refresh-smoke-test.gs
  & $GsExe --timeout 20s session-manager-smoke-test.gs
  & $GsExe --timeout 20s session-rotation-smoke-test.gs
  & $GsExe --timeout 20s tui-smoke-test.gs
  & $GsExe --timeout 20s framework-smoke-test.gs
  & $GsExe --timeout 20s markdown-stdlib-smoke-test.gs
}

Write-Host "==> preparing publish dir"
if (Test-Path -LiteralPath $PublishDir) {
  Remove-Item -LiteralPath $PublishDir -Recurse -Force
}

$ProjectDistDir = Join-Path $ProjectRoot "dist"
if ([System.IO.Path]::GetFullPath($OutputDir) -eq [System.IO.Path]::GetFullPath($ProjectDistDir)) {
  Remove-Item -LiteralPath $OutputDir -Recurse -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Force -Path $PublishDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $PublishDir "src") | Out-Null

Copy-Item -Path (Join-Path $ProjectRoot "src\agent") -Destination (Join-Path $PublishDir "src") -Recurse
Copy-Item -Path (Join-Path $ProjectRoot "src\tui") -Destination (Join-Path $PublishDir "src") -Recurse

$RootFiles = @(
  "main.gs",
  "gateway-task.gs",
  "project.toml",
  "agent.toml",
  "README.md"
)

foreach ($File in $RootFiles) {
  Copy-Item -LiteralPath (Join-Path $ProjectRoot $File) -Destination $PublishDir
}

if (Test-Path -LiteralPath (Join-Path $PublishDir ".agent")) {
  throw "Refusing to package .agent runtime directory"
}

Write-Host "==> building exe"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Output) | Out-Null
& $GsExe --timeout 60s dist $PublishDir $Output

if (!(Test-Path -LiteralPath $Output)) {
  throw "Package output was not created: $Output"
}

$OutputAgentStateDir = Join-Path $OutputDir ".agent"
if (Test-Path -LiteralPath $OutputAgentStateDir) {
  Remove-Item -LiteralPath $OutputAgentStateDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path (Join-Path $OutputDir "src") | Out-Null
$OutputAgentSrc = Join-Path $OutputDir "src\agent"
if (Test-Path -LiteralPath $OutputAgentSrc) {
  Remove-Item -LiteralPath $OutputAgentSrc -Recurse -Force
}
Copy-Item -Path (Join-Path $ProjectRoot "src\agent") -Destination (Join-Path $OutputDir "src") -Recurse

foreach ($RuntimeFile in @("gateway-task.gs", "project.toml")) {
  Copy-Item -LiteralPath (Join-Path $ProjectRoot $RuntimeFile) -Destination $OutputDir -Force
}

foreach ($ConfigFile in @("agent.toml")) {
  $ConfigSource = Join-Path $ProjectRoot $ConfigFile
  $ConfigTarget = Join-Path $OutputDir $ConfigFile
  if ([System.IO.Path]::GetFullPath($ConfigSource) -ne [System.IO.Path]::GetFullPath($ConfigTarget)) {
    Copy-Item -LiteralPath $ConfigSource -Destination $ConfigTarget -Force
  }
}

$IMBotPlugin = Join-Path $ProjectRoot "plugins\im-bot\gtp-imbot.exe"
if (!(Test-Path -LiteralPath $IMBotPlugin)) {
  throw "IM bot plugin executable not found: $IMBotPlugin"
}

$OutputIMBotDir = Join-Path $OutputDir ".agent\plugins\im-bot"
New-Item -ItemType Directory -Force -Path $OutputIMBotDir | Out-Null
Copy-Item -LiteralPath $IMBotPlugin -Destination $OutputIMBotDir -Force

$Item = Get-Item -LiteralPath $Output
Write-Host "==> packaged: $($Item.FullName)"
Write-Host "==> config:   $(Join-Path $OutputDir "agent.toml")"
Write-Host "==> im-bot:   $(Join-Path $OutputIMBotDir "gtp-imbot.exe")"
Write-Host "==> size:     $($Item.Length) bytes"
Write-Host "==> updated:  $($Item.LastWriteTime)"
