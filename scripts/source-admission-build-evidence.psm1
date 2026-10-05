function Get-SourceAdmissionCopyFacts($task) {
  if ($null -eq $task) { return [ordered]@{completed=$false;faulted=$false;canceled=$false;errorClass='UnknownCopyTask';eof=$false} }
  $completed = $task.IsCompleted
  $faulted = $task.IsFaulted
  $canceled = $task.IsCanceled
  $errorClass = if ($faulted) { 'CopyFault' } elseif ($canceled) { 'CopyCanceled' } elseif (!$completed) { 'CopyPending' } else { $null }
  return [ordered]@{completed=$completed;faulted=$faulted;canceled=$canceled;errorClass=$errorClass;eof=($task.Status -eq [Threading.Tasks.TaskStatus]::RanToCompletion)}
}
function Get-SourceAdmissionOutputFacts([IO.FileStream]$stream, [string]$path, $task) {
  $facts = [ordered]@{path=$path;copy=(Get-SourceAdmissionCopyFacts $task);flushSucceeded=$false;bytes=$null;sha256=$null;errorClass=$null}
  try { $stream.Flush(); $facts.flushSucceeded=$true } catch { $facts.errorClass='OutputFlushFailure'; return $facts }
  $reader = $null
  try {
    $facts.bytes=$stream.Length
    $reader=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
    if ($reader.Length -ne $facts.bytes) { throw 'OriginalOutputLengthMismatch' }
    $facts.sha256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($reader)).ToLowerInvariant()
    if ($reader.Position -ne $facts.bytes -or $stream.Length -ne $facts.bytes) { throw 'OriginalOutputLengthMismatch' }
  } catch { $facts.errorClass='OutputObservationFailure'; $facts.sha256=$null }
  finally {
    if ($null -ne $reader) {
      try { $reader.Dispose() }
      catch { while ($true) { [Threading.Thread]::Sleep(25) } } # Retain original reader on unknown retirement.
    }
  }
  return $facts
}
Export-ModuleMember -Function Get-SourceAdmissionCopyFacts,Get-SourceAdmissionOutputFacts
