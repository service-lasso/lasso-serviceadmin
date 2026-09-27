import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { copyFile, chmod, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import observer from './cypress-child-exit-observer.cjs'

const { installCypressChildExitObserver } = observer

test('delegates the original call and preserves child identity and error behavior', () => {
  const child = new EventEmitter()
  const args = ['--run-project', 'PRIVATE_SENTINEL']
  const options = { env: { PRIVATE_SENTINEL: 'credential' } }
  let received
  const api = {
    spawn(...values) {
      received = values
      return child
    },
  }
  installCypressChildExitObserver(api, () => {})
  assert.equal(api.spawn('Cypress.exe', args, options), child)
  assert.equal(received[1], args)
  assert.equal(received[2], options)
  assert.equal(child.listenerCount('error'), 0)
  const failure = new Error('original spawn failure')
  assert.throws(
    () => child.emit('error', failure),
    (error) => error === failure
  )
})

test('retains nonzero and signal outcomes with capped private-input-free records', () => {
  const children = []
  const records = []
  const api = {
    spawn() {
      const child = new EventEmitter()
      children.push(child)
      return child
    },
  }
  installCypressChildExitObserver(api, (line) => records.push(JSON.parse(line)))
  for (let index = 0; index < 12; index += 1) {
    api.spawn('/PRIVATE_SENTINEL/Cypress', ['--smoke-test', 'PRIVATE_SENTINEL'])
    children[index].emit(
      'close',
      index === 1 ? null : index === 2 ? -999 : 7,
      index === 1 ? 'SIGTERM' : index === 2 ? 'PRIVATE_SENTINEL' : null
    )
  }
  assert.equal(records.length, 8)
  assert.equal(records[0].exitCode, 7)
  assert.equal(records[0].phase, 'smoke_test')
  assert.equal(records[1].exitCode, null)
  assert.equal(records[1].signal, 'SIGTERM')
  assert.equal(records[2].exitCode, 'unavailable')
  assert.equal(records[2].signal, 'other')
  assert.equal(JSON.stringify(records).includes('PRIVATE_SENTINEL'), false)
  assert.deepEqual(Object.keys(records[0]), [
    'schema',
    'phase',
    'event',
    'exitCode',
    'signal',
  ])
})

test('ignores unrelated children and never replaces a result with a sink failure', () => {
  const child = new EventEmitter()
  const api = {
    spawn() {
      return child
    },
  }
  installCypressChildExitObserver(api, () => {
    throw new Error('failed sink')
  })
  assert.equal(api.spawn('unrelated.exe'), child)
  assert.equal(child.listenerCount('close'), 0)
  api.spawn('Cypress.exe')
  assert.doesNotThrow(() => child.emit('close', 13, null))
})

for (const terminationEvent of ['exit', 'close']) {
  test(`real preload preserves executable success and CLI failure when CLI terminates on ${terminationEvent}`, async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'service-admin-651-child-exit-')
    )
    const executable = path.join(directory, 'Cypress.exe')
    try {
      await copyFile(process.execPath, executable)
      if (process.platform !== 'win32') await chmod(executable, 0o700)
      const preload = fileURLToPath(
        new URL('./cypress-child-exit-preload.cjs', import.meta.url)
      )
      const cliFixture = `const {spawn}=require('node:child_process'); const child=spawn(process.argv[1], ['-e','process.exit(0)'], {stdio:'ignore',windowsHide:true}); child.once('${terminationEvent}',()=>process.exit(1));`
      const cli = spawn(
        process.execPath,
        ['--require', preload, '-e', cliFixture, executable],
        { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
      )
      let stderr = ''
      cli.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })
      const [code, signal] = await once(cli, 'close')
      assert.equal(code, 1)
      assert.equal(signal, null)
      const records = stderr
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      assert.deepEqual(
        records.map((record) => record.event),
        terminationEvent === 'exit' ? ['exit'] : ['exit', 'close']
      )
      for (const record of records)
        assert.deepEqual(record, {
          schema: 'service-admin.cypress-child-exit.v1',
          phase: 'run',
          event: record.event,
          exitCode: 0,
          signal: null,
        })
      assert.equal(stderr.includes(directory), false)
    } finally {
      const resolved = path.resolve(directory)
      const temporaryRoot = path.resolve(os.tmpdir()) + path.sep
      assert.ok(resolved.startsWith(temporaryRoot))
      assert.ok(
        path.basename(resolved).startsWith('service-admin-651-child-exit-')
      )
      await rm(resolved, { recursive: true, force: true })
    }
  })
}
