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
function ownerSid() { return execFileSync('whoami', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true }).match(/S-1-[0-9-]+/i)?.[0] ?? null }
function checkOwned(path, label, allowAbsent = false) {
  if (typeof path !== 'string' || !isAbsolute(path)) throw new Error(`${label} is not absolute.`)
  if (allowAbsent && !existsSync(path)) return { state: 'absent', path: resolve(path) }
  const absolute = resolve(path)
  for (let current = absolute;; current = dirname(current)) { const stat = lstatSync(current); if (stat.isSymbolicLink() || realpathSync(current) !== current) throw new Error(`${label} has a reparse chain.`); if (dirname(current) === current) break }
  const stat = statSync(absolute); if (!stat.isFile() && !stat.isDirectory()) throw new Error(`${label} is not regular.`)
  if (process.platform !== 'win32' && stat.uid !== process.getuid()) throw new Error(`${label} is not owned.`)
  return { state: 'present', path: absolute, type: stat.isDirectory() ? 'directory' : 'file' }
}
export function admitFirstRunInputs({ workspaceRoot, instanceRegistryPath, hostPortRegistryPath, coreProjectionPath, platform }) {
  const workspace = checkOwned(workspaceRoot, 'workspace root'); if (workspace.type !== 'directory') throw new Error('Workspace root is not a directory.')
  const instance = checkOwned(instanceRegistryPath, 'instance registry', true); const ports = checkOwned(hostPortRegistryPath, 'host port registry', true)
  const core = checkOwned(coreProjectionPath, 'Core initial projection'); if (core.type !== 'file') throw new Error('Core projection is not a file.')
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

export function createPrivateFirstRunJournal(command, args, admission, dependencies = {}) {
  const io = { closeSync: dependencies.closeSync ?? closeSync, fsyncSync: dependencies.fsyncSync ?? fsyncSync, openSync: dependencies.openSync ?? openSync, readFileSync: dependencies.readFileSync ?? readFileSync, writeSync: dependencies.writeSync ?? writeSync }
  const root = mkdtempSync(join(tmpdir(), 'service-admin-first-run-')); let fault = null
  if (process.platform === 'win32') { const sid = ownerSid(); if (!sid) throw new Error('Owner SID unavailable.'); execFileSync('icacls', [root, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true }); execFileSync('icacls', [root, '/setowner', `*${sid}`], { windowsHide: true }); const acl = execFileSync('icacls', [root], { encoding: 'utf8', windowsHide: true }); if (!/\(OI\)\(CI\)\(F\)/.test(acl) || /\(I\)/.test(acl) || (acl.match(/\(F\)/g) ?? []).length !== 1) throw new Error('Owner-only DACL readback failed.') } else { chmodSync(root, 0o700); if ((statSync(root).mode & 0o777) !== 0o700) throw new Error('Private directory mode readback failed.') }
  const f = Object.fromEntries(['stdout.bin', 'stderr.bin', 'custody.json'].map((n) => [n, io.openSync(join(root, n), 'wx', 0o600)]))
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
}
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
