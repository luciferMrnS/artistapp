# ─────────────────────────────────────────────────────────────
# Phase 4 End-to-End API Verification (with email-verification flow)
# Requires: 1) Supabase migrations applied (migration_phase4.sql + migration_email_verification.sql)
#           2) Dev server running on http://localhost:3000
# Run:      pwsh -File e2e_test.ps1
#
# The artist password is read from the E2E_ARTIST_PASSWORD environment
# variable (never hardcoded/committed). For the signup step it also mints a
# temporary fan account, so set E2E_FAN_EMAIL too:
#   $env:E2E_ARTIST_PASSWORD = "..."; $env:E2E_FAN_EMAIL = "fan@exampletest.com"; pwsh -File e2e_test.ps1
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

# ── 1. Artist login ─────────────────────────────────────────
$artistSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$artistId = $null
$loginBody = JsonBody @{ email = "kendrick@kendrickdavid.com"; password = $env:E2E_ARTIST_PASSWORD }
$resp = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -WebSession $artistSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
Show "Artist login (kendrick@ / E2E_ARTIST_PASSWORD)" ($resp.StatusCode -eq 200 -and $data.user.role -eq "artist") ("status=$($resp.StatusCode) role=$($data.user.role) error=$($data.error)")
if ($resp.StatusCode -eq 200) { $artistId = $data.user.id }

# ── 2. Artist creates a post ─────────────────────────────────
$postId = $null
$createBody = JsonBody @{ content = "E2E verification post - hello fans! $([DateTime]::UtcNow.ToString('o'))" }
$resp = Invoke-WebRequest -Uri "$base/api/posts/create" -Method POST -Body $createBody -ContentType "application/json" -WebSession $artistSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
Show "Artist creates post" ($resp.StatusCode -eq 201 -and $data.success) ("status=$($resp.StatusCode) error=$($data.error)")
if ($resp.StatusCode -eq 201) { $postId = $data.post.id }

# ── 3. Fan signup (requires email verification) ─────────────
$fanSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$stamp = [DateTime]::UtcNow.Ticks
$fanEmail = "kd_e2e_fan_$stamp@gmail.com"
$signupBody = JsonBody @{
  email = $fanEmail
  password = "password123"
  confirmPassword = "password123"
  username = "kd_fan_$($stamp % 1000000)"
  role = "fan"
}
$resp = Invoke-WebRequest -Uri "$base/api/auth/signup" -Method POST -Body $signupBody -ContentType "application/json" -WebSession $fanSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
$authUserId = $data.authUserId
Show "Fan signup (verification email required)" ($resp.StatusCode -eq 201 -and $data.requiresVerification -and $data.user.role -eq "fan") ("status=$($resp.StatusCode) requiresVerification=$($data.requiresVerification) role=$($data.user.role) error=$($data.error)")

# ── 4. Unverified fan cannot log in ─────────────────────────
$resp = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -Body (JsonBody @{ email = $fanEmail; password = "password123" }) -ContentType "application/json" -WebSession $fanSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
Show "Unverified fan login blocked (403)" ($resp.StatusCode -eq 403 -and $data.code -eq "EMAIL_NOT_VERIFIED") ("status=$($resp.StatusCode) code=$($data.code) error=$($data.error)")

# ── 5. Auto-confirm fan email via Supabase admin API (simulates clicking the link) ──
$envMap = @{}
Get-Content (Join-Path $PSScriptRoot ".env.local") | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$') { $envMap[$Matches[1]] = $Matches[2] }
}
$confirmed = $false
if ($authUserId -and $envMap["SUPABASE_URL"] -and $envMap["SUPABASE_SERVICE_ROLE_KEY"]) {
  try {
    $adminHeaders = @{
      apikey = $envMap["SUPABASE_SERVICE_ROLE_KEY"]
      Authorization = "Bearer $($envMap["SUPABASE_SERVICE_ROLE_KEY"])"
    }
    $null = Invoke-RestMethod -Uri "$($envMap["SUPABASE_URL"])/auth/v1/admin/users/$authUserId" -Method PUT -Headers $adminHeaders -ContentType "application/json" -UserAgent "kd-e2e-harness/1.0" -Body (@{ email_confirm = $true } | ConvertTo-Json)
    $confirmed = $true
  } catch {
    Write-Output "Admin confirm error: $($_.Exception.Message)"
  }
}

# Fan logs in (email now verified -> session cookie)
$resp = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -Body (JsonBody @{ email = $fanEmail; password = "password123" }) -ContentType "application/json" -WebSession $fanSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
Show "Fan login after email confirmation" ($confirmed -and $resp.StatusCode -eq 200 -and $data.user.role -eq "fan") ("confirmed=$confirmed status=$($resp.StatusCode) role=$($data.user.role) error=$($data.error)")

# ── 4. Fan forbidden from creating posts ─────────────────────
$resp = Invoke-WebRequest -Uri "$base/api/posts/create" -Method POST -Body (JsonBody @{ content = "I am a fan trying to post" }) -ContentType "application/json" -WebSession $fanSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
Show "Fan cannot create posts (403)" ($resp.StatusCode -eq 403) ("status=$($resp.StatusCode) error=$($data.error)")

# ── 5. Fan likes the post ────────────────────────────────────
$resp = Invoke-WebRequest -Uri "$base/api/posts/$postId/likes" -Method POST -Body "{}" -ContentType "application/json" -WebSession $fanSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
Show "Fan likes post" ($resp.StatusCode -eq 200 -and $data.liked) ("status=$($resp.StatusCode) liked=$($data.liked) error=$($data.error)")

# ── 6. Fan comments on the post ──────────────────────────────
$commentId = $null
$commentBody = JsonBody @{ content = "Great work, keep it up! $stamp" }
$resp = Invoke-WebRequest -Uri "$base/api/posts/$postId/comments" -Method POST -Body $commentBody -ContentType "application/json" -WebSession $fanSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
Show "Fan comments on post" ($resp.StatusCode -eq 201 -and $null -ne $data.comment) ("status=$($resp.StatusCode) error=$($data.error)")
if ($resp.StatusCode -eq 201) { $commentId = $data.comment.id }

# ── 7. Fan follows the artist ────────────────────────────────
$followBody = JsonBody @{ targetUserId = $artistId }
$resp = Invoke-WebRequest -Uri "$base/api/follow" -Method POST -Body $followBody -ContentType "application/json" -WebSession $fanSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
Show "Fan follows artist" ($resp.StatusCode -eq 200 -and $data.following) ("status=$($resp.StatusCode) following=$($data.following) followers=$($data.counts.followers) error=$($data.error)")
# ── 8. GET /api/posts — feed shows counts ────────────────────
$resp = Invoke-WebRequest -Uri "$base/api/posts" -Method GET -WebSession $fanSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
$matching = $data.posts | Where-Object { $_.id -eq $postId }
Show "GET /api/posts feed" ($resp.StatusCode -eq 200 -and $null -ne $matching) ("status=$($resp.StatusCode) posts=$($data.posts.Count) likes=$($matching.likes_count) comments=$($matching.comments_count) error=$($data.error)")

# ── 9. GET comments for post ─────────────────────────────────
$resp = Invoke-WebRequest -Uri "$base/api/posts/$postId/comments" -Method GET -WebSession $fanSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
Show "GET comments" ($resp.StatusCode -eq 200 -and $data.comments.Count -ge 1) ("status=$($resp.StatusCode) count=$($data.comments.Count) error=$($data.error)")

# ── 10. GET follow status ────────────────────────────────────
$resp = Invoke-WebRequest -Uri "$base/api/follow?targetUserId=$artistId" -Method GET -WebSession $fanSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
Show "GET follow status" ($resp.StatusCode -eq 200 -and $data.following) ("status=$($resp.StatusCode) following=$($data.following) followers=$($data.counts.followers) error=$($data.error)")

# ── 11. Fan deletes own comment ──────────────────────────────
$delBody = JsonBody @{ commentId = $commentId }
$resp = Invoke-WebRequest -Uri "$base/api/posts/$postId/comments" -Method DELETE -Body $delBody -ContentType "application/json" -WebSession $fanSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
Show "Fan deletes own comment" ($resp.StatusCode -eq 200 -and $data.success) ("status=$($resp.StatusCode) error=$($data.error)")

# ── 12. Fan unlikes the post ─────────────────────────────────
$resp = Invoke-WebRequest -Uri "$base/api/posts/$postId/likes" -Method DELETE -WebSession $fanSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
Show "Fan unlikes post" ($resp.StatusCode -eq 200 -and -not $data.liked) ("status=$($resp.StatusCode) liked=$($data.liked) error=$($data.error)")

# ── 13. GET /api/auth/me (fan) ───────────────────────────────
$resp = Invoke-WebRequest -Uri "$base/api/auth/me" -Method GET -WebSession $fanSession -SkipHttpErrorCheck
$data = $resp.Content | ConvertFrom-Json
Show "GET /api/auth/me (fan)" ($resp.StatusCode -eq 200 -and $data.user.role -eq "fan") ("status=$($resp.StatusCode) role=$($data.user.role) error=$($data.error)")

# ── 14. Unauthenticated request → 401 ────────────────────────
$anon = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$resp = Invoke-WebRequest -Uri "$base/api/posts" -Method GET -WebSession $anon -SkipHttpErrorCheck
Show "Unauthenticated GET /api/posts -> 401" ($resp.StatusCode -eq 401) ("status=$($resp.StatusCode)")

# ── Summary ──────────────────────────────────────────────────
Write-Output ""
Write-Output ("SUMMARY: " + (16 - $failCount) + "/16 passed, " + $failCount + " failed")
Write-Output "FAN EMAIL: $fanEmail"
exit $failCount