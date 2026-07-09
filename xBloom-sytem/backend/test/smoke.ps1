# End-to-end API smoke test (26 checks across auth, warranties, tickets,
# machines, dashboard, products, export, logs, global claims, role guards).
# Requires the DEV seed data (admin PIN 0001): run `npm run db:seed` first.
# After `npm run db:import` (real data) the seed PINs differ — re-seed to use this.
#   pwsh -File backend/test/smoke.ps1
$ErrorActionPreference = "Stop"
$base = "http://localhost:8080"
$pass = 0; $fail = 0
function Check($name, [scriptblock]$fn) {
  try { & $fn; Write-Host "PASS  $name" -ForegroundColor Green; $script:pass++ }
  catch { Write-Host "FAIL  $name -> $($_.Exception.Message)" -ForegroundColor Red; $script:fail++ }
}
function ExpectErr($name, $code, [scriptblock]$fn) {
  try { & $fn; Write-Host "FAIL  $name -> expected $code but succeeded" -ForegroundColor Red; $script:fail++ }
  catch {
    $got = $_.Exception.Response.StatusCode.value__
    if ($got -eq $code) { Write-Host "PASS  $name (got $code)" -ForegroundColor Green; $script:pass++ }
    else { Write-Host "FAIL  $name -> expected $code got $got" -ForegroundColor Red; $script:fail++ }
  }
}

# 1. login
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"name":"Admin","pin":"0001"}'
$token = $login.token
$H = @{ Authorization = "Bearer $token" }
Check "login returns token" { if (-not $token) { throw "no token" } }
ExpectErr "login wrong pin -> 401" 401 { Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"name":"Admin","pin":"9999"}' }

# 2. me
Check "GET /auth/me" { $me = Invoke-RestMethod -Uri "$base/auth/me" -Headers $H; if ($me.user.role -ne "admin") { throw "role" } }
ExpectErr "GET /auth/me no token -> 401" 401 { Invoke-RestMethod -Uri "$base/auth/me" }

# 3. register warranty (unique serial so the run is idempotent)
$serial = "XB-9$([guid]::NewGuid().ToString('N').Substring(0,5))"
Check "POST /register" {
  $r = Invoke-RestMethod -Uri "$base/register" -Method Post -ContentType "application/json" -Body (@{serial=$serial;product="xBloom Studio";purchaseDate="2025-06-01";name="Test Customer";phone="0801112222";email="t@e.com";postal="10110"} | ConvertTo-Json)
  if ($r.expiryDate -ne "2026-06-01") { throw "expiry $($r.expiryDate)" }
}
ExpectErr "POST /register duplicate -> 409" 409 {
  Invoke-RestMethod -Uri "$base/register" -Method Post -ContentType "application/json" -Body (@{serial=$serial;product="x";purchaseDate="2025-06-01";name="d";phone="0800000000"} | ConvertTo-Json)
}
ExpectErr "POST /register bad date -> 400" 400 {
  Invoke-RestMethod -Uri "$base/register" -Method Post -ContentType "application/json" -Body (@{serial="XB-X";product="x";purchaseDate="01/01/2025";name="d";phone="0800000000"} | ConvertTo-Json)
}

# 4. coverage
Check "GET /coverage found" { $c = Invoke-RestMethod -Uri "$base/coverage/$serial"; if (-not $c.found) { throw "not found" } }
ExpectErr "GET /coverage unknown -> 404" 404 { Invoke-RestMethod -Uri "$base/coverage/NOPE-0000" }

# 5. ticket create + track
$tk = Invoke-RestMethod -Uri "$base/tickets" -Method Post -ContentType "application/json" -Body (@{serial="XB-0001";name="Somchai";phone="0812345678";issueType="no-water";description="x";repairType="warranty"} | ConvertTo-Json)
$tid = $tk.ticketId
Check "POST /tickets returns id" { if (-not $tid) { throw "no id" } }
Check "GET /tickets/:id public hides staffNote" {
  $pub = Invoke-RestMethod -Uri "$base/tickets/$tid"
  if ($pub.ticket.PSObject.Properties.Name -contains "staffNote") { throw "staffNote leaked" }
}
Check "GET /tickets/:id staff shows full" {
  $full = Invoke-RestMethod -Uri "$base/tickets/$tid" -Headers $H
  if (-not ($full.ticket.PSObject.Properties.Name -contains "staffNote")) { throw "missing staffNote" }
}

# 6. status workflow
Check "PATCH status new->diagnose" { Invoke-RestMethod -Uri "$base/tickets/$tid/status" -Method Patch -Headers $H -ContentType "application/json" -Body '{"status":"diagnose"}' | Out-Null }
ExpectErr "PATCH status diagnose->returned invalid -> 409" 409 { Invoke-RestMethod -Uri "$base/tickets/$tid/status" -Method Patch -Headers $H -ContentType "application/json" -Body '{"status":"returned"}' }

# 7. assign / notes
Check "PATCH /tickets/:id assign" { Invoke-RestMethod -Uri "$base/tickets/$tid" -Method Patch -Headers $H -ContentType "application/json" -Body '{"assignedTo":"Tech","staffNote":"note"}' | Out-Null }
ExpectErr "PATCH /tickets list needs auth -> 401" 401 { Invoke-RestMethod -Uri "$base/tickets" }

# 8. dashboard
Check "GET /dashboard/summary" {
  $d = Invoke-RestMethod -Uri "$base/dashboard/summary" -Headers $H
  if ($null -eq $d.totalOpen) { throw "no totalOpen" }
}

# 9. products
$pName = "TestModel-$([guid]::NewGuid().ToString('N').Substring(0,6))"
$prodId = (Invoke-RestMethod -Uri "$base/products" -Method Post -Headers $H -ContentType "application/json" -Body (@{name=$pName;code="TM"} | ConvertTo-Json)).id
Check "POST /products" { if (-not $prodId) { throw "no id" } }
Check "GET /products" { $ps = Invoke-RestMethod -Uri "$base/products" -Headers $H; if ($ps.count -lt 1) { throw "empty" } }
ExpectErr "DELETE /products no admin pin -> 401" 401 { Invoke-RestMethod -Uri "$base/products/$prodId" -Method Delete -Headers $H }
Check "DELETE /products with admin pin" { Invoke-RestMethod -Uri "$base/products/$prodId" -Method Delete -Headers ($H + @{ "x-admin-pin" = "0001" }) | Out-Null }

# 10. export csv
Check "GET /export/csv warranties" {
  $r = Invoke-WebRequest -Uri "$base/export/csv?type=warranties" -Headers $H -UseBasicParsing
  if ($r.Headers["Content-Type"] -notlike "text/csv*") { throw "ctype $($r.Headers['Content-Type'])" }
}

# 11. logs
Check "GET /logs" { $l = Invoke-RestMethod -Uri "$base/logs" -Headers $H; if ($l.count -lt 1) { throw "empty" } }

# 12. global claims
Check "PATCH global claim on ticket" { Invoke-RestMethod -Uri "$base/global-claims/$tid" -Method Patch -Headers $H -ContentType "application/json" -Body '{"globalClaimStatus":"awaiting","gcLot":"LOT-1"}' | Out-Null }
Check "GET /global-claims lists it" { $g = Invoke-RestMethod -Uri "$base/global-claims" -Headers $H; if ($g.count -lt 1) { throw "empty" } }

# 13. tech role cannot delete (role guard) — login as Tech, try product delete (admin only)
$techTok = (Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"name":"Tech","pin":"0003"}').token
ExpectErr "Tech cannot admin-delete product -> 403" 403 { Invoke-RestMethod -Uri "$base/products/1" -Method Delete -Headers @{ Authorization = "Bearer $techTok"; "x-admin-pin" = "0003" } }

Write-Host ""
$color = "Green"; if ($fail -gt 0) { $color = "Red" }
Write-Host "RESULT: $pass passed, $fail failed" -ForegroundColor $color
if ($fail -gt 0) { exit 1 }
