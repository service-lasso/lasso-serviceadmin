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
$originalRead=[IO.MemoryStream]::new([byte[]]@(0,10,255))
$originalReader=[IO.StreamReader]::new($originalRead)
$originalBase=$originalReader.BaseStream
$originalDestination=[IO.MemoryStream]::new()
$originalCopy=$originalBase.CopyToAsync($originalDestination)
$originalCopy.GetAwaiter().GetResult()
Require ((Get-SourceAdmissionCopyFacts $originalCopy).eof)
$originalOwners=[ordered]@{readPipe=$originalBase;reader=$originalReader;destination=$originalDestination}
$retired=Invoke-SourceAdmissionResourceRetirement $originalOwners
Require (!$retired.failed -and !$originalBase.CanRead -and !$originalDestination.CanWrite)
foreach($label in $originalOwners.Keys){Require ($retired.resources[$label].present -and $retired.resources[$label].disposeAttempted -and $retired.resources[$label].disposeReturned)}
# EOF remains real after later retirement; missing/throwing resource never gains success.
Require ((Get-SourceAdmissionCopyFacts $originalCopy).eof)
$throwing=[pscustomobject]@{attempted=$false}
$throwing|Add-Member -MemberType ScriptMethod -Name Dispose -Value {$this.attempted=$true;throw 'fixed retirement fixture failure'}
$unresolved=[ordered]@{throwing=$throwing;missing=$null}
$failed=Invoke-SourceAdmissionResourceRetirement $unresolved
Require ($failed.failed -and $throwing.attempted -and !$failed.resources.throwing.disposeReturned -and $failed.resources.throwing.errorClass -eq 'OriginalResourceRetirementFailure')
Require (!$failed.resources.missing.present -and !$failed.resources.missing.disposeAttempted -and !$failed.resources.missing.disposeReturned -and $failed.resources.missing.errorClass -eq 'UnknownOriginalResource')
Require ([object]::ReferenceEquals($unresolved.throwing,$throwing))
