<#
.SYNOPSIS
Migrates icoo_llm_bridge SQLite data into the gs-llm-bridge JSON store.

.DESCRIPTION
Reads the source management SQLite database, optionally reads the traffic
SQLite database, normalizes legacy protocol names, and writes or dry-runs the
target `.data/store.json` shape used by gs-llm-bridge.

The script merges into an existing store by default and creates a timestamped
backup before overwriting the output file. Use -DryRun to validate source data
and print counts without writing.

.PARAMETER SqliteDb
Path to the source management SQLite database.

.PARAMETER TrafficDb
Path to the source traffic SQLite database.

.PARAMETER Out
Path to the target gs-llm-bridge store JSON file.

.PARAMETER IncludeTraffic
Import traffic records when true. Accepted values include true/false, 1/0,
and yes/no.

.PARAMETER TrafficLimit
Maximum number of traffic rows to import. Zero means no explicit limit.

.PARAMETER Merge
Merge source rows into the existing store when true. When false, replace the
store arrays with migrated rows plus the default store shape.

.PARAMETER Backup
Create a timestamped `.bak` copy beside an existing output file before writing.

.PARAMETER DryRun
Print validation and count output without writing the target store.

.PARAMETER SqliteExe
sqlite3 executable name or path.

.EXAMPLE
.\scripts\migrate-sqlite-to-store.ps1 -DryRun

Validates the default source database and prints migration counts without
writing `.data/store.json`.

.EXAMPLE
.\scripts\migrate-sqlite-to-store.ps1 `
  -SqliteDb E:\codes\icoo_proxy\icoo_llm_bridge\.data\icoo_llm_bridge.db `
  -TrafficDb E:\codes\icoo_proxy\icoo_llm_bridge\.data\icoo_llm_bridge_traffic.db `
  -Out E:\codes\gts_codes\gs-llm-bridge\.data\store.json `
  -IncludeTraffic true `
  -TrafficLimit 2000 `
  -DryRun

Runs a full validation, including recent traffic, without writing.
#>
param(
  [string]$SqliteDb = "E:\codes\icoo_proxy\icoo_llm_bridge\.data\icoo_llm_bridge.db",
  [string]$TrafficDb = "E:\codes\icoo_proxy\icoo_llm_bridge\.data\icoo_llm_bridge_traffic.db",
  [string]$Out = ".data\store.json",
  [object]$IncludeTraffic = $false,
  [int]$TrafficLimit = 0,
  [object]$Merge = $true,
  [object]$Backup = $true,
  [switch]$DryRun,
  [string]$SqliteExe = "sqlite3"
)

$ErrorActionPreference = "Stop"

function NowIso {
  return (Get-Date).ToUniversalTime().ToString("o")
}

function Normalize-Protocol {
  param([object]$Value)
  $text = ""
  if ($null -ne $Value) {
    $text = [string]$Value
  }
  switch ($text) {
    "openai-chat" { return "openai_chat" }
    "openai_chat" { return "openai_chat" }
    "openai-responses" { return "openai_responses" }
    "openai_responses" { return "openai_responses" }
    "anthropic" { return "anthropic" }
    default { return $text }
  }
}

function Convert-ToBool {
  param([object]$Value, [bool]$Default = $true)
  if ($null -eq $Value) {
    return $Default
  }
  if ($Value -is [bool]) {
    return $Value
  }
  $text = ([string]$Value).Trim().ToLowerInvariant()
  if ($text -eq "1" -or $text -eq "true" -or $text -eq "yes") {
    return $true
  }
  if ($text -eq "0" -or $text -eq "false" -or $text -eq "no") {
    return $false
  }
  return $Default
}

function Normalize-Time {
  param([object]$Value)
  if ($null -eq $Value -or [string]$Value -eq "") {
    return (NowIso)
  }
  $text = [string]$Value
  $parsed = [DateTimeOffset]::MinValue
  if ([DateTimeOffset]::TryParse($text, [ref]$parsed)) {
    return $parsed.ToUniversalTime().ToString("o")
  }
  return $text
}

function Normalize-EndpointPath {
  param([object]$Value)
  $text = ""
  if ($null -ne $Value) {
    $text = [string]$Value
  }
  $text = $text.Trim()
  $query = $text.IndexOf("?")
  if ($query -ge 0) {
    $text = $text.Substring(0, $query)
  }
  if ($text -eq "") {
    return ""
  }
  if (-not $text.StartsWith("/")) {
    $text = "/" + $text
  }
  while ($text.Length -gt 1 -and $text.EndsWith("/")) {
    $text = $text.Substring(0, $text.Length - 1)
  }
  return $text
}

function Read-JsonFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }
  $raw = Get-Content -LiteralPath $Path -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $null
  }
  return $raw | ConvertFrom-Json
}

function New-DefaultStore {
  $createdAt = NowIso
  return [ordered]@{
    providers = @()
    providerModels = @()
    endpoints = @(
      [ordered]@{ id = "anthropic-messages"; path = "/v1/messages"; downstream_protocol = "anthropic"; enabled = $true; protected = $true; description = "Anthropic Messages compatible endpoint"; created_at = $createdAt; updated_at = $createdAt },
      [ordered]@{ id = "openai-chat-completions"; path = "/v1/chat/completions"; downstream_protocol = "openai_chat"; enabled = $true; protected = $true; description = "OpenAI Chat Completions compatible endpoint"; created_at = $createdAt; updated_at = $createdAt },
      [ordered]@{ id = "openai-responses"; path = "/v1/responses"; downstream_protocol = "openai_responses"; enabled = $true; protected = $true; description = "OpenAI Responses compatible endpoint"; created_at = $createdAt; updated_at = $createdAt }
    )
    routingRules = @()
    apiKeys = @(
      [ordered]@{ id = "local-admin"; name = "Local Admin"; secret = "local-admin"; scopes = "admin,proxy"; enabled = $true; created_at = $createdAt; updated_at = $createdAt }
    )
    traffic = @()
  }
}

function Ensure-StoreShape {
  param([object]$Store)
  if ($null -eq $Store) {
    return (New-DefaultStore)
  }
  $default = New-DefaultStore
  foreach ($name in @("providers", "providerModels", "endpoints", "routingRules", "apiKeys", "traffic")) {
    if (-not ($Store.PSObject.Properties.Name -contains $name) -or $null -eq $Store.$name) {
      $Store | Add-Member -NotePropertyName $name -NotePropertyValue $default[$name] -Force
    }
  }
  return $Store
}

function As-Array {
  param([object]$Value)
  if ($null -eq $Value) {
    return @()
  }
  if ($Value -is [array]) {
    return $Value
  }
  return @($Value)
}

function Upsert-ByKey {
  param([object[]]$Existing, [object[]]$Incoming, [scriptblock]$Key)
  $map = [ordered]@{}
  foreach ($item in (As-Array $Existing)) {
    $map[[string](& $Key $item)] = $item
  }
  foreach ($item in (As-Array $Incoming)) {
    $map[[string](& $Key $item)] = $item
  }
  return @($map.Values)
}

function Get-Prop {
  param([object]$Row, [string]$Name, [object]$Default = "")
  if ($null -eq $Row) {
    return $Default
  }
  if ($Row.PSObject.Properties.Name -contains $Name) {
    $value = $Row.$Name
    if ($null -ne $value) {
      return $value
    }
  }
  return $Default
}

function Convert-RequestBody {
  param([object]$Value, [string]$Id, [System.Collections.Generic.List[string]]$Warnings)
  if ($null -eq $Value -or [string]$Value -eq "") {
    return @{}
  }
  if ($Value -isnot [string]) {
    return $Value
  }
  try {
    return ([string]$Value | ConvertFrom-Json)
  } catch {
    $Warnings.Add("traffic $Id has non-json request_body; keeping raw string")
    return [string]$Value
  }
}

function Invoke-SqliteJson {
  param([string]$Database, [string]$Sqlite, [string]$Query)
  $json = & $Sqlite -readonly -json $Database $Query
  if ($LASTEXITCODE -ne 0) {
    throw "sqlite3 query failed for $Database"
  }
  $text = [string]::Join("`n", $json)
  if ([string]::IsNullOrWhiteSpace($text)) {
    return @()
  }
  return @(($text | ConvertFrom-Json))
}

function Read-SourceTables {
  param([string]$ManagementDb, [string]$TrafficDbPath, [bool]$WithTraffic, [int]$Limit, [string]$Sqlite)
  $tables = [ordered]@{
    providers = Invoke-SqliteJson $ManagementDb $Sqlite "select * from providers;"
    provider_models = Invoke-SqliteJson $ManagementDb $Sqlite "select * from provider_models;"
    ingress_endpoints = Invoke-SqliteJson $ManagementDb $Sqlite "select * from ingress_endpoints;"
    routing_rules = Invoke-SqliteJson $ManagementDb $Sqlite "select * from routing_rules;"
    api_keys = Invoke-SqliteJson $ManagementDb $Sqlite "select * from api_keys;"
    traffic_records = @()
  }
  if ($WithTraffic) {
    if (-not (Test-Path -LiteralPath $TrafficDbPath)) {
      throw "traffic db not found: $TrafficDbPath"
    }
    $query = "select * from traffic_records order by created_at desc"
    if ($Limit -gt 0) {
      $query = $query + " limit " + [string]$Limit
    }
    $tables.traffic_records = Invoke-SqliteJson $TrafficDbPath $Sqlite ($query + ";")
  }
  return $tables
}

function Convert-SourceToStore {
  param([object]$Tables, [System.Collections.Generic.List[string]]$Warnings)
  $providerIds = @{}
  $providers = @()
  foreach ($row in (As-Array $Tables.providers)) {
    $id = [string](Get-Prop $row "id")
    if ($id -eq "") {
      $Warnings.Add("provider row without id skipped")
      continue
    }
    $providerIds[$id] = $true
    $providers += [ordered]@{
      id = $id
      name = [string](Get-Prop $row "name" $id)
      protocol = Normalize-Protocol (Get-Prop $row "protocol" "openai-chat")
      vendor = [string](Get-Prop $row "vendor" "openai")
      base_url = [string](Get-Prop $row "base_url")
      api_key = [string](Get-Prop $row "api_key_cipher")
      only_stream = Convert-ToBool (Get-Prop $row "only_stream" $false) $false
      user_agent = [string](Get-Prop $row "user_agent")
      enabled = Convert-ToBool (Get-Prop $row "enabled" $true) $true
      description = [string](Get-Prop $row "description")
      created_at = Normalize-Time (Get-Prop $row "created_at")
      updated_at = Normalize-Time (Get-Prop $row "updated_at")
    }
  }

  $providerModels = @()
  foreach ($row in (As-Array $Tables.provider_models)) {
    $id = [string](Get-Prop $row "id")
    $providerId = [string](Get-Prop $row "provider_id")
    if ($id -eq "" -or $providerId -eq "") {
      $Warnings.Add("provider model row without id/provider_id skipped")
      continue
    }
    if (-not $providerIds.ContainsKey($providerId)) {
      $Warnings.Add("provider model $id references missing provider $providerId; skipped")
      continue
    }
    $maxTokens = [int](Get-Prop $row "max_tokens" 0)
    if ($maxTokens -le 0) {
      $maxTokens = 32768
    }
    $providerModels += [ordered]@{
      id = $id
      provider_id = $providerId
      name = [string](Get-Prop $row "name" $id)
      max_tokens = $maxTokens
      enabled = Convert-ToBool (Get-Prop $row "enabled" $true) $true
      created_at = Normalize-Time (Get-Prop $row "created_at")
      updated_at = Normalize-Time (Get-Prop $row "updated_at")
    }
  }

  $endpoints = @()
  foreach ($row in (As-Array $Tables.ingress_endpoints)) {
    $id = [string](Get-Prop $row "id")
    if ($id -eq "") {
      $Warnings.Add("endpoint row without id skipped")
      continue
    }
    $endpoints += [ordered]@{
      id = $id
      path = Normalize-EndpointPath (Get-Prop $row "path")
      downstream_protocol = Normalize-Protocol (Get-Prop $row "downstream_protocol" "openai-chat")
      enabled = Convert-ToBool (Get-Prop $row "enabled" $true) $true
      protected = Convert-ToBool (Get-Prop $row "protected" $true) $true
      description = [string](Get-Prop $row "description")
      created_at = Normalize-Time (Get-Prop $row "created_at")
      updated_at = Normalize-Time (Get-Prop $row "updated_at")
    }
  }

  $routingRules = @()
  foreach ($row in (As-Array $Tables.routing_rules)) {
    $id = [string](Get-Prop $row "id")
    $providerId = [string](Get-Prop $row "target_provider_id")
    if ($id -eq "") {
      $Warnings.Add("routing rule row without id skipped")
      continue
    }
    if ($providerId -ne "" -and -not $providerIds.ContainsKey($providerId)) {
      $Warnings.Add("routing rule $id references missing provider $providerId; skipped")
      continue
    }
    $routingRules += [ordered]@{
      id = $id
      name = [string](Get-Prop $row "name" $id)
      priority = [int](Get-Prop $row "priority" 100)
      match_protocol = Normalize-Protocol (Get-Prop $row "match_protocol")
      match_model_pattern = [string](Get-Prop $row "match_model_pattern" "*")
      upstream_protocol = Normalize-Protocol (Get-Prop $row "upstream_protocol")
      target_provider_id = $providerId
      target_model = [string](Get-Prop $row "target_model")
      enabled = Convert-ToBool (Get-Prop $row "enabled" $true) $true
      created_at = Normalize-Time (Get-Prop $row "created_at")
      updated_at = Normalize-Time (Get-Prop $row "updated_at")
    }
  }

  $apiKeys = @()
  foreach ($row in (As-Array $Tables.api_keys)) {
    $id = [string](Get-Prop $row "id")
    if ($id -eq "") {
      $Warnings.Add("api key row without id skipped")
      continue
    }
    $secret = [string](Get-Prop $row "secret_cipher")
    $enabled = Convert-ToBool (Get-Prop $row "enabled" $true) $true
    if ($secret -eq "" -and [string](Get-Prop $row "secret_hash") -ne "") {
      $Warnings.Add("api key $id has secret_hash but no secret_cipher; disabling migrated key")
      $enabled = $false
    }
    $apiKeys += [ordered]@{
      id = $id
      name = [string](Get-Prop $row "name" $id)
      secret = $secret
      scopes = [string](Get-Prop $row "scopes" "proxy")
      enabled = $enabled
      created_at = Normalize-Time (Get-Prop $row "created_at")
      updated_at = Normalize-Time (Get-Prop $row "updated_at")
    }
  }

  $traffic = @()
  foreach ($row in (As-Array $Tables.traffic_records)) {
    $id = [string](Get-Prop $row "id")
    if ($id -eq "") {
      $id = [string](Get-Prop $row "request_id")
    }
    if ($id -eq "") {
      $Warnings.Add("traffic row without id/request_id skipped")
      continue
    }
    $traffic += [ordered]@{
      id = $id
      request_id = [string](Get-Prop $row "request_id" $id)
      endpoint = [string](Get-Prop $row "endpoint")
      method = [string](Get-Prop $row "method")
      client_ip = [string](Get-Prop $row "client_ip")
      user_agent = [string](Get-Prop $row "user_agent")
      content_type = [string](Get-Prop $row "content_type")
      upstream_protocol = Normalize-Protocol (Get-Prop $row "upstream_protocol")
      downstream_protocol = Normalize-Protocol (Get-Prop $row "downstream_protocol")
      route_name = [string](Get-Prop $row "route_name")
      route_source = [string](Get-Prop $row "route_source")
      matched_rule_id = [string](Get-Prop $row "matched_rule_id")
      matched_rule_name = [string](Get-Prop $row "matched_rule_name")
      requested_model = [string](Get-Prop $row "request_model")
      model = [string](Get-Prop $row "model")
      request_body = Convert-RequestBody (Get-Prop $row "request_body") $id $Warnings
      request_body_bytes = [int](Get-Prop $row "request_body_bytes" 0)
      request_body_truncated = Convert-ToBool (Get-Prop $row "request_body_truncated" $false) $false
      status_code = [int](Get-Prop $row "status_code" 0)
      duration_ms = [int](Get-Prop $row "duration_ms" 0)
      input_tokens = [int](Get-Prop $row "input_tokens" 0)
      output_tokens = [int](Get-Prop $row "output_tokens" 0)
      total_tokens = [int](Get-Prop $row "total_tokens" 0)
      error = [string](Get-Prop $row "error")
      created_at = Normalize-Time (Get-Prop $row "created_at")
    }
  }

  return [ordered]@{
    providers = $providers
    providerModels = $providerModels
    endpoints = $endpoints
    routingRules = $routingRules
    apiKeys = $apiKeys
    traffic = $traffic
  }
}

function Merge-Store {
  param([object]$Base, [object]$Incoming, [bool]$ShouldMerge)
  if (-not $ShouldMerge) {
    return [ordered]@{
      providers = @(As-Array $Incoming.providers)
      providerModels = @(As-Array $Incoming.providerModels)
      endpoints = @(As-Array $Incoming.endpoints)
      routingRules = @(As-Array $Incoming.routingRules)
      apiKeys = @(As-Array $Incoming.apiKeys)
      traffic = @(As-Array $Incoming.traffic)
    }
  }
  $store = Ensure-StoreShape $Base
  $store.providers = Upsert-ByKey (As-Array $store.providers) (As-Array $Incoming.providers) { param($item) $item.id }
  $store.providerModels = Upsert-ByKey (As-Array $store.providerModels) (As-Array $Incoming.providerModels) { param($item) ([string]$item.provider_id) + "/" + ([string]$item.id) }
  $store.endpoints = Upsert-ByKey (As-Array $store.endpoints) (As-Array $Incoming.endpoints) { param($item) $item.id }
  $store.routingRules = Upsert-ByKey (As-Array $store.routingRules) (As-Array $Incoming.routingRules) { param($item) $item.id }
  $store.apiKeys = Upsert-ByKey (As-Array $store.apiKeys) (As-Array $Incoming.apiKeys) { param($item) $item.id }
  $store.traffic = Upsert-ByKey (As-Array $store.traffic) (As-Array $Incoming.traffic) { param($item) if ([string]$item.id -ne "") { $item.id } else { $item.request_id } }
  return $store
}

function Write-StoreJson {
  param([object]$Store, [string]$Path, [bool]$ShouldBackup)
  $full = [System.IO.Path]::GetFullPath($Path)
  $dir = [System.IO.Path]::GetDirectoryName($full)
  if (-not [string]::IsNullOrEmpty($dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  if ($ShouldBackup -and (Test-Path -LiteralPath $full)) {
    $stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
    Copy-Item -LiteralPath $full -Destination ($full + "." + $stamp + ".bak") -Force
  }
  $json = $Store | ConvertTo-Json -Depth 100
  $tmp = $full + ".tmp"
  Set-Content -LiteralPath $tmp -Value $json -Encoding UTF8
  Move-Item -LiteralPath $tmp -Destination $full -Force
}

function Write-Summary {
  param([object]$Incoming, [object]$FinalStore, [System.Collections.Generic.List[string]]$Warnings, [bool]$IsDryRun)
  $mode = if ($IsDryRun) { "dry-run" } else { "written" }
  Write-Host "migration $mode"
  Write-Host ("imported providers: " + (As-Array $Incoming.providers).Count)
  Write-Host ("imported providerModels: " + (As-Array $Incoming.providerModels).Count)
  Write-Host ("imported endpoints: " + (As-Array $Incoming.endpoints).Count)
  Write-Host ("imported routingRules: " + (As-Array $Incoming.routingRules).Count)
  Write-Host ("imported apiKeys: " + (As-Array $Incoming.apiKeys).Count)
  Write-Host ("imported traffic: " + (As-Array $Incoming.traffic).Count)
  Write-Host ("final providers: " + (As-Array $FinalStore.providers).Count)
  Write-Host ("final providerModels: " + (As-Array $FinalStore.providerModels).Count)
  Write-Host ("final endpoints: " + (As-Array $FinalStore.endpoints).Count)
  Write-Host ("final routingRules: " + (As-Array $FinalStore.routingRules).Count)
  Write-Host ("final apiKeys: " + (As-Array $FinalStore.apiKeys).Count)
  Write-Host ("final traffic: " + (As-Array $FinalStore.traffic).Count)
  foreach ($warning in $Warnings) {
    Write-Warning $warning
  }
}

function Invoke-Migration {
  param(
    [string]$ManagementDb,
    [string]$TrafficDbPath,
    [string]$OutputPath,
    [bool]$WithTraffic,
    [int]$Limit,
    [bool]$ShouldMerge,
    [bool]$ShouldBackup,
    [bool]$IsDryRun,
    [string]$Sqlite
  )
  if (-not (Test-Path -LiteralPath $ManagementDb)) {
    throw "sqlite db not found: $ManagementDb"
  }
  if (-not (Get-Command $Sqlite -ErrorAction SilentlyContinue)) {
    throw "sqlite executable not found: $Sqlite. Install sqlite3 or pass -SqliteExe <path>."
  }
  $warnings = [System.Collections.Generic.List[string]]::new()
  $tables = Read-SourceTables $ManagementDb $TrafficDbPath $WithTraffic $Limit $Sqlite
  $incoming = Convert-SourceToStore $tables $warnings
  $base = if ($ShouldMerge) { Ensure-StoreShape (Read-JsonFile $OutputPath) } else { New-DefaultStore }
  $final = Merge-Store $base $incoming $ShouldMerge
  if (-not $IsDryRun) {
    Write-StoreJson $final $OutputPath $ShouldBackup
  }
  Write-Summary $incoming $final $warnings $IsDryRun
  return $final
}

if ($MyInvocation.InvocationName -ne ".") {
  Invoke-Migration `
    -ManagementDb $SqliteDb `
    -TrafficDbPath $TrafficDb `
    -OutputPath $Out `
    -WithTraffic (Convert-ToBool $IncludeTraffic $false) `
    -Limit $TrafficLimit `
    -ShouldMerge (Convert-ToBool $Merge $true) `
    -ShouldBackup (Convert-ToBool $Backup $true) `
    -IsDryRun ([bool]$DryRun) `
    -Sqlite $SqliteExe | Out-Null
}
