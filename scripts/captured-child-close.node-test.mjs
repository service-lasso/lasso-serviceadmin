import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { EventEmitter, once } from 'node:events'
import { PassThrough } from 'node:stream'
import test from 'node:test'
import { waitForCapturedChildClose } from './captured-child-close.mjs'

test('drains buffered captured output after exit and preserves a nonzero status', async () => {
  const child = spawn(
    process.execPath,
    [
      '-e',
      "require('node:fs').writeSync(2,'safe-late-diagnostic');process.exit(13)",
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }
  )
  let output = ''
  let outputAtExit
  child.stdout.resume()
  child.stderr.on('data', (chunk) => {
    output += chunk.toString('utf8')
  })
  child.stderr.pause()
  child.once('exit', () => {
    outputAtExit = output
  })
  assert.equal(await waitForCapturedChildClose(child, 5000), 13)
  assert.equal(outputAtExit, '')
  assert.equal(output, 'safe-late-diagnostic')
  assert.equal(child.listenerCount('error'), 0)
})

test('already exited with undrained pipes must still meet the original deadline', async () => {
  const child = Object.assign(new EventEmitter(), {
    exitCode: 13,
    signalCode: null,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  })
  try {
    await assert.rejects(
      waitForCapturedChildClose(child, 25),
      /output closure timed out/
    )
    assert.equal(child.listenerCount('close'), 0)
    assert.equal(child.listenerCount('error'), 0)
  } finally {
    child.stdout.destroy()
    child.stderr.destroy()
  }
})

test('preserves a signal null exit after streams close', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  child.stdout.resume()
  child.stderr.resume()
  const result = waitForCapturedChildClose(child, 5000)
  await once(child, 'spawn')
  child.kill('SIGTERM')
  assert.equal(await result, null)
})

test('a live real child fails at the existing deadline and owned cleanup settles', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  child.stdout.resume()
  child.stderr.resume()
  await once(child, 'spawn')
  try {
    await assert.rejects(
      waitForCapturedChildClose(child, 25),
      /output closure timed out/
    )
    assert.equal(child.exitCode, null)
  } finally {
    const closed = once(child, 'close')
    child.kill('SIGTERM')
    await closed
  }
  assert.equal(child.listenerCount('error'), 0)
})
