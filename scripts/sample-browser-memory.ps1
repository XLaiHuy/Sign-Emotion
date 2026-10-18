param(
  [Parameter(Mandatory=$true)][string]$Session,
  [int]$Seconds = 1200,
  [string]$OutputFile = 'output/research-evaluation/browser-memory.json',
  [string]$StopFile = ''
)
$ErrorActionPreference = 'Stop'
if ($Seconds -lt 1 -or $Seconds -gt 2400) { throw 'Duration must be 1..2400 seconds' }
$rows = @()
$timer = [Diagnostics.Stopwatch]::StartNew()
$nextSampleSeconds = 0
$nextDiscoverSeconds = 0
$browserProcessIds = @()
$ownedBrowserPid = 0
$nextTraceSeconds = 0
$peakPrivate = 0L
$peakWorking = 0L
while ($timer.Elapsed.TotalSeconds -lt $Seconds -and (-not $StopFile -or -not (Test-Path -LiteralPath $StopFile))) {
  # CDP restricts IDs to this dedicated browser, not every Chrome process on the PC.
  $benchmarkCode = "async page => { const c=await page.context().browser().newBrowserCDPSession(); try { const r=await c.send('SystemInfo.getProcessInfo'); return {ids:r.processInfo.map(p=>p.id),root:r.processInfo.find(p=>p.type==='browser')?.id}; } finally { await c.detach(); } }"
  if ($timer.Elapsed.TotalSeconds -ge $nextDiscoverSeconds) {
    if (-not $ownedBrowserPid) {
      $raw = & npx --offline --package '@playwright/cli' playwright-cli "-s=$Session" run-code $benchmarkCode --raw
      if ($LASTEXITCODE -ne 0) { throw 'Could not identify the owned browser processes' }
      $owned = ConvertFrom-Json -InputObject ($raw -join [Environment]::NewLine)
      $ownedBrowserPid = [int]$owned.root
      $browserProcessIds = @($owned.ids)
    }
    if (-not $ownedBrowserPid) { throw 'Missing owned Chrome root process' }
    $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $ownedBrowserPid" | Select-Object -ExpandProperty ProcessId)
    $browserProcessIds = @($ownedBrowserPid) + $children
    $nextDiscoverSeconds += 5
  }
  if (-not $browserProcessIds.Count) { throw 'No owned browser processes' }
  # A renderer/worker can exit between discovery and reading its counters.
  # Read each process inside the guard instead of aborting the whole sampler.
  $privateBytes = 0L
  $workingSetBytes = 0L
  $liveProcessCount = 0
  foreach ($browserProcessId in $browserProcessIds) {
    try {
      $process = Get-Process -Id ([int]$browserProcessId) -ErrorAction Stop
      $processPrivate = $process.PrivateMemorySize64
      $processWorking = $process.WorkingSet64
      $privateBytes += $processPrivate
      $workingSetBytes += $processWorking
      $liveProcessCount++
    } catch {
      # Exited processes no longer contribute memory; never sample unrelated Chrome.
    }
  }
  $row = [pscustomobject]@{
    sampledAtUtc = [DateTime]::UtcNow.ToString('o')
    elapsedSeconds = [math]::Round($timer.Elapsed.TotalSeconds, 2)
    processCount = $liveProcessCount
    privateBytes = $privateBytes
    workingSetBytes = $workingSetBytes
  }
  $peakPrivate = [math]::Max([long]$peakPrivate, [long]$row.privateBytes)
  $peakWorking = [math]::Max([long]$peakWorking, [long]$row.workingSetBytes)
  $keepTrace = $timer.Elapsed.TotalSeconds -ge $nextTraceSeconds
  if ($keepTrace) { $rows += $row; $nextTraceSeconds += 10 }
  $report = [ordered]@{
    scope = 'Owned Chrome processes from preparation through Finish; private committed bytes and summed working sets. Excludes VRAM/driver allocations; shared pages may be counted multiple times in working sets. Not physical RAM or a baseline comparison.'
    samplePeriodSeconds = 1
    retainedTracePeriodSeconds = 10
    sampledThroughSeconds = [math]::Round($timer.Elapsed.TotalSeconds, 2)
    rootProcessId = $ownedBrowserPid
    peakPrivateBytes = $peakPrivate
    peakWorkingSetBytes = $peakWorking
    samples = $rows
  }
  if ($keepTrace) { $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $OutputFile -Encoding utf8 }
  $nextSampleSeconds += 1
  $remaining = $Seconds - $timer.Elapsed.TotalSeconds
  $delay = [math]::Min($remaining, [math]::Max(0, $nextSampleSeconds - $timer.Elapsed.TotalSeconds))
  if ($delay -gt 0) { Start-Sleep -Milliseconds ([int]($delay * 1000)) }
}
if ($rows.Count) { $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $OutputFile -Encoding utf8 }
