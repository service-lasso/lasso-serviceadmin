// Qualification tooling only. Byte selection is never execution admission.
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const helper = fileURLToPath(new URL('../tests/native/source-admission-receiver.py', import.meta.url))
const controller = fileURLToPath(import.meta.url)
const fail = () => Object.assign(new Error('FIXTURE_RECEIVER_INPUT'), { code: 'FIXTURE_RECEIVER_INPUT' })
const nativeFailure = () => Object.assign(new Error('FIXTURE_RECEIVER_NATIVE'), { code: 'FIXTURE_RECEIVER_NATIVE' })
const codes = new Set(['platform', 'arguments', 'control', 'socket_option', 'connect', 'send', 'header', 'deadline', 'output', 'close'])

export function decodeReceiverLine(line, readySeen) {
  let row
  try { row = JSON.parse(line) } catch { throw nativeFailure() }
  if (JSON.stringify(row) !== line || row.schema !== 'sa-recv-window.v1') throw nativeFailure()
  const keys = Object.keys(row).join(',')
  if (row.phase === 'ready') {
    if (readySeen || keys !== 'schema,phase,requested,before,after,status,headerBytes,bodyBytes,requestBytes' || row.requested !== 4096 || row.status !== 200 || row.bodyBytes !== 0) throw nativeFailure()
    for (const [key, max] of [['before', 65536], ['after', 65536], ['headerBytes', 8192], ['requestBytes', 512]]) {
      if (!Number.isSafeInteger(row[key]) || row[key] < 1 || row[key] > max) throw nativeFailure()
    }
  } else if (row.phase === 'closed') {
    if (!readySeen || keys !== 'schema,phase,socketClose' || row.socketClose !== true) throw nativeFailure()
  } else if (row.phase === 'failed') {
    if (keys !== 'schema,phase,code' || !codes.has(row.code)) throw nativeFailure()
  } else throw nativeFailure()
  return row
}

export async function prepareReceiverTool() {
  const rootPath = process.env.SERVICE_LASSO_TEST_RECEIVER_TOOL_ROOT
  const expected = process.env.SERVICE_LASSO_TEST_RECEIVER_TOOL_ROOT_SHA256
  const output = process.env.SERVICE_LASSO_TEST_RECEIVER_EVIDENCE_DIR
  if (!rootPath || !path.isAbsolute(rootPath) || !/^[a-f0-9]{64}$/.test(expected ?? '') || !output || !path.isAbsolute(output)) throw fail()
  const bytes = await readFile(rootPath)
  if (digest(bytes) !== expected) throw fail()
  const root = JSON.parse(bytes)
  if (root.schema !== 'sa-receiver-tool.v1' || root.platform !== process.platform || !path.isAbsolute(root.executable ?? '') || !Array.isArray(root.members) || !root.members.length) throw fail()
  const seen = new Set()
  for (const member of root.members) {
    if (!path.isAbsolute(member.path ?? '') || seen.has(member.path) || !Number.isSafeInteger(member.size) || member.size < 0 || !/^[a-f0-9]{64}$/.test(member.sha256 ?? '')) throw fail()
    seen.add(member.path)
    const actual = await readFile(member.path)
    if (actual.length !== member.size || digest(actual) !== member.sha256) throw fail()
  }
  if (![root.executable, helper, controller].every((value) => seen.has(value))) throw fail()
  return Object.freeze({ executable: root.executable, output })
}

// The caller starts the original 3s clock BEFORE this function. Completion
// means actual child close AND both pipe EOFs, never rejection/kill requested.
export function startReceiver(tool, port, signal) {
  if (!Number.isInteger(port) || port < 1 || port > 65535 || signal.aborted) throw nativeFailure()
  const child = spawn(tool.executable, ['-I', '-S', '-B', helper, String(port)], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: {} })
  const stdout = [], stderr = [], rows = []
  let outSize = 0, errSize = 0, pending = '', error, terminal = false, outEOF = false, errEOF = false, controlRequested = false
  let readyResolve, readyReject, closeResolve, stopping = false
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject })
  // Retain rejection ownership even when startup fails before caller awaits.
  ready.catch(() => {})
  const closed = new Promise((resolve) => { closeResolve = resolve })
  const stop = () => {
    error ??= nativeFailure()
    readyReject(error)
    if (stopping) return
    stopping = true
    child.stdin.destroy()
    child.kill()
  }
  const abort = () => stop()
  signal.addEventListener('abort', abort, { once: true })
  child.on('error', stop)
  child.stdin.on('error', stop)
  child.stdout.on('error', stop)
  child.stderr.on('error', stop)
  child.stdout.on('data', (chunk) => {
    outSize += chunk.length
    if (outSize > 4096) { stop(); return }
    stdout.push(Buffer.from(chunk))
    if (chunk.some((byte) => byte > 127)) { stop(); return }
    pending += chunk.toString('ascii')
    try {
      let end
      while ((end = pending.indexOf('\n')) >= 0) {
        if (terminal || rows.length >= 2 || end > 511) throw nativeFailure()
        const row = decodeReceiverLine(pending.slice(0, end), rows.some((item) => item.phase === 'ready'))
        pending = pending.slice(end + 1)
        rows.push(row)
        if (row.phase === 'ready') readyResolve(row)
        else { terminal = true; if (row.phase === 'failed' || !controlRequested) stop() }
      }
      if (pending.length > 511) throw nativeFailure()
    } catch { stop() }
  })
  child.stderr.on('data', (chunk) => {
    errSize += chunk.length
    if (errSize > 4096) { stop(); return }
    stderr.push(Buffer.from(chunk))
    stop()
  })
  child.stdout.on('end', () => { outEOF = true })
  child.stderr.on('end', () => { errEOF = true })
  child.once('close', (code, exitSignal) => {
    signal.removeEventListener('abort', abort)
    if (code !== 0 || exitSignal !== null || !outEOF || !errEOF || pending !== '' || rows.length !== 2 || rows[1].phase !== 'closed' || !controlRequested) error ??= nativeFailure()
    if (error) readyReject(error)
    closeResolve({ code, exitSignal, outEOF, errEOF })
  })
  let preserved
  const finish = async () => {
    const result = await closed
    // Original bytes only, absent-target writes; failure cannot overwrite a run.
    preserved ??= Promise.all([
      writeFile(path.join(tool.output, 'receiver.stdout.raw'), Buffer.concat(stdout), { flag: 'wx' }),
      writeFile(path.join(tool.output, 'receiver.stderr.raw'), Buffer.concat(stderr), { flag: 'wx' }),
      writeFile(path.join(tool.output, 'receiver.result.json'), JSON.stringify({ ...result, rows, failed: Boolean(error), outSize, errSize }), { flag: 'wx' }),
    ])
    await preserved
    if (error) throw error
  }
  return {
    ready,
    close: async () => { if (!controlRequested) { controlRequested = true; child.stdin.end('close\n') } await finish() },
    dispose: async () => { if (!terminal) stop(); await finish() },
    isClosed: () => terminal,
  }
}
