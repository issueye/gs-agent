param(
  [switch]$SkipSqliteSmoke,
  [string]$SqliteExe = "sqlite3"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$MigrationScript = Join-Path $ScriptDir "migrate-sqlite-to-store.ps1"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) {
    throw $Message
  }
}

$tokens = $null
$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile($MigrationScript, [ref]$tokens, [ref]$parseErrors) | Out-Null
Assert-True ($parseErrors.Count -eq 0) ("PowerShell parse errors: " + ($parseErrors | ForEach-Object Message -join "; "))

$help = Get-Help $MigrationScript -Full
$helpText = $help | Out-String
foreach ($name in @("SqliteDb", "TrafficDb", "Out", "IncludeTraffic", "TrafficLimit", "Merge", "Backup", "DryRun", "SqliteExe")) {
  Assert-True ($helpText -match "(?m)^\s*-$name\b") "missing help parameter: $name"
}

$source = Get-Content -LiteralPath $MigrationScript -Raw
foreach ($label in @(
  "migration ",
  "imported providers:",
  "imported providerModels:",
  "imported endpoints:",
  "imported routingRules:",
  "imported apiKeys:",
  "imported traffic:",
  "final providers:",
  "final providerModels:",
  "final endpoints:",
  "final routingRules:",
  "final apiKeys:",
  "final traffic:"
)) {
  Assert-True ($source.Contains($label)) "missing summary label: $label"
}

$sqlite = Get-Command $SqliteExe -ErrorAction SilentlyContinue
if ($SkipSqliteSmoke -or $null -eq $sqlite) {
  Write-Host "migration static validation passed"
  if ($null -eq $sqlite) {
    Write-Host "sqlite dry-run smoke skipped: sqlite3 executable not found"
  } else {
    Write-Host "sqlite dry-run smoke skipped by -SkipSqliteSmoke"
  }
  exit 0
}

$workDir = Join-Path $ProjectRoot ".data-migration-smoke"
if (Test-Path -LiteralPath $workDir) {
  Remove-Item -LiteralPath $workDir -Recurse -Force
}
New-Item -ItemType Directory -Path $workDir | Out-Null

$managementDb = Join-Path $workDir "management.db"
$trafficDb = Join-Path $workDir "traffic.db"
$out = Join-Path $workDir "store.json"

$managementSql = @"
create table providers (id text, name text, protocol text, vendor text, base_url text, api_key_cipher text, only_stream integer, user_agent text, enabled integer, description text, created_at text, updated_at text);
create table provider_models (id text, provider_id text, name text, max_tokens integer, enabled integer, created_at text, updated_at text);
create table ingress_endpoints (id text, path text, downstream_protocol text, enabled integer, protected integer, built_in integer, description text, created_at text, updated_at text);
create table routing_rules (id text, name text, priority integer, match_protocol text, match_model_pattern text, upstream_protocol text, target_provider_id text, target_model text, enabled integer, created_at text, updated_at text);
create table api_keys (id text, name text, secret_hash text, secret_preview text, secret_cipher text, scopes text, enabled integer, expires_at text, created_at text, updated_at text);
insert into providers values ('p1','Provider One','openai-chat','openai','https://example.invalid/v1','sk-test',0,'',1,'','2024-01-01T00:00:00Z','2024-01-01T00:00:00Z');
insert into provider_models values ('m1','p1','Model One',0,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z');
insert into ingress_endpoints values ('e1','v1/chat/completions','openai-chat',1,1,1,'','2024-01-01T00:00:00Z','2024-01-01T00:00:00Z');
insert into routing_rules values ('r1','Rule One',100,'openai-chat','*','openai-chat','p1','m1',1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z');
insert into api_keys values ('k1','Key One','','','secret-one','admin,proxy',1,'','2024-01-01T00:00:00Z','2024-01-01T00:00:00Z');
"@
$trafficSql = @"
create table traffic_records (id text, request_id text, endpoint text, method text, client_ip text, user_agent text, content_type text, upstream_protocol text, downstream_protocol text, route_name text, route_source text, matched_rule_id text, matched_rule_name text, request_model text, model text, request_body text, request_body_bytes integer, request_body_truncated integer, status_code integer, duration_ms integer, input_tokens integer, output_tokens integer, total_tokens integer, error text, created_at text);
insert into traffic_records values ('t1','req-1','/v1/chat/completions','POST','127.0.0.1','','application/json','openai-chat','openai-chat','Rule One','rule','r1','Rule One','m1','m1','{""model"":""m1""}',14,0,200,12,3,4,7,'','2024-01-01T00:00:00Z');
"@

& $SqliteExe $managementDb $managementSql
Assert-True ($LASTEXITCODE -eq 0) "failed to create management smoke database"
& $SqliteExe $trafficDb $trafficSql
Assert-True ($LASTEXITCODE -eq 0) "failed to create traffic smoke database"

$output = & $MigrationScript `
  -SqliteDb $managementDb `
  -TrafficDb $trafficDb `
  -Out $out `
  -IncludeTraffic true `
  -TrafficLimit 1 `
  -DryRun `
  -SqliteExe $SqliteExe 2>&1

Assert-True ($LASTEXITCODE -eq 0) "migration dry-run smoke failed"
$outputText = [string]::Join("`n", $output)
foreach ($expected in @(
  "migration dry-run",
  "imported providers: 1",
  "imported providerModels: 1",
  "imported endpoints: 1",
  "imported routingRules: 1",
  "imported apiKeys: 1",
  "imported traffic: 1"
)) {
  Assert-True ($outputText.Contains($expected)) "missing dry-run output: $expected"
}
Assert-True (-not (Test-Path -LiteralPath $out)) "dry-run should not write store.json"

Write-Host "migration static validation passed"
Write-Host "migration sqlite dry-run smoke passed"
