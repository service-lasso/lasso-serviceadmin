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
function writeAll(fd, data) { const b = Buffer.isBuffer(data) ? data : Buffer.from(data); for (let offset = 0; offset < b.length;) { const n = writeSync(fd, b, offset, b.length - offset); if (!Number.isInteger(n) || n <= 0) throw new Error('Private write was partial.'); offset += n }; fsyncSync(fd) }
function privateJournal(command, args, admission) {
  const root = mkdtempSync(join(tmpdir(), 'service-admin-first-run-')); let fault = null
  if (process.platform === 'win32') { const sid = ownerSid(); if (!sid) throw new Error('Owner SID unavailable.'); execFileSync('icacls', [root, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true }); execFileSync('icacls', [root, '/setowner', `*${sid}`], { windowsHide: true }); const acl = execFileSync('icacls', [root], { encoding: 'utf8', windowsHide: true }); if (!/\(OI\)\(CI\)\(F\)/.test(acl) || /\(I\)/.test(acl) || (acl.match(/\(F\)/g) ?? []).length !== 1) throw new Error('Owner-only DACL readback failed.') } else { chmodSync(root, 0o700); if ((statSync(root).mode & 0o777) !== 0o700) throw new Error('Private directory mode readback failed.') }
  const f = Object.fromEntries(['stdout.bin', 'stderr.bin', 'custody.json'].map((n) => [n, openSync(join(root, n), 'wx', 0o600)]))
  const record = (fd, value) => { try { writeAll(fd, Buffer.isBuffer(value) ? value : `${JSON.stringify(value)}\n`); return true } catch (error) { fault ??= error; return false } }
  if (!record(f['custody.json'], { schema: 'service-admin.first-run-private-custody.v2', admission, parentPid: process.pid, command, args })) throw fault
  return { root, stdout: (x) => record(f['stdout.bin'], x), stderr: (x) => record(f['stderr.bin'], x), record: (x) => record(f['custody.json'], x), close: (x) => { record(f['custody.json'], x); for (const fd of Object.values(f)) try { fsyncSync(fd); closeSync(fd) } catch (error) { fault ??= error }; try { return fault ? null : hash(Buffer.concat(['stdout.bin', 'stderr.bin', 'custody.json'].map((n) => readFileSync(join(root, n))))) } catch (error) { fault ??= error; return null } }, fault: () => fault }
}
function nativeBirth(child) {
  if (!Number.isInteger(child.pid) || child.pid < 1) throw new Error('Held child has no PID.')
  if (process.platform === 'win32') { const raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter \"ProcessId=${child.pid}\" | Select ProcessId,ParentProcessId,ExecutablePath,CreationDate | ConvertTo-Json -Compress)`], { encoding: 'utf8', windowsHide: true }); const x = parseStrictJson(raw.trim()); if (x.ProcessId !== child.pid || x.ParentProcessId !== process.pid || typeof x.ExecutablePath !== 'string' || !x.CreationDate) throw new Error('Native Windows birth mismatch.'); return x }
  const raw = execFileSync('ps', ['-p', String(child.pid), '-o', 'pid=,ppid=,lstart=,comm='], { encoding: 'utf8' }).trim(); const fields = raw.split(/\s+/); if (Number(fields[0]) !== child.pid || Number(fields[1]) !== process.pid || !fields[7]) throw new Error('Native POSIX birth mismatch.'); return { pid: child.pid, ppid: process.pid, birth: fields.slice(2, 7).join(' '), image: fields.slice(7).join(' ') }
}
function capture(stream, write, line) { let eof = false; let error = null; let h = createHash('sha256'); let pending = ''; if (!stream?.on) return { eof: false, error: new Error('Missing child stream.'), digest: () => null }; stream.on('data', (c) => { const b = Buffer.from(c); h.update(b); if (!write(b)) error ??= new Error('Private raw capture failed.'); pending += b.toString('utf8'); const lines = pending.split(/\r?\n/); pending = lines.pop() ?? ''; for (const x of lines) line(x) }); stream.once('end', () => { eof = true }); stream.once('error', (e) => { error ??= e }); return { get eof() { return eof }, get error() { return error }, digest: () => { try { return h.digest('hex') } catch { return null } } }
}
export function createFirstRunTerminalDiagnostic(x) {
  const { stage = 'terminal', platform, run, candidate, coreCandidate, privateCloseJournal, exitCode, signal, naturalClose, stdoutEof, stderrEof, safeDiagnosticCode } = x
  if (stage !== 'terminal' || !['win32', 'linux', 'darwin'].includes(platform) || !sha(run) || !keys(candidate, ['wrapperSha256', 'verifierSha256', 'harnessSha256']) || !Object.values(candidate).every(sha) || !keys(coreCandidate, ['head', 'tree', 'run']) || !git(coreCandidate.head) || !git(coreCandidate.tree) || !sha(coreCandidate.run) || !keys(privateCloseJournal, ['state', 'sha256']) || !((privateCloseJournal.state === 'retained' && sha(privateCloseJournal.sha256)) || (privateCloseJournal.state === 'unavailable' && privateCloseJournal.sha256 === null)) || !(exitCode === null || (Number.isInteger(exitCode) && exitCode >= 0 && exitCode <= 255)) || !codes.has(safeDiagnosticCode) || typeof naturalClose !== 'boolean' || typeof stdoutEof !== 'boolean' || typeof stderrEof !== 'boolean') throw new Error('Invalid terminal projection.')
  return Object.freeze({ schema: firstRunTerminalDiagnosticSchema, mode: 'first_run', stage, state: naturalClose && stdoutEof && stderrEof ? 'closed' : 'unresolved', platform, run, candidate, coreCandidate, privateCloseJournal, exitCode, signal: safeSignal(signal), naturalClose, stdoutEof, stderrEof, safeDiagnosticCode })
}
export async function captureFirstRunChild({ spawnChild, command, args, options, platform, run, candidate, coreCandidate, admission = {} }) {
  let j; try { j = privateJournal(command, args, admission) } catch (privateFailure) { return fail(null, privateFailure) }
  let child; try { child = spawnChild(command, args, options); const identity = nativeBirth(child); if (!j.record({ event: 'birth', identity })) throw j.fault() } catch (privateFailure) { return fail(j, privateFailure) }
  let code = null, signal = null, closed = false, childError = null, diagnosticCode = 'unclassified'; const stdout = capture(child.stdout, j.stdout, () => {}); const stderr = capture(child.stderr, j.stderr, (line) => { diagnosticCode = parseSafeRunnerDiagnostic(line) ?? diagnosticCode })
  await new Promise((done) => { child.once('error', (e) => { childError ??= e; done() }); child.once('close', (c, s) => { code = c; signal = s; closed = true; done() }) })
  const natural = closed && !childError && safeSignal(signal) === null && stdout.eof && stderr.eof && !stdout.error && !stderr.error; const commitment = j.close({ event: 'terminal', exitCode: code, signal: safeSignal(signal), naturalClose: natural, stdoutEof: stdout.eof, stderrEof: stderr.eof, stdoutSha256: stdout.digest(), stderrSha256: stderr.digest() }); const d = createFirstRunTerminalDiagnostic({ platform, run, candidate, coreCandidate, privateCloseJournal: commitment ? { state: 'retained', sha256: commitment } : { state: 'unavailable', sha256: null }, exitCode: closed ? code : null, signal: closed ? signal : null, naturalClose: natural && Boolean(commitment), stdoutEof: stdout.eof, stderrEof: stderr.eof, safeDiagnosticCode: diagnosticCode }); return { diagnostic: d, exitCode: code === 0 && d.state === 'closed' ? 0 : 1, privateFailure: j.fault() ?? childError, privateJournalRoot: j.root }
  function fail(journal, privateFailure) { const commitment = journal?.close({ event: 'spawn_or_birth_failure' }) ?? null; return { diagnostic: createFirstRunTerminalDiagnostic({ platform, run, candidate, coreCandidate, privateCloseJournal: commitment ? { state: 'retained', sha256: commitment } : { state: 'unavailable', sha256: null }, exitCode: null, signal: null, naturalClose: false, stdoutEof: false, stderrEof: false, safeDiagnosticCode: 'runner_start_failed' }), exitCode: 1, privateFailure, privateJournalRoot: journal?.root ?? null } }
}
