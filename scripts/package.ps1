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
  & $GsExe --timeout 20s llm-body-log-smoke-test.gs
  & $GsExe --timeout 20s todo-tool-smoke-test.gs
  & $GsExe --timeout 20s tool-result-sanitize-smoke-test.gs
  & $GsExe --timeout 20s dynamic-tool-smoke-test.gs
  & $GsExe --timeout 20s tui-smoke-test.gs
  & $GsExe --timeout 20s framework-smoke-test.gs
  & $GsExe --timeout 20s markdown-stdlib-smoke-test.gs
}

Write-Host "==> preparing publish dir"
if (Test-Path -LiteralPath $PublishDir) {
  Remove-Item -LiteralPath $PublishDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $PublishDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $PublishDir "src") | Out-Null

Copy-Item -Path (Join-Path $ProjectRoot "src\agent") -Destination (Join-Path $PublishDir "src") -Recurse
Copy-Item -Path (Join-Path $ProjectRoot "src\tui") -Destination (Join-Path $PublishDir "src") -Recurse

$RootFiles = @(
  "main.gs",
  "project.toml",
  "agent.toml",
  "agent.local.example.toml",
  "README.md"
)

foreach ($File in $RootFiles) {
  Copy-Item -LiteralPath (Join-Path $ProjectRoot $File) -Destination $PublishDir
}

if (Test-Path -LiteralPath (Join-Path $PublishDir "agent.local.toml")) {
  throw "Refusing to package agent.local.toml"
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

$OutputDir = Split-Path -Parent $Output
foreach ($ConfigFile in @("agent.toml", "agent.local.example.toml")) {
  $ConfigSource = Join-Path $ProjectRoot $ConfigFile
  $ConfigTarget = Join-Path $OutputDir $ConfigFile
  if ([System.IO.Path]::GetFullPath($ConfigSource) -ne [System.IO.Path]::GetFullPath($ConfigTarget)) {
    Copy-Item -LiteralPath $ConfigSource -Destination $ConfigTarget -Force
  }
}

$Item = Get-Item -LiteralPath $Output
Write-Host "==> packaged: $($Item.FullName)"
Write-Host "==> config:   $(Join-Path $OutputDir "agent.toml")"
Write-Host "==> size:     $($Item.Length) bytes"
Write-Host "==> updated:  $($Item.LastWriteTime)"
