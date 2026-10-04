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
foreach ($required in @($root.compiler, $root.nodeImportLibrary, $root.nativeSource, $PSCommandPath)) {
  if (!$seen.ContainsKey($required)) { throw 'FIXTURE_SENDER_BUILD_INPUT' }
}
$output = [IO.Path]::GetFullPath($root.outputRoot)
if (!$output.StartsWith('D:\projects\service-lasso\_audit\', [StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $output)) { throw 'FIXTURE_SENDER_BUILD_OUTPUT' }
if ($root.deadlineMs -ne 120000) { throw 'FIXTURE_SENDER_BUILD_INPUT' }
# Exact fixed compile recipe, independent of every Core/bootstrap recipe.
$arguments = @('/nologo','/LD','/MT','/O2','/W4','/WX','/std:c17','/DNAPI_VERSION=2','/DNODE_GYP_MODULE_NAME=source_admission_sender',
  "/I$($root.nodeHeaders)", "/I$($root.uvHeaders)", "/Fo$output\sender.obj", $root.nativeSource,
  '/link','/NOLOGO','/DLL',"/OUT:$output\source-admission-sender.node",$root.nodeImportLibrary,'ws2_32.lib')
foreach ($library in $root.libraryDirectories) { $arguments += "/LIBPATH:$library" }
[IO.Directory]::CreateDirectory($output) | Out-Null
[IO.Directory]::CreateDirectory("$output/temp") | Out-Null
$stdout = [IO.File]::Open("$output/compiler.stdout.raw", [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
$stderr = [IO.File]::Open("$output/compiler.stderr.raw", [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
$start = [Diagnostics.ProcessStartInfo]::new($root.compiler)
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.WorkingDirectory = $output
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
$start.Environment.Clear()
foreach ($entry in $root.environment.PSObject.Properties) { $start.Environment[$entry.Name] = [string]$entry.Value }
$start.Environment['TEMP'] = "$output/temp"
$start.Environment['TMP'] = "$output/temp"
foreach ($argument in $arguments) { $start.ArgumentList.Add($argument) }
$process = [Diagnostics.Process]::new()
$process.StartInfo = $start
$clock = [Diagnostics.Stopwatch]::StartNew()
$failure = [Collections.Generic.HashSet[string]]::new()
$started = $false; $outTask = $null; $errTask = $null; $killRequested = $false
# Every original object stays strongly owned by this invocation. An exception,
# timeout or kill request is NOT native exit or pipe-EOF completion.
try { $started = $process.Start() } catch { $failure.Add('ProcessStartFailure') | Out-Null }
if ($started) {
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
  # Missing/faulted setup never fabricates pipe closure or returns/disposes.
  # Unknown native completion remains owned, requiring external resolution.
  [Threading.Thread]::Sleep(25)
}
$exitCode = $process.ExitCode
foreach ($task in @($outTask,$errTask)) { try { $task.GetAwaiter().GetResult() } catch {} }
$stdout.Flush(); $stderr.Flush()
$stdout.Dispose(); $stderr.Dispose(); $process.Dispose()
$result = [ordered]@{schema='sa-sender-build-result.v1';exitCode=$exitCode;elapsedMs=$clock.ElapsedMilliseconds;failures=@($failure);killRequested=$killRequested;compiler=$root.compiler;arguments=$arguments;sourceRootSHA256=$InputRootSHA256;nativeAcceptance=$false}
[IO.File]::WriteAllText("$output/RESULT.json",($result|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
if ($exitCode -ne 0 -or $failure.Count -ne 0) { throw 'FIXTURE_SENDER_BUILD_FAILED' }
$artifact = Get-Item -LiteralPath "$output/source-admission-sender.node"
if ($artifact.Length -eq 0) { throw 'FIXTURE_SENDER_BUILD_FAILED' }
# Positive compile status remains merely an output to independently review;
# this caller never loads it or issues any native/source execution authority.
