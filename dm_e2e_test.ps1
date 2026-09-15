# ─────────────────────────────────────────────────────────────
# DM interactions End-to-End API Verification (replies + reactions)
# Requires: 1) migration_phase10_dm_interactions.sql applied in Supabase
#           2) Dev server running on http://localhost:3000
# Run:      pwsh -File dm_e2e_test.ps1
#
# Artist password is read from the E2E_ARTIST_PASSWORD environment
# variable (never hardcoded/committed). Two throwaway fan accounts are
# minted and auto-confirmed via the Supabase admin API, so set
# E2E_FAN_EMAIL for the first fan (a second is derived from it):
#   $env:E2E_ARTIST_PASSWORD = "..."; $env:E2E_FAN_EMAIL = "fan@exampletest.com"; pwsh -File dm_e2e_test.ps1
# ─────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"
$base = "http://localhost:3000"
$failCount = 0

function Show($name, $ok, $detail) {
  $status = if ($ok) { "PASS" } else { "FAIL" }
  if (-not $ok) { $script:failCount++ }
  Write-Output ("[{0}] {1} :: {2}" -f $status, $name, $detail)
}

function JsonBody($obj) { $obj | ConvertTo-Json }

# ── 0. Schema probe: is the DM interactions migration applied? ──
$envMap = @{}
Get-Content (Join-Path $PSScriptRoot ".env.local") | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$') { $envMap[$Matches[1]] = $Matches[2] }
}
$migrationApplied = $false
if ($envMap["SUPABASE_URL"] -and $envMap["SUPABASE_ANON_KEY"]) {
  try {
    $null = Invoke-RestMethod -Uri "$($envMap["SUPABASE_URL"])/rest/v1/direct_messages?select=reply_to_id&limit=1" -Headers @{ apikey = $envMap["SUPABASE_ANON_KEY"]; Authorization = "Bearer $($envMap["SUPABASE_ANON_KEY"])" } -Method Get
    $migrationApplied = $true
  } catch {
    $probe = $_.ErrorDetails.Message
    $migrationApplied = $probe -match '__PGRST204__|"code":\s*"PGRST204"|204'
  }
}
Show "Schema probe: migration_phase10 applied (reply_to_id column)" $migrationApplied ("applied=$migrationApplied")
if (-not $migrationApplied) {
  Write-Output ""
  Write-Output "STOPPING: database migration not applied. Run database/migration_phase10_dm_interactions.sql"
  Write-Output "in the Supabase SQL Editor, then re-run this script."
  Write-Output ("SUMMARY (schema gate): " + (1 - $failCount) + "/1 passed, " + $failCount + " failed")
  exit $failCount
}

# ── 1. Artist login ─────────────────────────────────────────
$artistSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$artistId = $null
$loginBody = JsonBody @{ email = "kendrick@kendrickdavid.com"; password = $env:E2E_ARTIST_PASSWORD }
$resp = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -WebSession $artistSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
Show "Artist login (kendrick@ / E2E_ARTIST_PASSWORD)" ($resp.StatusCode -eq 200 -and $data.user.role -eq "artist") ("status=$($resp.StatusCode) role=$($data.user.role) error=$($data.error)")
if ($resp.StatusCode -eq 200) { $artistId = $data.user.id }

# ── 2. Create + confirm fan A ────────────────────────────────
$fanASession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$stamp = [DateTime]::UtcNow.Ticks
$fanAEmail = if ($env:E2E_FAN_EMAIL) { $env:E2E_FAN_EMAIL } else { "kd_dm_fanA_$stamp@gmail.com" }
$fanAUsername = "kd_dmA_$($stamp % 1000000)"
$signupBody = JsonBody @{
  email = $fanAEmail; password = "password123"; confirmPassword = "password123"
  username = $fanAUsername; role = "fan"
}
$resp = Invoke-WebRequest -Uri "$base/api/auth/signup" -Method POST -Body $signupBody -ContentType "application/json" -WebSession $fanASession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
$fanAId = $null
if ($resp.StatusCode -eq 201) {
  $fanAId = $data.authUserId
  try {
    $adminHeaders = @{
      apikey = $envMap["SUPABASE_SERVICE_ROLE_KEY"]
      Authorization = "Bearer $($envMap["SUPABASE_SERVICE_ROLE_KEY"])"
    }
    $null = Invoke-RestMethod -Uri "$($envMap["SUPABASE_URL"])/auth/v1/admin/users/$fanAId" -Method PUT -Headers $adminHeaders -ContentType "application/json" -UserAgent "kd-dm-e2e/1.0" -Body (@{ email_confirm = $true } | ConvertTo-Json)
  } catch { Write-Output "Fan A admin confirm error: $($_.Exception.Message)" }
  $resp = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -Body (JsonBody @{ email = $fanAEmail; password = "password123" }) -ContentType "application/json" -WebSession $fanASession -SkipHttpErrorCheck
  $data = $resp.Content | ConvertFrom-Json
  if ($resp.StatusCode -eq 200) { $fanAId = $data.user.id }
}
Show "Fan A signup + verified login" ($null -ne $fanAId) ("status=$($resp.StatusCode) id=$fanAId error=$($data.error)")
if (-not $fanAId) { Write-Output "Fan A unavailable - aborting."; exit 1 }

# ── 3. Artist sends first DM to Fan A ───────────────────────
$msg1Id = $null
$resp = Invoke-WebRequest -Uri "$base/api/dm/messages" -Method POST -Body (JsonBody @{ recipientId = $fanAId; content = "E2E: base DM $stamp" }) -ContentType "application/json" -WebSession $artistSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
$msg1Id = if ($resp.StatusCode -eq 200) { $data.message.id } else { $null }
Show "Artist sends DM to Fan A" ($resp.StatusCode -eq 200 -and $msg1Id) ("status=$($resp.StatusCode) msgId=$msg1Id error=$($data.error)")

# ── 4. Fan A replies to the artist's message (reference) ─────
$replyId = $null
$resp = Invoke-WebRequest -Uri "$base/api/dm/messages" -Method POST -Body (JsonBody @{ recipientId = $artistId; content = "E2E: reply referencing your message"; replyToId = $msg1Id }) -ContentType "application/json" -WebSession $fanASession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
$replyId = if ($resp.StatusCode -eq 200) { $data.message.id } else { $null }
Show "Fan A replies with replyToId=$msg1Id" ($resp.StatusCode -eq 200 -and $replyId -and $data.message.reply_to_id -eq $msg1Id) ("status=$($resp.StatusCode) reply_to_id=$($data.message.reply_to_id) error=$($data.error)")

# ── 5. GET the conversation shows the reference persisted ────
$conversationId = if ($replyId) { $data.message.conversation_id } else { $null }
$msg2HasRef = $false
if ($conversationId) {
  $resp = Invoke-WebRequest -Uri "$base/api/dm/messages?conversation_id=$([uri]::EscapeDataString($conversationId))" -Method GET -WebSession $fanASession -SkipHttpErrorCheck
  $data = $resp.Content | ConvertFrom-Json
  $replyMsg = $data.messages | Where-Object { $_.id -eq $replyId }
  $msg2HasRef = $null -ne $replyMsg -and $replyMsg.reply_to_id -eq $msg1Id
  Show "GET conversation persists reply reference" ($resp.StatusCode -eq 200 -and $msg2HasRef) ("status=$($resp.StatusCode) reply_to_id=$($replyMsg.reply_to_id) error=$($data.error)")
} else {
  Show "GET conversation persists reply reference" $false ("no conversationId from reply")
}

# ── 6. Fan A reacts to the artist's message ─────────────────
$reacted = $false
if ($msg1Id) {
  $resp = Invoke-WebRequest -Uri "$base/api/dm/messages/$msg1Id/reactions" -Method POST -Body (JsonBody @{ emoji = "❤️" }) -ContentType "application/json" -WebSession $fanASession -SkipHttpErrorCheck
  $data = $resp.Content | ConvertFrom-Json
  $heart = $data.reactions | Where-Object { $_.emoji -match "❤" }
  $reacted = $resp.StatusCode -eq 200 -and $null -ne $heart -and $heart.count -eq 1 -and $heart.me
  Show "Fan A reacts to artist DM (❤️)" $reacted ("status=$($resp.StatusCode) reactions=$($data.reactions | ConvertTo-Json -Compress) error=$($data.error)")
}

# ── 7. Reaction is aggregated on GET messages (both sides) ──
$artistSeesReaction = $false
$fanSeesReaction = $false
if ($conversationId) {
  $resp = Invoke-WebRequest -Uri "$base/api/dm/messages?conversation_id=$([uri]::EscapeDataString($conversationId))" -Method GET -WebSession $artistSession -SkipHttpErrorCheck
  $data = $resp.Content | ConvertFrom-Json
  $m1 = $data.messages | Where-Object { $_.id -eq $msg1Id }
  $artistSeesReaction = $null -ne $m1 -and $null -ne ($m1.reactions | Where-Object { $_.emoji -match "❤" -and $_.count -eq 1 })

  $resp = Invoke-WebRequest -Uri "$base/api/dm/messages?conversation_id=$([uri]::EscapeDataString($conversationId))" -Method GET -WebSession $fanASession -SkipHttpErrorCheck
  $data = $resp.Content | ConvertFrom-Json
  $m1 = $data.messages | Where-Object { $_.id -eq $msg1Id }
  $fanSeesReaction = $null -ne $m1 -and $null -ne ($m1.reactions | Where-Object { $_.emoji -match "❤" -and $_.count -eq 1 -and $_.me })
  Show "Reaction aggregates on GET (artist + fan views)" ($artistSeesReaction -and $fanSeesReaction) ("artist=$artistSeesReaction fan=$fanSeesReaction")
} else {
  Show "Reaction aggregates on GET (artist + fan views)" $false ("no conversationId")
}

# ── 8. Toggling the same emoji removes it ────────────────────
$removed = $false
if ($msg1Id) {
  $resp = Invoke-WebRequest -Uri "$base/api/dm/messages/$msg1Id/reactions" -Method POST -Body (JsonBody @{ emoji = "❤️" }) -ContentType "application/json" -WebSession $fanASession -SkipHttpErrorCheck
  $data = $resp.Content | ConvertFrom-Json
  $heart = $data.reactions | Where-Object { $_.emoji -match "❤" }
  $removed = $resp.StatusCode -eq 200 -and $null -eq $heart
  Show "Toggle ❤️ again removes reaction" $removed ("status=$($resp.StatusCode) reactions=$($data.reactions | ConvertTo-Json -Compress) error=$($data.error)")
}

# ── 9. Non-participant cannot react ─────────────────────────
$fanBSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$fanBEmail = if ($env:E2E_FAN_EMAIL) { $env:E2E_FAN_EMAIL -replace '@', "_b@" } else { "kd_dm_fanB_$stamp@gmail.com" }
$signupBody = JsonBody @{
  email = $fanBEmail; password = "password123"; confirmPassword = "password123"
  username = "kd_dmB_$($stamp % 1000000)"; role = "fan"
}
$resp = Invoke-WebRequest -Uri "$base/api/auth/signup" -Method POST -Body $signupBody -ContentType "application/json" -WebSession $fanBSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
$fanBId = if ($resp.StatusCode -eq 201) { $data.authUserId } else { $null }
if ($fanBId) {
  try {
    $adminHeaders = @{
      apikey = $envMap["SUPABASE_SERVICE_ROLE_KEY"]
      Authorization = "Bearer $($envMap["SUPABASE_SERVICE_ROLE_KEY"])"
    }
    $null = Invoke-RestMethod -Uri "$($envMap["SUPABASE_URL"])/auth/v1/admin/users/$fanBId" -Method PUT -Headers $adminHeaders -ContentType "application/json" -UserAgent "kd-dm-e2e/1.0" -Body (@{ email_confirm = $true } | ConvertTo-Json)
  } catch { Write-Output "Fan B admin confirm error: $($_.Exception.Message)" }
  $resp = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -Body (JsonBody @{ email = $fanBEmail; password = "password123" }) -ContentType "application/json" -WebSession $fanBSession -SkipHttpErrorCheck
  $data = $resp.Content | ConvertFrom-Json
  if ($resp.StatusCode -ne 200) { $fanBId = $null }
}
$blocked = $false
if ($fanBId -and $msg1Id) {
  $resp = Invoke-WebRequest -Uri "$base/api/dm/messages/$msg1Id/reactions" -Method POST -Body (JsonBody @{ emoji = "👍" }) -ContentType "application/json" -WebSession $fanBSession -SkipHttpErrorCheck
  $blocked = $resp.StatusCode -eq 403 -or $resp.StatusCode -eq 404
  Show "Non-participant cannot react (403/404)" $blocked ("status=$($resp.StatusCode) error=$($resp.Content)")
} else {
  Show "Non-participant cannot react (403/404)" $false ("Fan B not available")
}

# ── Summary ──────────────────────────────────────────────────
Write-Output ""
Write-Output ("SUMMARY: 9 checks, {0} passed, {1} failed" -f (9 - $failCount), $failCount)
Write-Output "FAN A EMAIL: $fanAEmail"
exit $failCount