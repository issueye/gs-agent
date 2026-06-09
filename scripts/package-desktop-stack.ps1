param(
  [string]$OutputDir = "dist\desktop-stack",
  [string]$GsExe = "gts\dist\gs.exe",
  [switch]$SkipBuild,
  [switch]$SkipDesktopBuild,
  [switch]$SkipAgentSmoke,
  [switch]$IncludeLocalAgentConfig,
  [switch]$Zip
)

$ErrorActionPreference = "Stop"

function Resolve-RepoPath([string]$PathValue) {
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }
  return [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $PathValue))
}

function Copy-DirectoryClean([string]$Source, [string]$Destination) {
  if (Test-Path -LiteralPath $Destination) {
    Remove-Item -LiteralPath $Destination -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
}

function Copy-File([string]$Source, [string]$Destination) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

function Remove-PathRobust([string]$PathValue, [int]$Retries = 5) {
  if (!(Test-Path -LiteralPath $PathValue)) {
    return
  }

  for ($Attempt = 1; $Attempt -le $Retries; $Attempt += 1) {
    try {
      Remove-Item -LiteralPath $PathValue -Recurse -Force -ErrorAction Stop
    } catch {
      if ($Attempt -eq $Retries) {
        $Items = @(Get-ChildItem -LiteralPath $PathValue -Force -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName -Descending)
        foreach ($Item in $Items) {
          Remove-Item -LiteralPath $Item.FullName -Recurse -Force -ErrorAction SilentlyContinue
        }
        Remove-Item -LiteralPath $PathValue -Recurse -Force -ErrorAction SilentlyContinue
      }
    }

    if (!(Test-Path -LiteralPath $PathValue)) {
      return
    }
    Start-Sleep -Milliseconds (160 * $Attempt)
  }

  throw "Unable to remove path. Close apps that may be using it and retry: $PathValue"
}

function Write-Utf8NoBom([string]$PathValue, [string]$Content) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $PathValue) | Out-Null
  [System.IO.File]::WriteAllText($PathValue, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Assert-LastExitCode([string]$StepName) {
  if ($LASTEXITCODE -ne 0) {
    throw "$StepName failed with exit code $LASTEXITCODE"
  }
}

function Stop-ProcessesUnderPath([string]$PathValue) {
  if (!(Test-Path -LiteralPath $PathValue)) {
    return
  }

  $FullPath = [System.IO.Path]::GetFullPath($PathValue).TrimEnd('\')
  $Processes = @(Get-Process | Where-Object {
    try {
      $_.Path -and [System.IO.Path]::GetFullPath($_.Path).StartsWith($FullPath, [System.StringComparison]::OrdinalIgnoreCase)
    } catch {
      $false
    }
  })
  if ($Processes.Count -eq 0) {
    return
  }

  Write-Host "==> stopping running bundle processes"
  foreach ($Process in $Processes) {
    Stop-Process -Id $Process.Id -Force
  }
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
$OutputDir = Resolve-RepoPath $OutputDir
$GsExe = Resolve-RepoPath $GsExe

$DesktopRoot = Join-Path $RepoRoot "desktop"
$GatewayRoot = Join-Path $RepoRoot "gs-gateway"
$AgentRoot = Join-Path $RepoRoot "gs-agent"
$PackageWorkDir = Join-Path $RepoRoot "dist\.package-work"
$AgentPackageDir = Join-Path $PackageWorkDir "gs-agent"
$GatewayPackageDir = Join-Path $PackageWorkDir "gs-gateway"

Write-Host "==> repo:    $RepoRoot"
Write-Host "==> output:  $OutputDir"
Write-Host "==> gs:      $GsExe"

if (!(Test-Path -LiteralPath $GsExe)) {
  throw "GoScript executable not found: $GsExe"
}

if (!$SkipBuild) {
  if (Test-Path -LiteralPath $PackageWorkDir) {
    Remove-Item -LiteralPath $PackageWorkDir -Recurse -Force
  }

  if (!$SkipDesktopBuild) {
    Write-Host "==> building desktop"
    $DesktopBindingsDir = Join-Path $DesktopRoot "frontend\bindings"
    Remove-PathRobust $DesktopBindingsDir
    Push-Location $DesktopRoot
    try {
      & wails3 build
      Assert-LastExitCode "desktop build"
    } finally {
      Pop-Location
    }
  } else {
    Write-Host "==> skipping desktop build"
  }

  Write-Host "==> packaging agent"
  $AgentToml = Join-Path $AgentRoot "agent.toml"
  $TempAgentTomlCreated = $false
  if (!(Test-Path -LiteralPath $AgentToml)) {
    $AgentExampleToml = Join-Path $AgentRoot "agent.local.example.toml"
    if (!(Test-Path -LiteralPath $AgentExampleToml)) {
      throw "Agent config template not found: $AgentExampleToml"
    }
    Copy-Item -LiteralPath $AgentExampleToml -Destination $AgentToml -Force
    $TempAgentTomlCreated = $true
  }
  try {
    $AgentPackageArgs = @(
      "-ExecutionPolicy", "Bypass",
      "-File", (Join-Path $AgentRoot "scripts\package.ps1"),
      "-GsExe", $GsExe,
      "-Output", (Join-Path $AgentPackageDir "gs-agent.exe")
    )
    if ($SkipAgentSmoke) {
      $AgentPackageArgs += "-SkipSmoke"
    }
    & powershell @AgentPackageArgs
    Assert-LastExitCode "agent package"
  } finally {
    if ($TempAgentTomlCreated -and (Test-Path -LiteralPath $AgentToml)) {
      Remove-Item -LiteralPath $AgentToml -Force
    }
  }

  Write-Host "==> packaging gateway"
  & powershell -ExecutionPolicy Bypass -File (Join-Path $GatewayRoot "scripts\package.ps1") `
    -GsExe $GsExe `
    -AgentDist $AgentPackageDir `
    -Output (Join-Path $GatewayPackageDir "gs-gateway.exe")
  Assert-LastExitCode "gateway package"
}

$DesktopExe = Join-Path $DesktopRoot "bin\desktop.exe"
$GatewayExe = Join-Path $GatewayPackageDir "gs-gateway.exe"
$AgentGatewayTask = Join-Path $GatewayPackageDir "gs-agent\gateway-task.gs"

foreach ($RequiredPath in @($DesktopExe, $GatewayExe, $AgentGatewayTask)) {
  if (!(Test-Path -LiteralPath $RequiredPath)) {
    throw "Required build output not found: $RequiredPath"
  }
}

Write-Host "==> assembling release"
Stop-ProcessesUnderPath $OutputDir
if (Test-Path -LiteralPath $OutputDir) {
  Remove-PathRobust $OutputDir
}
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Copy-File $DesktopExe (Join-Path $OutputDir "desktop.exe")
Copy-DirectoryClean $GatewayPackageDir (Join-Path $OutputDir "gateway")

$GatewayDataDir = Join-Path $OutputDir "gateway\.gateway"
if (Test-Path -LiteralPath $GatewayDataDir) {
  Remove-Item -LiteralPath $GatewayDataDir -Recurse -Force
}

$AgentRuntimeDir = Join-Path $OutputDir "gateway\gs-agent\.agent"
if (Test-Path -LiteralPath $AgentRuntimeDir) {
  Remove-Item -LiteralPath $AgentRuntimeDir -Recurse -Force
}

$AgentWorkspaceDir = Join-Path $OutputDir "gateway\gs-agent\workspace"
if (Test-Path -LiteralPath $AgentWorkspaceDir) {
  Remove-Item -LiteralPath $AgentWorkspaceDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $AgentWorkspaceDir | Out-Null

$AgentLocalConfig = Join-Path $OutputDir "gateway\gs-agent\agent.local.toml"
if (!$IncludeLocalAgentConfig -and (Test-Path -LiteralPath $AgentLocalConfig)) {
  Remove-Item -LiteralPath $AgentLocalConfig -Force
}

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
Write-Utf8NoBom (Join-Path $OutputDir "gateway\gateway.toml") $GatewayConfig

$StartScript = @'
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$GatewayDir = Join-Path $Root "gateway"
$GatewayExe = Join-Path $GatewayDir "gs-gateway.exe"
$DesktopExe = Join-Path $Root "desktop.exe"

if (!(Test-Path -LiteralPath $GatewayExe)) {
  throw "Gateway executable not found: $GatewayExe"
}
if (!(Test-Path -LiteralPath $DesktopExe)) {
  throw "Desktop executable not found: $DesktopExe"
}

$Existing = Get-NetTCPConnection -LocalPort 18878 -State Listen -ErrorAction SilentlyContinue
if (!$Existing) {
  Start-Process -FilePath $GatewayExe -ArgumentList "--timeout","0","run" -WorkingDirectory $GatewayDir -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

Start-Process -FilePath $DesktopExe -WorkingDirectory $Root
'@
Write-Utf8NoBom (Join-Path $OutputDir "start.ps1") $StartScript

$Readme = @(
  "# Desktop Stack",
  "",
  "Contents:",
  "- desktop.exe: desktop app",
  "- gateway/gs-gateway.exe: gateway",
  "- gateway/gs-agent/gs-agent.exe: agent",
  "",
  "Start:",
  "powershell -ExecutionPolicy Bypass -File .\start.ps1",
  "",
  "Configuration:",
  "- Gateway config: gateway/gateway.toml",
  "- Agent config: gateway/gs-agent/agent.toml",
  "- To include local agent.local.toml, rerun the package script with -IncludeLocalAgentConfig.",
  "",
  "Notes:",
  "- Runtime database, logs, sessions, and workspace content are excluded by default.",
  "- The default gateway port is 18878."
) -join [Environment]::NewLine
Write-Utf8NoBom (Join-Path $OutputDir "README.md") $Readme

if ($Zip) {
  $ZipPath = "$OutputDir.zip"
  if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
  }
  Compress-Archive -Path (Join-Path $OutputDir "*") -DestinationPath $ZipPath -Force
  Write-Host "==> zip:     $ZipPath"
}

Write-Host "==> done:    $OutputDir"
Write-Host "==> start:   powershell -ExecutionPolicy Bypass -File `"$OutputDir\start.ps1`""
