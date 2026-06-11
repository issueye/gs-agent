param(
    [string]$OutputDir
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path $ProjectRoot "dist\gs-llm-bridge"
}

$ResolvedOutputParent = Split-Path -Parent $OutputDir
if (-not (Test-Path $ResolvedOutputParent)) {
    New-Item -ItemType Directory -Path $ResolvedOutputParent | Out-Null
}

if (Test-Path $OutputDir) {
    Remove-Item -LiteralPath $OutputDir -Recurse -Force
}

New-Item -ItemType Directory -Path $OutputDir | Out-Null

$ExcludedDirectoryNames = @("dist")

function Should-ExcludeDirectory {
    param([System.IO.DirectoryInfo]$Directory)

    if ($ExcludedDirectoryNames -contains $Directory.Name) {
        return $true
    }

    if ($Directory.Name -eq ".data" -or $Directory.Name.StartsWith(".data-")) {
        return $true
    }

    return $false
}

function Copy-PackageItem {
    param(
        [System.IO.FileSystemInfo]$Item,
        [string]$RelativePath
    )

    if ($Item.PSIsContainer) {
        if (Should-ExcludeDirectory $Item) {
            return
        }

        $TargetDirectory = Join-Path $OutputDir $RelativePath
        New-Item -ItemType Directory -Path $TargetDirectory -Force | Out-Null

        Get-ChildItem -LiteralPath $Item.FullName -Force | ForEach-Object {
            $ChildRelativePath = if ([string]::IsNullOrEmpty($RelativePath)) {
                $_.Name
            } else {
                Join-Path $RelativePath $_.Name
            }

            Copy-PackageItem -Item $_ -RelativePath $ChildRelativePath
        }

        return
    }

    $TargetFile = Join-Path $OutputDir $RelativePath
    $TargetParent = Split-Path -Parent $TargetFile
    if (-not (Test-Path $TargetParent)) {
        New-Item -ItemType Directory -Path $TargetParent -Force | Out-Null
    }

    Copy-Item -LiteralPath $Item.FullName -Destination $TargetFile -Force
}

Get-ChildItem -LiteralPath $ProjectRoot -Force | ForEach-Object {
    Copy-PackageItem -Item $_ -RelativePath $_.Name
}

Write-Host "Packaged gs-llm-bridge to $OutputDir"
