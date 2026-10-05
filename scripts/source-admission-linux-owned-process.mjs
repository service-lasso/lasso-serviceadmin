// Version-pinned Node22.23.2 fixture caller. No product imports or authority.
import { ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import crypto from 'node:crypto'

const unresolved = new Set()
const failure = () => new Error('FIXTURE_SENDER_LINUX_OWNERSHIP')
const callback = (operation) => new Promise((resolve, reject) => {
  operation((error, value) => error ? reject(failure()) : resolve(value))
})

// The exact original instance and original callback remain owned independently
// of ChildProcess._handle becoming null. Method return is never retirement.
export function observeOriginalClose(handle, facts) {
  if (!handle || typeof handle.close !== 'function') throw failure()
  const original = handle.close
  facts.requested = false
  facts.returned = false
  facts.nativeCallback = false
  handle.close = function (...args) {
    if (this !== handle || facts.requested) throw failure()
    facts.requested = true
    const supplied = args[0]
    if (supplied !== undefined && typeof supplied !== 'function') throw failure()
    args[0] = function (...values) {
      if (facts.nativeCallback) throw failure()
      facts.nativeCallback = true
      facts.callbackUTC = new Date().toISOString()
      try { if (supplied) Reflect.apply(supplied, this, values) }
      catch { facts.callbackFailed = true; throw failure() }
    }
    const value = Reflect.apply(original, handle, args)
    facts.returned = true
    return value
  }
  return handle
}

function ownCopy(reader, fd, facts, owner) {
  let pending = null
  let written = 0
  const digest = crypto.createHash('sha256')
  facts.end = false
  facts.readerClosed = false
  facts.failed = false
  facts.done = false
  reader.on('error', () => { facts.failed = true; owner.failed = true })
  reader.on('close', () => { facts.readerClosed = true })
  reader.on('end', () => {
    facts.end = true
    if (!pending) facts.done = true
  })
  reader.on('data', (bytes) => {
    if (!Buffer.isBuffer(bytes) || pending || facts.failed) {
      facts.failed = true; owner.failed = true; reader.pause(); return
    }
    reader.pause()
    pending = { bytes, offset: 0 }
    const write = () => {
      const original = pending
      fs.write(fd, original.bytes, original.offset,
        original.bytes.length - original.offset, null, (error, count) => {
          if (error || !Number.isSafeInteger(count) || count <= 0 ||
              count > original.bytes.length - original.offset) {
            facts.failed = true; owner.failed = true
            // Retain the exact original buffer after unsuccessful completion.
            return
          }
          digest.update(original.bytes.subarray(original.offset, original.offset + count))
          original.offset += count
          written += count
          if (original.offset < original.bytes.length) { write(); return }
          pending = null
          if (facts.end) facts.done = true
          if (!facts.failed) reader.resume()
        })
    }
    write()
  })
  return {
    get pending() { return pending },
    snapshot() {
      return { ...facts, eof: facts.end && facts.done && !facts.failed,
        bytes: written, sha256: digest.copy().digest('hex') }
    },
  }
}

async function readback(originalPath, expected) {
  const fd = await callback((done) => fs.open(originalPath, 'r', done))
  const owner = { fd, closed: false, path: originalPath }
  unresolved.add(owner)
  const digest = crypto.createHash('sha256')
  const bytes = Buffer.alloc(65536)
  let count = 0
  while (true) {
    const got = await callback((done) => fs.read(fd, bytes, 0, bytes.length, null, done))
    if (!got) break
    count += got
    digest.update(bytes.subarray(0, got))
  }
  await callback((done) => fs.close(fd, done))
  owner.closed = true
  unresolved.delete(owner)
  if (count !== expected.bytes || digest.digest('hex') !== expected.sha256) throw failure()
  return { path: originalPath, bytes: count, sha256: expected.sha256,
    readbackClosed: true }
}

export async function runOriginalStage(stage, recipe, output, start, rootSHA256) {
  const owner = { stage, failed: false, child: null, destinations: [],
    process: {}, stdoutPipe: {}, stderrPipe: {}, stdoutReader: {}, stderrReader: {} }
  unresolved.add(owner)
  const elapsed = () => Number((process.hrtime.bigint() - start) / 1000000n)
  const holding = setInterval(() => {
    if (elapsed() >= 120000) owner.failed = true
  }, 25)
  try {
    for (const role of ['stdout', 'stderr']) {
      const path = `${output}/${stage}.${role}.raw`
      const fd = await callback((done) => fs.open(path, 'wx', 0o600, done))
      owner.destinations.push({ role, fd, path, closed: false })
    }
    const child = new ChildProcess()
    owner.child = child
    owner.originalProcess = observeOriginalClose(child._handle, owner.process)
    const observedStartUTC = new Date().toISOString()
    const observedStartMs = elapsed()
    let exited = false
    let spawned = false
    let code = null
    let signal = null
    child.on('error', () => { owner.failed = true })
    child.on('spawn', () => { spawned = true })
    child.on('exit', (actualCode, actualSignal) => {
      exited = true; code = actualCode; signal = actualSignal
      owner.observedExitUTC = new Date().toISOString()
      owner.observedExitMs = elapsed()
    })
    child.spawn({ file: recipe.image, args: [recipe.image, ...recipe.arguments],
      cwd: output, envPairs: ['LC_ALL=C', 'LANG=C', `TMPDIR=${output}/temp`],
      stdio: ['ignore', 'pipe', 'pipe'], detached: false })
    owner.originalPID = child.pid ?? null
    owner.stdout = child.stdout
    owner.stderr = child.stderr
    owner.originalStdoutPipe = observeOriginalClose(child.stdout?._handle, owner.stdoutPipe)
    owner.originalStderrPipe = observeOriginalClose(child.stderr?._handle, owner.stderrPipe)
    owner.outCopy = ownCopy(child.stdout, owner.destinations[0].fd, owner.stdoutReader, owner)
    owner.errCopy = ownCopy(child.stderr, owner.destinations[1].fd, owner.stderrReader, owner)
    // No PID/tree signal, destroyed flag, 'close' aggregate or GC supplies completion.
    while (!(exited && owner.process.nativeCallback && owner.stdoutPipe.nativeCallback &&
        owner.stderrPipe.nativeCallback && owner.stdoutReader.readerClosed &&
        owner.stderrReader.readerClosed && owner.outCopy.snapshot().eof &&
        owner.errCopy.snapshot().eof)) {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    if (elapsed() >= 120000) owner.failed = true
    const outputs = []
    for (const [index, copy] of [owner.outCopy, owner.errCopy].entries()) {
      const original = owner.destinations[index]
      await callback((done) => fs.fsync(original.fd, done))
      const stat = await callback((done) => fs.fstat(original.fd, done))
      const facts = copy.snapshot()
      if (stat.size !== facts.bytes) throw failure()
      outputs.push({ ...facts, ...await readback(original.path, facts) })
    }
    const result = { schema: 'sa-sender-linux-build-result.v1', stage,
      originalPID: owner.originalPID, observedStartUTC, observedStartMs,
      observedExitUTC: owner.observedExitUTC, observedExitMs: owner.observedExitMs,
      kernelStartUTC: null, kernelEndUTC: null, kernelCustody: 'UNKNOWN',
      spawned, exitCode: code, exitSignal: signal, outputs, process: owner.process,
      stdoutPipe: owner.stdoutPipe, stderrPipe: owner.stderrPipe,
      failed: owner.failed || !spawned || code !== 0 || signal !== null,
      elapsedMs: elapsed(), sourceRootSHA256: rootSHA256,
      nativeAcceptance: false, descendantClosureProven: false }
    await callback((done) => fs.writeFile(`${output}/${stage}.RESULT.json`,
      JSON.stringify(result), { flag: 'wx', mode: 0o600 }, done))
    for (const original of owner.destinations) {
      await callback((done) => fs.close(original.fd, done))
      original.closed = true
    }
    await callback((done) => fs.writeFile(`${output}/${stage}.RETIREMENT.json`,
      JSON.stringify({ schema: 'sa-sender-linux-build-retirement.v1', stage,
        originalPID: owner.originalPID, process: owner.process,
        stdoutPipe: owner.stdoutPipe, stderrPipe: owner.stderrPipe,
        stdoutReader: owner.stdoutReader, stderrReader: owner.stderrReader,
        destinations: owner.destinations, failed: false, nativeAcceptance: false }),
      { flag: 'wx', mode: 0o600 }, done))
    unresolved.delete(owner)
    clearInterval(holding)
    if (result.failed || elapsed() >= 120000) throw failure()
    return result
  } catch (error) {
    owner.failed = true
    // A failed or missing capture/callback retains original resources and timer.
    if (unresolved.has(owner)) await new Promise(() => {})
    throw error
  }
}
