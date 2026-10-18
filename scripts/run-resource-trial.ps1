param([int]$InitialBuildProcessId = 0)
$ErrorActionPreference = 'Stop'
$logRoot = 'output/research-evaluation'
function Invoke-Stage([string]$Name, [scriptblock]$Action) {
  Write-Output "Stage: $Name"
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue' # Windows PowerShell treats native stderr progress as ErrorRecord.
  $global:LASTEXITCODE = -1
  try {
    & $Action
    $stageExitCode = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previousPreference }
  if ($stageExitCode -ne 0) { throw "Stage failed: $Name (exit $stageExitCode)" }
}
if ($InitialBuildProcessId) {
  Write-Output 'Waiting for the existing source build; no measurements run concurrently.'
  while (Get-Process -Id $InitialBuildProcessId -ErrorAction SilentlyContinue) {
    Start-Sleep -Seconds 2
  }
}
# Reuses the completed ORT layers; includes the final wrapper budget and license files.
Invoke-Stage 'final runtime artifacts' {
  docker build --builder desktop-linux -f docker/moonshine-runtime.Dockerfile --output type=local,dest=output/research-assets/moonshine-built . *> "$logRoot/moonshine-build-final.log"
}
Invoke-Stage 'pin artifacts' { node scripts/pin-moonshine-built.mjs }
Invoke-Stage 'check' { npm run check *> "$logRoot/resource-check-idle.log" }
Invoke-Stage 'format' { npm run format:check *> "$logRoot/resource-format-idle.log" }
Invoke-Stage 'native microphone harness smoke' {
  node scripts/browser-pipeline-soak.mjs 'http://127.0.0.1:8093/?moonshine=1' 30 *> "$logRoot/resource-native-smoke.log"
}
$smoke = Get-Content "$logRoot/pipeline-soak-30s.json" -Raw | ConvertFrom-Json
if (-not $smoke.clockValidForLatency -or -not $smoke.processMemory.peakPrivateBytes) {
  throw 'Native microphone clock or memory probe needs investigation before the matrix'
}
Copy-Item -LiteralPath "$logRoot/pipeline-soak-30s.json" -Destination "$logRoot/resource-native-smoke.json"
Invoke-Stage 'sequential resource matrix' {
  node scripts/benchmark-resource-matrix.mjs *> "$logRoot/resource-matrix.log"
}
Write-Output 'Local trial finished. Review the gates before selecting or sharing any profile.'
