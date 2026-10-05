# SOURCE ONLY until a different entire review and new actual build admission.
param([Parameter(Mandatory)][string]$InputRoot, [Parameter(Mandatory)][string]$InputRootSHA256)
$ErrorActionPreference = 'Stop'
function Hash-Bytes($bytes) { [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant() }
function Bound-Bytes($file) {
  $item = Get-Item -LiteralPath $file
  if (!$item.PSIsContainer -and $item.Length -le 134217728) { return [IO.File]::ReadAllBytes($item.FullName) }
  throw 'FIXTURE_SENDER_BUILD_INPUT'
}
if (!$IsWindows -or $InputRootSHA256 -notmatch '^[a-f0-9]{64}$' -or ![IO.Path]::IsPathFullyQualified($InputRoot)) { throw 'FIXTURE_SENDER_BUILD_INPUT' }
$rootBytes = Bound-Bytes $InputRoot
if ((Hash-Bytes $rootBytes) -ne $InputRootSHA256) { throw 'FIXTURE_SENDER_BUILD_INPUT' }
$root = [Text.Encoding]::UTF8.GetString($rootBytes) | ConvertFrom-Json
if ($root.schema -ne 'sa-sender-build.v1' -or $root.platform -ne 'win32' -or $root.nodeVersion -ne '22.23.2' -or $root.members.Count -lt 1 -or $root.members.Count -gt 20000) { throw 'FIXTURE_SENDER_BUILD_INPUT' }
$seen = @{}
foreach ($row in $root.members) {
  if (![IO.Path]::IsPathFullyQualified($row.path) -or $seen.ContainsKey($row.path)) { throw 'FIXTURE_SENDER_BUILD_INPUT' }
  $bytes = Bound-Bytes $row.path
  if ($bytes.Length -ne $row.size -or (Hash-Bytes $bytes) -ne $row.sha256) { throw 'FIXTURE_SENDER_BUILD_INPUT' }
  $seen[$row.path] = $row
}
if ($root.buildHost -ne (Get-Process -Id $PID).Path) { throw 'FIXTURE_SENDER_BUILD_INPUT' }
$evidenceModule = Join-Path $PSScriptRoot 'source-admission-build-evidence.psm1'
foreach ($required in @($root.buildHost, $root.compiler, $root.linker, $root.nodeImportLibrary, $root.nativeSource, $PSCommandPath, $evidenceModule)) {
  if (!$seen.ContainsKey($required)) { throw 'FIXTURE_SENDER_BUILD_INPUT' }
}
Import-Module $evidenceModule -Force
$output = [IO.Path]::GetFullPath($root.outputRoot)
if (!$output.StartsWith('D:\projects\service-lasso\_audit\', [StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $output)) { throw 'FIXTURE_SENDER_BUILD_OUTPUT' }
if ($root.deadlineMs -ne 120000) { throw 'FIXTURE_SENDER_BUILD_INPUT' }
# One clock covers the separately owned /c compiler and direct linker.
[IO.Directory]::CreateDirectory($output) | Out-Null
[IO.Directory]::CreateDirectory("$output/temp") | Out-Null
$clock = [Diagnostics.Stopwatch]::StartNew()
function Invoke-OwnedImage([string]$stage, [string]$image, [string[]]$arguments) {
  $stdout = [IO.File]::Open("$output/$stage.stdout.raw", [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
  $stderr = [IO.File]::Open("$output/$stage.stderr.raw", [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
  $start = [Diagnostics.ProcessStartInfo]::new($image)
  $start.UseShellExecute = $false; $start.CreateNoWindow = $true
  $start.WorkingDirectory = $output
  $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
  $start.Environment.Clear()
  foreach ($entry in $root.environment.PSObject.Properties) { $start.Environment[$entry.Name] = [string]$entry.Value }
  $start.Environment['TEMP'] = "$output/temp"; $start.Environment['TMP'] = "$output/temp"
  foreach ($argument in $arguments) { $start.ArgumentList.Add($argument) }
  $process = [Diagnostics.Process]::new(); $process.StartInfo = $start
  $failure = [Collections.Generic.HashSet[string]]::new()
  $observedStartUTC = [DateTime]::UtcNow.ToString('O'); $observedStartMs=$clock.ElapsedMilliseconds
  $originalPID=$null; $kernelStartUTC=$null; $kernelEndUTC=$null
  $started = $false; $outTask = $null; $errTask = $null; $killRequested = $false
  try { $started = $process.Start() } catch { $failure.Add('ProcessStartFailure') | Out-Null }
  if ($started) {
    try { $originalPID=$process.Id; $kernelStartUTC=$process.StartTime.ToUniversalTime().ToString('O') } catch { $failure.Add('UnknownProcessIdentity') | Out-Null }
    try { $outTask = $process.StandardOutput.BaseStream.CopyToAsync($stdout) } catch { $failure.Add('StdoutCopyLaunchFailure') | Out-Null }
    try { $errTask = $process.StandardError.BaseStream.CopyToAsync($stderr) } catch { $failure.Add('StderrCopyLaunchFailure') | Out-Null }
  }
  while ($true) {
    $exited = $false
    try { $exited = $process.HasExited } catch { $failure.Add('UnknownProcessCompletion') | Out-Null }
    foreach ($pair in @(@('Stdout',$outTask),@('Stderr',$errTask))) {
      if ($null -ne $pair[1] -and $pair[1].IsCompleted) {
        if ($pair[1].IsFaulted) { $failure.Add($pair[0]+'CopyFault') | Out-Null }
        if ($pair[1].IsCanceled) { $failure.Add($pair[0]+'CopyCanceled') | Out-Null }
      }
    }
    $outDone = $null -ne $outTask -and $outTask.IsCompleted
    $errDone = $null -ne $errTask -and $errTask.IsCompleted
    if ($exited -and $outDone -and $errDone) { break }
    if (!$killRequested -and ($clock.ElapsedMilliseconds -ge 120000 -or $failure.Count -gt 0)) {
      $killRequested = $true
      if ($clock.ElapsedMilliseconds -ge 120000) { $failure.Add('Deadline') | Out-Null }
      try { if (!$exited) { $process.Kill($true) } } catch { $failure.Add('KillRequestFailure') | Out-Null }
    }
    # Unknown native exit or missing copy task retains every original object.
    # A tree-kill request never supplies exit, EOF, or descendant proof.
    [Threading.Thread]::Sleep(25)
  }
  if ($clock.ElapsedMilliseconds -ge 120000) { $failure.Add('Deadline') | Out-Null }
  $observedEndUTC=[DateTime]::UtcNow.ToString('O'); $observedEndMs=$clock.ElapsedMilliseconds
  $exitCode=$null
  try { $exitCode=$process.ExitCode; $kernelEndUTC=$process.ExitTime.ToUniversalTime().ToString('O'); if ($process.Id -ne $originalPID) { throw 'IdentityMismatch' } } catch { $failure.Add('UnknownProcessExitObservation') | Out-Null }
  foreach ($task in @($outTask,$errTask)) { try { $task.GetAwaiter().GetResult() } catch {} }
  $outFacts=Get-SourceAdmissionOutputFacts $stdout "$output/$stage.stdout.raw" $outTask
  $errFacts=Get-SourceAdmissionOutputFacts $stderr "$output/$stage.stderr.raw" $errTask
  foreach ($facts in @($outFacts,$errFacts)) { if ($null -ne $facts.errorClass) { $failure.Add($facts.errorClass) | Out-Null }; if (!$facts.copy.eof) { $failure.Add('IncompleteRawEOF') | Out-Null } }
  $result = [ordered]@{schema='sa-sender-build-result.v1';state='ORIGINAL_EVIDENCE_CAPTURED_RETIREMENT_PENDING';stage=$stage;originalPID=$originalPID;kernelStartUTC=$kernelStartUTC;kernelEndUTC=$kernelEndUTC;observedStartUTC=$observedStartUTC;observedEndUTC=$observedEndUTC;observedStartMs=$observedStartMs;observedEndMs=$observedEndMs;stdout=$outFacts;stderr=$errFacts;exitCode=$exitCode;elapsedMs=$clock.ElapsedMilliseconds;failures=@($failure);killRequested=$killRequested;image=$image;arguments=$arguments;sourceRootSHA256=$InputRootSHA256;nativeAcceptance=$false;descendantClosureProven=$false}
  try { [IO.File]::WriteAllText("$output/$stage.RESULT.json",($result|ConvertTo-Json -Depth 7),[Text.UTF8Encoding]::new($false)) }
  catch { while ($true) { [Threading.Thread]::Sleep(25) } } # Original resources remain owned on unknown durable capture.
  $retirement=[ordered]@{schema='sa-sender-build-retirement.v1';stage=$stage;originalPID=$originalPID;stdoutDisposed=$false;stderrDisposed=$false;processDisposed=$false;failed=$false;nativeAcceptance=$false}
  foreach ($pair in @(@('stdoutDisposed',$stdout),@('stderrDisposed',$stderr),@('processDisposed',$process))) {
    try { $pair[1].Dispose(); $retirement[$pair[0]]=$true } catch { $retirement.failed=$true }
  }
  try { [IO.File]::WriteAllText("$output/$stage.RETIREMENT.json",($retirement|ConvertTo-Json),[Text.UTF8Encoding]::new($false)) }
  catch { while ($true) { [Threading.Thread]::Sleep(25) } }
  if ($retirement.failed) { while ($true) { [Threading.Thread]::Sleep(25) } }
  if ($exitCode -ne 0 -or $failure.Count -ne 0) { throw 'FIXTURE_SENDER_BUILD_FAILED' }
}
$compileArguments = @('/nologo','/c','/MT','/O2','/W4','/WX','/std:c17','/DNAPI_VERSION=2','/DNODE_GYP_MODULE_NAME=source_admission_sender',
  "/I$($root.nodeHeaders)", "/I$($root.uvHeaders)", "/Fo$output\sender.obj", $root.nativeSource)
Invoke-OwnedImage 'compiler' $root.compiler $compileArguments
if ($clock.ElapsedMilliseconds -ge 120000) { throw 'FIXTURE_SENDER_BUILD_FAILED' }
$linkArguments = @('/NOLOGO','/DLL',"/OUT:$output\source-admission-sender.node","$output\sender.obj",$root.nodeImportLibrary,'ws2_32.lib')
foreach ($library in $root.libraryDirectories) { $linkArguments += "/LIBPATH:$library" }
Invoke-OwnedImage 'linker' $root.linker $linkArguments
$artifact = Get-Item -LiteralPath "$output/source-admission-sender.node"
if ($artifact.Length -eq 0) { throw 'FIXTURE_SENDER_BUILD_FAILED' }
# No artifact receipt, load, native acceptance, or execution authority is issued.
