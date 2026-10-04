import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { closeSync, chmodSync, existsSync, fsyncSync, lstatSync, mkdtempSync, openSync, readFileSync, realpathSync, statSync, writeSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'

export const firstRunTerminalDiagnosticSchema = 'service-admin.first-run-terminal-diagnostic.v2'
const codes = new Set(['unclassified', 'runner_unavailable', 'runner_start_failed', 'runner_terminated', 'qualification_failed'])
const hash = (x) => createHash('sha256').update(x).digest('hex')
export const commitmentDigest = hash
const sha = (x) => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x)
const git = (x) => typeof x === 'string' && /^[a-f0-9]{40}$/.test(x)
const keys = (x, expected) => x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).sort().join(',') === [...expected].sort().join(',')

// JSON.parse overwrites duplicate keys. This parser preserves the admission
// boundary by rejecting duplicates, including escaped spellings of the same key.
export function parseStrictJson(text) {
  let i = 0
  const ws = () => { while (/\s/.test(text[i] ?? '')) i += 1 }
  const str = () => {
    if (text[i++] !== '"') throw new Error('Expected string.')
    let out = ''
    while (i < text.length) {
      const c = text[i++]; if (c === '"') return out
      if (c !== '\\') { if (c < ' ') throw new Error('Invalid string.'); out += c; continue }
      const e = text[i++]; const normal = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }[e]
      if (normal !== undefined) out += normal
      else if (e === 'u') { const hex = text.slice(i, i + 4); if (!/^[0-9a-f]{4}$/i.test(hex)) throw new Error('Invalid escape.'); out += String.fromCharCode(Number.parseInt(hex, 16)); i += 4 }
      else throw new Error('Invalid escape.')
    }
    throw new Error('Unterminated string.')
  }
  const val = () => {
    ws(); if (text[i] === '"') return str()
    if (text[i] === '{') { i += 1; ws(); const o = {}; const seen = new Set(); if (text[i] === '}') { i += 1; return o }; while (true) { ws(); const k = str(); if (seen.has(k)) throw new Error('Duplicate JSON key.'); seen.add(k); ws(); if (text[i++] !== ':') throw new Error('Invalid object.'); o[k] = val(); ws(); const c = text[i++]; if (c === '}') return o; if (c !== ',') throw new Error('Invalid object.') } }
    if (text[i] === '[') { i += 1; ws(); const a = []; if (text[i] === ']') { i += 1; return a }; while (true) { a.push(val()); ws(); const c = text[i++]; if (c === ']') return a; if (c !== ',') throw new Error('Invalid array.') } }
    if (text.startsWith('true', i)) { i += 4; return true }; if (text.startsWith('false', i)) { i += 5; return false }; if (text.startsWith('null', i)) { i += 4; return null }
    const n = text.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/); if (!n) throw new Error('Invalid JSON value.'); i += n[0].length; return Number(n[0])
  }
  const result = val(); ws(); if (i !== text.length) throw new Error('Trailing JSON.'); return result
}
export function parseSafeRunnerDiagnostic(line) { try { const x = typeof line === 'string' && line.length <= 256 ? parseStrictJson(line) : null; return keys(x, ['code', 'schema']) && x.schema === 'service-lasso.real-admin-browser-failure.v1' && codes.has(x.code) ? x.code : null } catch { return null } }
export function safeSignal(signal) { return signal === null || ['SIGINT', 'SIGTERM', 'SIGKILL'].includes(signal) ? signal : signal === undefined ? null : 'other' }

export function validateCoreInitialProjection(bytes, platform) {
  const x = parseStrictJson(bytes.toString('utf8'))
  if (!keys(x, ['schema', 'privateVersion', 'candidate', 'platform', 'run', 'privateInitialReceiptSha256', 'privateJournalSha256', 'localValidatorAttestation']) || x.schema !== 'service-lasso.qualification-first-custody-projection.v2' || x.privateVersion !== 'v3' || x.platform !== platform || !keys(x.candidate, ['head', 'tree']) || !git(x.candidate.head) || !git(x.candidate.tree) || !keys(x.run, ['id', 'attempt']) || !/^[0-9]{1,20}$/.test(String(x.run.id)) || !/^[0-9]{1,20}$/.test(String(x.run.attempt)) || !sha(x.privateInitialReceiptSha256) || !sha(x.privateJournalSha256) || !keys(x.localValidatorAttestation, ['schema', 'validated']) || x.localValidatorAttestation.schema !== 'service-lasso.qualification-local-validator-attestation.v2' || x.localValidatorAttestation.validated !== true) throw new Error('Core v3 projection is not admitted.')
  return x
}
function ownerSid(exec = execFileSync) { return exec('C:\\Windows\\System32\\whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true }).match(/S-1-[0-9-]+/i)?.[0] ?? null }
const fullControl = 0x1f01ff
function readWindowsSecurity(path, exec = execFileSync) {
  const literal = path.replaceAll("'", "''")
  const script = `$acl=Get-Acl -LiteralPath '${literal}';[pscustomobject]@{ownerSid=$acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value;access=@($acl.Access|ForEach-Object{[pscustomobject]@{identitySid=$_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value;accessType=$_.AccessControlType.ToString();rights=[int]$_.FileSystemRights;inherited=[bool]$_.IsInherited;inheritanceFlags=[int]$_.InheritanceFlags}})}|ConvertTo-Json -Compress`
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const raw = exec('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { encoding: 'utf8', windowsHide: true })
  return parseStrictJson(raw.trim())
}
function samePhysicalPath(left, right, platform) {
  const normalize = (path) => resolve(path).replace(/^\\\\\?\\(?:UNC\\)?/i, platform === 'win32' ? '\\\\' : '')
  return platform === 'win32' ? normalize(left).toLowerCase() === normalize(right).toLowerCase() : normalize(left) === normalize(right)
}
function ownedWindowsSecurity(security, sid, label, requirePrivateRoot = false) {
  const access = Array.isArray(security?.access) ? security.access : []
  const effectiveRights = access.reduce((rights, entry) => rights | (entry?.rights ?? 0), 0)
  const ownerOnly = access.length > 0 && access.every((entry) => entry?.identitySid === sid && entry?.accessType === 'Allow')
  const privateRoot = !requirePrivateRoot || (access.length === 1 && access[0]?.inherited === false && (access[0]?.inheritanceFlags & 3) === 3)
  const allowed = ownerOnly && (effectiveRights & fullControl) === fullControl && privateRoot
  if (security?.ownerSid !== sid || !allowed) throw new Error(`${label} is not owner-private.`)
}
function ownershipCheck(dependencies = {}) {
  const platform = dependencies.platform ?? process.platform
  if (typeof dependencies.assertOwned === 'function') return dependencies.assertOwned
  if (platform === 'win32') {
    const sid = dependencies.ownerSid ?? ownerSid(dependencies.execFileSync ?? execFileSync)
    if (!sid) throw new Error('Owner SID unavailable.')
    const readSecurity = dependencies.readWindowsSecurity ?? readWindowsSecurity
    return (path, label) => { if (readSecurity(path, dependencies.execFileSync ?? execFileSync)?.ownerSid !== sid) throw new Error(`${label} is not owned.`) }
  }
  const expectedUid = dependencies.uid ?? process.getuid()
  const stat = dependencies.statSync ?? statSync
  return (path, label) => { if (stat(path).uid !== expectedUid) throw new Error(`${label} is not owned.`) }
}
export function checkOwned(path, label, allowAbsent = false, dependencies = {}) {
  const platform = dependencies.platform ?? process.platform
  const exists = dependencies.existsSync ?? existsSync
  const lstat = dependencies.lstatSync ?? lstatSync
  const realpath = dependencies.realpathSync ?? realpathSync
  const stat = dependencies.statSync ?? statSync
  const resolvePath = dependencies.resolve ?? resolve
  const parent = dependencies.dirname ?? dirname
  if (typeof path !== 'string' || !isAbsolute(path)) throw new Error(`${label} is not absolute.`)
  const absolute = resolvePath(path)
  const absent = !exists(absolute)
  if (absent && !allowAbsent) throw new Error(`${label} is missing.`)
  const inspected = absent ? parent(absolute) : absolute
  if (absent && !exists(inspected)) throw new Error(`${label} has no physical parent.`)
  for (let current = inspected;; current = parent(current)) {
    const entry = lstat(current)
    if (entry.isSymbolicLink() || !samePhysicalPath(realpath(current), current, platform)) throw new Error(`${label} has a reparse chain.`)
    if (parent(current) === current) break
  }
  // Requested runtime roots must be owned. For an absent registry its existing
  // parent is the requested writable boundary; ancestors are checked only for
  // physical reparse traversal, so shared OS parents are never hardened.
  const assertOwned = ownershipCheck(dependencies)
  assertOwned(inspected, absent ? `${label} parent` : label)
  if (absent) return { state: 'absent', path: absolute, parent: inspected }
  const entry = stat(absolute); if (!entry.isFile() && !entry.isDirectory()) throw new Error(`${label} is not regular.`)
  return { state: 'present', path: absolute, type: entry.isDirectory() ? 'directory' : 'file' }
}
export function admitFirstRunInputs({ workspaceRoot, instanceRegistryPath, hostPortRegistryPath, coreProjectionPath, platform }, dependencies = {}) {
  const check = (path, label, absent = false) => checkOwned(path, label, absent, dependencies)
  const workspace = check(workspaceRoot, 'workspace root'); if (workspace.type !== 'directory') throw new Error('Workspace root is not a directory.')
  const instance = check(instanceRegistryPath, 'instance registry', true); const ports = check(hostPortRegistryPath, 'host port registry', true)
  const core = check(coreProjectionPath, 'Core initial projection'); if (core.type !== 'file') throw new Error('Core projection is not a file.')
  const projectionBytes = readFileSync(core.path); const projection = validateCoreInitialProjection(projectionBytes, platform)
  return { admin: { workspace, instance, ports }, core: { candidate: projection.candidate, run: projection.run, privateInitialReceiptSha256: projection.privateInitialReceiptSha256, privateJournalSha256: projection.privateJournalSha256, projectionSha256: hash(projectionBytes) } }
}
// These quotas bound every private capture path, including an adversarial
// no-newline stream. Overflow is retained only as a private negative event.
export const privateCaptureLimits = Object.freeze({ rawBytesPerStream: 1_048_576, pendingTextBytes: 65_536, journalBytes: 131_072 })

function writeAll(fd, data, io = { writeSync, fsyncSync }) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data)
  for (let offset = 0; offset < bytes.length;) {
    const written = io.writeSync(fd, bytes, offset, bytes.length - offset)
    if (!Number.isInteger(written) || written <= 0) throw new Error('Private write made no progress.')
    offset += written
  }
  io.fsyncSync(fd)
}

export function verifyPrivateRootSecurity(root, dependencies = {}) {
  const platform = dependencies.platform ?? process.platform
  const stat = dependencies.statSync ?? statSync
  if (platform === 'win32') {
    const sid = dependencies.ownerSid ?? ownerSid(dependencies.execFileSync ?? execFileSync)
    if (!sid) throw new Error('Owner SID unavailable.')
    const readSecurity = dependencies.readWindowsSecurity ?? readWindowsSecurity
    ownedWindowsSecurity(readSecurity(root, dependencies.execFileSync ?? execFileSync), sid, 'Private journal root', true)
    return
  }
  const entry = stat(root)
  if (entry.uid !== (dependencies.uid ?? process.getuid()) || (entry.mode & 0o777) !== 0o700) throw new Error('Private directory owner/mode readback failed.')
}
export function verifyPrivateFileSecurity(path, dependencies = {}) {
  if ((dependencies.platform ?? process.platform) === 'win32') {
    const sid = dependencies.ownerSid ?? ownerSid(dependencies.execFileSync ?? execFileSync)
    if (!sid) throw new Error('Owner SID unavailable.')
    const readSecurity = dependencies.readWindowsSecurity ?? readWindowsSecurity
    return ownedWindowsSecurity(readSecurity(path, dependencies.execFileSync ?? execFileSync), sid, 'Private journal file')
  }
  const entry = (dependencies.statSync ?? statSync)(path)
  if (entry.uid !== (dependencies.uid ?? process.getuid()) || (entry.mode & 0o777) !== 0o600) throw new Error('Private file owner/mode readback failed.')
}
export function createPrivateFirstRunJournal(command, args, admission, dependencies = {}) {
  const io = { closeSync: dependencies.closeSync ?? closeSync, fsyncSync: dependencies.fsyncSync ?? fsyncSync, openSync: dependencies.openSync ?? openSync, readFileSync: dependencies.readFileSync ?? readFileSync, writeSync: dependencies.writeSync ?? writeSync }
  const root = (dependencies.mkdtempSync ?? mkdtempSync)(join(tmpdir(), 'service-admin-first-run-')); let fault = null
  if ((dependencies.platform ?? process.platform) === 'win32') { const sid = dependencies.ownerSid ?? ownerSid(dependencies.execFileSync ?? execFileSync); if (!sid) throw new Error('Owner SID unavailable.'); const exec = dependencies.execFileSync ?? execFileSync; exec('icacls', [root, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true }); exec('icacls', [root, '/setowner', `*${sid}`], { windowsHide: true }) } else (dependencies.chmodSync ?? chmodSync)(root, 0o700)
  verifyPrivateRootSecurity(root, dependencies)
  const f = Object.fromEntries(['stdout.bin', 'stderr.bin', 'custody.json'].map((n) => { const path = join(root, n); const fd = io.openSync(path, 'wx', 0o600); verifyPrivateFileSecurity(path, dependencies); return [n, fd] }))
  let custodyBytes = 0
  const record = (fd, value) => { try { const bytes = Buffer.isBuffer(value) ? value : Buffer.from(`${JSON.stringify(value)}\n`); if (fd === f['custody.json'] && custodyBytes + bytes.length > privateCaptureLimits.journalBytes) throw new Error('Private custody journal quota exceeded.'); writeAll(fd, bytes, io); if (fd === f['custody.json']) custodyBytes += bytes.length; return true } catch (error) { fault ??= error; return false } }
  if (!record(f['custody.json'], { schema: 'service-admin.first-run-private-custody.v2', admission, parentPid: process.pid, command, args })) throw fault
  let closed = false
  return { root, stdout: (x) => record(f['stdout.bin'], x), stderr: (x) => record(f['stderr.bin'], x), record: (x) => record(f['custody.json'], x), close: (x) => { if (closed) return null; closed = true; record(f['custody.json'], x); for (const fd of Object.values(f)) try { io.fsyncSync(fd); io.closeSync(fd) } catch (error) { fault ??= error }; try { return fault ? null : hash(Buffer.concat(['stdout.bin', 'stderr.bin', 'custody.json'].map((n) => io.readFileSync(join(root, n))))) } catch (error) { fault ??= error; return null } }, fault: () => fault }
}
function nativeBirth(child) {
  if (!Number.isInteger(child.pid) || child.pid < 1) throw new Error('Held child has no PID.')
  if (process.platform === 'win32') { const raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter \"ProcessId=${child.pid}\" | Select ProcessId,ParentProcessId,ExecutablePath,CreationDate | ConvertTo-Json -Compress)`], { encoding: 'utf8', windowsHide: true }); const x = parseStrictJson(raw.trim()); if (x.ProcessId !== child.pid || x.ParentProcessId !== process.pid || typeof x.ExecutablePath !== 'string' || !x.CreationDate) throw new Error('Native Windows birth mismatch.'); return x }
  const raw = execFileSync('ps', ['-p', String(child.pid), '-o', 'pid=,ppid=,lstart=,comm='], { encoding: 'utf8' }).trim(); const fields = raw.split(/\s+/); if (Number(fields[0]) !== child.pid || Number(fields[1]) !== process.pid || !fields[7]) throw new Error('Native POSIX birth mismatch.'); return { pid: child.pid, ppid: process.pid, birth: fields.slice(2, 7).join(' '), image: fields.slice(7).join(' ') }
}
function capture(stream, write, line, limits = privateCaptureLimits) { let eof = false; let error = null; let digest = createHash('sha256'); let pending = ''; let rawBytes = 0; let overflow = false; if (!stream?.on) return { eof: false, error: new Error('Missing child stream.'), overflow: true, digest: () => null, settled: () => true }; stream.on('data', (chunk) => { const bytes = Buffer.from(chunk); digest.update(bytes); const remaining = Math.max(0, limits.rawBytesPerStream - rawBytes); if (remaining > 0) { const retained = bytes.subarray(0, remaining); if (!write(retained)) error ??= new Error('Private raw capture failed.'); rawBytes += retained.length }; if (bytes.length > remaining) overflow = true; pending = `${pending}${bytes.toString('utf8')}`; if (Buffer.byteLength(pending) > limits.pendingTextBytes) { pending = ''; overflow = true }; const lines = pending.split(/\r?\n/); pending = lines.pop() ?? ''; for (const value of lines) line(value) }); stream.once('end', () => { eof = true }); stream.once('error', (value) => { error ??= value instanceof Error ? value : new Error('Child stream error.') }); return { get eof() { return eof }, get error() { return error }, get overflow() { return overflow }, digest: () => { try { return digest.digest('hex') } catch { return null } }, settled: () => eof || error !== null } }
export function createFirstRunTerminalDiagnostic(x) {
  const { stage = 'terminal', platform, run, candidate, coreCandidate, privateCloseJournal, exitCode, signal, naturalClose, stdoutEof, stderrEof, safeDiagnosticCode } = x
  if (stage !== 'terminal' || !['win32', 'linux', 'darwin'].includes(platform) || !sha(run) || !keys(candidate, ['wrapperSha256', 'verifierSha256', 'harnessSha256']) || !Object.values(candidate).every(sha) || !keys(coreCandidate, ['head', 'tree', 'run']) || !git(coreCandidate.head) || !git(coreCandidate.tree) || !sha(coreCandidate.run) || !keys(privateCloseJournal, ['state', 'sha256']) || !((privateCloseJournal.state === 'retained' && sha(privateCloseJournal.sha256)) || (privateCloseJournal.state === 'unavailable' && privateCloseJournal.sha256 === null)) || !(exitCode === null || (Number.isInteger(exitCode) && exitCode >= 0 && exitCode <= 255)) || !codes.has(safeDiagnosticCode) || typeof naturalClose !== 'boolean' || typeof stdoutEof !== 'boolean' || typeof stderrEof !== 'boolean') throw new Error('Invalid terminal projection.')
  return Object.freeze({ schema: firstRunTerminalDiagnosticSchema, mode: 'first_run', stage, state: naturalClose && stdoutEof && stderrEof ? 'closed' : 'unresolved', platform, run, candidate, coreCandidate, privateCloseJournal, exitCode, signal: safeSignal(signal), naturalClose, stdoutEof, stderrEof, safeDiagnosticCode })
}
export async function captureFirstRunChild({ spawnChild, command, args, options, platform, run, candidate, coreCandidate, admission = {}, journalFactory = createPrivateFirstRunJournal, birthObserver = nativeBirth, limits = privateCaptureLimits }) {
  let journal
  try { journal = journalFactory(command, args, admission) } catch (privateFailure) { return project(null, privateFailure, null, null, false, false, false, 'runner_start_failed') }
  let child
  try { child = spawnChild(command, args, options) } catch (privateFailure) { return project(journal, privateFailure, null, null, false, false, false, 'runner_start_failed') }
  let code = null; let signal = null; let closed = false; let primaryFailure = null; let birthFailure = null; let journalFailure = false; let diagnosticCode = 'unclassified'
  const stdout = capture(child.stdout, journal.stdout, () => {}, limits); const stderr = capture(child.stderr, journal.stderr, (line) => { diagnosticCode = parseSafeRunnerDiagnostic(line) ?? diagnosticCode }, limits)
  const settle = () => closed && stdout.settled() && stderr.settled()
  await new Promise((done) => { const finish = () => { if (settle()) done() }; child.once('error', (error) => { primaryFailure ??= error; finish() }); child.once('close', (nextCode, nextSignal) => { code = nextCode; signal = nextSignal; closed = true; finish() }); for (const stream of [child.stdout, child.stderr]) if (stream?.once) { stream.once('end', finish); stream.once('error', finish) }; try { const identity = birthObserver(child); if (!journal.record({ event: 'birth', identity })) { journalFailure = true; primaryFailure ??= journal.fault() } } catch (error) { birthFailure = error; primaryFailure ??= error; journal.record({ event: 'birth_failure' }) }; finish() })
  const natural = closed && !primaryFailure && !birthFailure && safeSignal(signal) === null && stdout.eof && stderr.eof && !stdout.error && !stderr.error && !stdout.overflow && !stderr.overflow
  if (stdout.overflow || stderr.overflow) journal.record({ event: 'capture_bound_overflow', stdout: stdout.overflow, stderr: stderr.overflow })
  return project(journal, primaryFailure, code, signal, closed, stdout.eof, stderr.eof, birthFailure || journalFailure ? 'runner_start_failed' : diagnosticCode, { natural, stdout, stderr })
  function project(activeJournal, failure, finalCode, finalSignal, observedClose, stdoutEof, stderrEof, safeCode, captureState = null) { const commitment = activeJournal?.close({ event: 'terminal', exitCode: observedClose ? finalCode : null, signal: observedClose ? safeSignal(finalSignal) : null, naturalClose: captureState?.natural ?? false, stdoutEof, stderrEof, stdoutSha256: captureState?.stdout?.digest() ?? null, stderrSha256: captureState?.stderr?.digest() ?? null, captureOverflow: Boolean(captureState?.stdout?.overflow || captureState?.stderr?.overflow) }) ?? null; const diagnostic = createFirstRunTerminalDiagnostic({ platform, run, candidate, coreCandidate, privateCloseJournal: commitment ? { state: 'retained', sha256: commitment } : { state: 'unavailable', sha256: null }, exitCode: observedClose ? finalCode : null, signal: observedClose ? finalSignal : null, naturalClose: Boolean(captureState?.natural && commitment), stdoutEof, stderrEof, safeDiagnosticCode: safeCode }); return { diagnostic, exitCode: finalCode === 0 && diagnostic.state === 'closed' ? 0 : 1, privateFailure: failure ?? activeJournal?.fault() ?? null, privateJournalRoot: activeJournal?.root ?? null } }
}
