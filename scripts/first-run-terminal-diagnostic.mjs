import { createHash } from 'node:crypto'
import {
  closeSync,
  chmodSync,
  fsyncSync,
  mkdtempSync,
  openSync,
  readFileSync,
  writeSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const firstRunTerminalDiagnosticSchema =
  'service-admin.first-run-terminal-diagnostic.v1'

const safeCodes = new Set([
  'unclassified',
  'runner_unavailable',
  'runner_start_failed',
  'runner_terminated',
  'qualification_failed',
])
const safeSignals = new Set([null, 'SIGINT', 'SIGTERM', 'SIGKILL', 'other'])

export function parseSafeRunnerDiagnostic(line) {
  if (typeof line !== 'string' || line.length > 256) return null
  try {
    const value = JSON.parse(line)
    if (
      value?.schema !== 'service-lasso.real-admin-browser-failure.v1' ||
      typeof value.code !== 'string' ||
      Object.keys(value).sort().join(',') !== 'code,schema' ||
      !safeCodes.has(value.code)
    ) {
      return null
    }
    return value.code
  } catch {
    return null
  }
}

export function safeSignal(signal) {
  if (signal === null || signal === 'SIGINT' || signal === 'SIGTERM' || signal === 'SIGKILL') {
    return signal
  }
  return signal === undefined ? null : 'other'
}

export function createFirstRunTerminalDiagnostic({
  stage = 'terminal',
  platform,
  run,
  candidate,
  coreCandidate,
  privateCloseJournalSha256,
  exitCode,
  signal,
  naturalClose,
  stdoutEof,
  stderrEof,
  safeDiagnosticCode,
}) {
  if (
    stage !== 'terminal' ||
    !['darwin', 'linux', 'win32'].includes(platform) ||
    typeof run !== 'string' ||
    !/^[a-f0-9]{64}$/.test(run) ||
    !candidate ||
    Object.keys(candidate).sort().join(',') !==
      'harnessSha256,verifierSha256,wrapperSha256' ||
    !/^[a-f0-9]{64}$/.test(candidate.wrapperSha256) ||
    !/^[a-f0-9]{64}$/.test(candidate.verifierSha256) ||
    !/^[a-f0-9]{64}$/.test(candidate.harnessSha256) ||
    !coreCandidate ||
    Object.keys(coreCandidate).sort().join(',') !== 'head,run,tree' ||
    !/^(?:[a-f0-9]{40}|unavailable)$/.test(coreCandidate.head) ||
    !/^(?:[a-f0-9]{40}|unavailable)$/.test(coreCandidate.tree) ||
    !/^(?:[a-f0-9]{64}|unavailable)$/.test(coreCandidate.run) ||
    !/^[a-f0-9]{64}$/.test(privateCloseJournalSha256) ||
    !(
      exitCode === null ||
      (Number.isInteger(exitCode) && exitCode >= 0 && exitCode <= 255)
    ) ||
    !safeSignals.has(safeSignal(signal)) ||
    typeof naturalClose !== 'boolean' ||
    typeof stdoutEof !== 'boolean' ||
    typeof stderrEof !== 'boolean' ||
    !safeCodes.has(safeDiagnosticCode)
  ) {
    throw new Error('First-run terminal diagnostic input is invalid.')
  }
  return Object.freeze({
    schema: firstRunTerminalDiagnosticSchema,
    mode: 'first_run',
    stage,
    state: naturalClose && stdoutEof && stderrEof ? 'closed' : 'unresolved',
    platform,
    run,
    candidate: {
      wrapperSha256: candidate.wrapperSha256,
      verifierSha256: candidate.verifierSha256,
      harnessSha256: candidate.harnessSha256,
    },
    coreCandidate: { head: coreCandidate.head, tree: coreCandidate.tree, run: coreCandidate.run },
    privateCloseJournalSha256,
    exitCode,
    signal: safeSignal(signal),
    naturalClose,
    stdoutEof,
    stderrEof,
    safeDiagnosticCode,
  })
}

function createPrivateJournal({ command, args }) {
  const root = mkdtempSync(join(tmpdir(), 'service-admin-first-run-'), {
    encoding: 'utf8',
  })
  if (process.platform === 'win32') {
    const identity = execFileSync('whoami', ['/user', '/fo', 'csv', '/nh'], {
      encoding: 'utf8',
      windowsHide: true,
    }).match(/S-1-[0-9-]+/i)?.[0]
    if (!identity) throw new Error('Private journal owner identity is unavailable.')
    execFileSync('icacls', [root, '/inheritance:r', '/grant:r', `${identity}:(OI)(CI)F`], {
      windowsHide: true,
    })
  } else {
    chmodSync(root, 0o700)
    const directory = openSync(root, 'r')
    try {
      fsyncSync(directory)
    } finally {
      closeSync(directory)
    }
  }
  const open = (name) => openSync(join(root, name), 'wx', 0o600)
  const stdout = open('stdout.bin')
  const stderr = open('stderr.bin')
  const custody = open('custody.json')
  let failed = false
  const write = (descriptor, value) => {
    try {
      writeSync(descriptor, value)
      fsyncSync(descriptor)
      return true
    } catch {
      failed = true
      return false
    }
  }
  if (!write(
    custody,
    Buffer.from(
      JSON.stringify({
        schema: 'service-admin.first-run-private-custody.v1',
        parentPid: process.pid,
        image: command,
        args,
      }) + '\n',
      'utf8'
    )
  )) throw new Error('Initial private custody record was not retained.')
  return {
    root,
    writeStdout(chunk) {
      return write(stdout, chunk)
    },
    writeStderr(chunk) {
      return write(stderr, chunk)
    },
    recordBirth(child) {
      return write(
        custody,
        Buffer.from(
          JSON.stringify({
            event: 'birth',
            pid: child.pid ?? null,
            parentPid: process.pid,
            image: command,
            processChain: [process.pid, child.pid ?? null],
          }) + '\n',
          'utf8'
        )
      )
    },
    finalize(value) {
      const complete = write(custody, Buffer.from(`${JSON.stringify(value)}\n`, 'utf8'))
      for (const descriptor of [stdout, stderr, custody]) {
        try {
          fsyncSync(descriptor)
          closeSync(descriptor)
        } catch {
          failed = true
        }
      }
      return complete && !failed
    },
    commitment() {
      return commitmentDigest(
        ['stdout.bin', 'stderr.bin', 'custody.json']
          .map((name) => createHash('sha256').update(readFileSync(join(root, name))).digest('hex'))
          .join(':')
      )
    },
  }
}

function privateCapture(stream, onLine, writeRaw) {
  const chunks = []
  const hash = createHash('sha256')
  let bytes = 0
  let exceeded = false
  let ended = false
  let lineBuffer = ''
  let retained = true
  stream.on('data', (chunk) => {
    hash.update(chunk)
    retained = writeRaw(chunk) && retained
    bytes += chunk.length
    if (bytes > 1_048_576) {
      exceeded = true
      return
    }
    chunks.push(Buffer.from(chunk))
    lineBuffer += chunk.toString('utf8')
    const lines = lineBuffer.split(/\r?\n/)
    lineBuffer = lines.pop() ?? ''
    for (const line of lines) onLine(line)
  })
  stream.once('end', () => {
    ended = true
  })
  return {
    get eof() {
      return ended
    },
    get exceeded() {
      return exceeded
    },
    get retained() {
      return retained
    },
    commitment() {
      return hash.digest('hex')
    },
    dispose() {
      chunks.length = 0
      lineBuffer = ''
    },
  }
}

export async function captureFirstRunChild({
  spawnChild,
  command,
  args,
  options,
  platform,
  run,
  candidate,
  coreCandidate,
}) {
  let journal
  try {
    journal = createPrivateJournal({ command, args })
  } catch (error) {
    const diagnostic = createFirstRunTerminalDiagnostic({
      platform,
      run,
      candidate,
      coreCandidate,
      privateCloseJournalSha256: commitmentDigest('journal_unavailable'),
      exitCode: null,
      signal: null,
      naturalClose: false,
      stdoutEof: false,
      stderrEof: false,
      safeDiagnosticCode: 'runner_start_failed',
    })
    return { diagnostic, exitCode: 1, privateFailure: error }
  }
  let child
  try {
    child = spawnChild(command, args, options)
  } catch (error) {
    journal.finalize({ event: 'spawn_throw' })
    const diagnostic = createFirstRunTerminalDiagnostic({
      platform,
      run,
      candidate,
      coreCandidate,
      privateCloseJournalSha256: commitmentDigest('spawn_throw'),
      exitCode: null,
      signal: null,
      naturalClose: false,
      stdoutEof: false,
      stderrEof: false,
      safeDiagnosticCode: 'runner_start_failed',
    })
    return { diagnostic, exitCode: 1, privateFailure: error, privateJournalRoot: null }
  }

  // Held identity and capture are private to this owner. They are deliberately
  // not copied into the projection or written to disk.
  const custody = {
    pid: child.pid ?? null,
    parentPid: process.pid,
    image: command,
    processChain: [process.pid, child.pid ?? null],
    child,
  }
  let code = null
  let signal = null
  let closed = false
  let spawnError = false
  let safeDiagnosticCode = 'unclassified'
  const birthRecorded = journal.recordBirth(child)
  const stdout = privateCapture(child.stdout, () => undefined, journal.writeStdout)
  const stderr = privateCapture(child.stderr, (line) => {
    safeDiagnosticCode = parseSafeRunnerDiagnostic(line) ?? safeDiagnosticCode
  }, journal.writeStderr)

  await new Promise((resolve) => {
    child.once('error', () => {
      spawnError = true
    })
    child.once('close', (nextCode, nextSignal) => {
      code = nextCode
      signal = nextSignal
      closed = true
      resolve()
    })
  })

  const terminal = {
    event: 'terminal',
    exitCode: code,
    signal: safeSignal(signal),
    naturalClose: closed && safeSignal(signal) === null && !spawnError && birthRecorded && stdout.retained && stderr.retained && !stdout.exceeded && !stderr.exceeded,
    stdoutEof: stdout.eof,
    stderrEof: stderr.eof,
    stdoutSha256: stdout.commitment(),
    stderrSha256: stderr.commitment(),
  }
  const journalComplete = journal.finalize(terminal)
  const diagnostic = createFirstRunTerminalDiagnostic({
    platform,
    run,
    candidate,
    coreCandidate,
    privateCloseJournalSha256: journalComplete ? journal.commitment() : commitmentDigest('journal_incomplete'),
    exitCode: code,
    signal,
    naturalClose: terminal.naturalClose && journalComplete,
    stdoutEof: stdout.eof,
    stderrEof: stderr.eof,
    safeDiagnosticCode,
  })
  const exitCode = code === 0 && diagnostic.naturalClose && stdout.eof && stderr.eof ? 0 : 1
  stdout.dispose()
  stderr.dispose()
  custody.child = null
  custody.pid = null
  custody.parentPid = null
  custody.image = null
  custody.processChain = []
  return { diagnostic, exitCode, privateFailure: null, privateJournalRoot: journal.root }
}

export function commitmentDigest(content) {
  return createHash('sha256').update(content).digest('hex')
}
