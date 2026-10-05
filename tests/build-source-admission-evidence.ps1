# Prospective source regression. No compiler, addon or native acceptance.
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot '../scripts/source-admission-build-evidence.psm1') -Force
function Require($condition) { if (!$condition) { throw 'BUILD_EVIDENCE_REGRESSION' } }
$success=[Threading.Tasks.Task]::CompletedTask
$fault=[Threading.Tasks.Task]::FromException([IO.IOException]::new('fixed fixture fault'))
$cancel=[Threading.Tasks.Task]::FromCanceled([Threading.CancellationToken]::new($true))
$pending=[Threading.Tasks.TaskCompletionSource[bool]]::new()
Require ((Get-SourceAdmissionCopyFacts $success).eof)
foreach ($task in @($fault,$cancel,$pending.Task,$null)) { Require (!(Get-SourceAdmissionCopyFacts $task).eof) }
Require ((Get-SourceAdmissionCopyFacts $fault).faulted)
Require ((Get-SourceAdmissionCopyFacts $cancel).canceled)
$path=Join-Path ([IO.Path]::GetTempPath()) ('sa-build-evidence-'+[Guid]::NewGuid().ToString('N')+'.raw')
$stream=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try {
  $stream.Write([byte[]]@(0,10,255)); $facts=Get-SourceAdmissionOutputFacts $stream $path $success
  Require ($facts.bytes -eq 3 -and $facts.copy.eof -and $facts.flushSucceeded -and $facts.sha256 -eq [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([byte[]]@(0,10,255))).ToLowerInvariant())
  $partial=Get-SourceAdmissionOutputFacts $stream $path $fault
  Require ($partial.bytes -eq 3 -and !$partial.copy.eof -and $partial.copy.errorClass -eq 'CopyFault')
  $stream.Dispose(); $closed=Get-SourceAdmissionOutputFacts $stream $path $success
  Require (!$closed.flushSucceeded -and $closed.errorClass -eq 'OutputFlushFailure' -and $null -eq $closed.sha256)
} finally { $stream.Dispose() }
# Retain actual fixture bytes for owning runner disposition; no cleanup claim.
