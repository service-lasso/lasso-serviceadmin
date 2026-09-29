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

test('delegates the original call and preserves child identity and terminal error behavior', () => {
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
  assert.equal(child.listenerCount('error'), 1)
  const failure = new Error('original spawn failure')
  assert.throws(
    () => child.emit('error', failure),
    (error) => error === failure
  )
})

test('retains bounded spawn, exit, and signal provenance without private input', () => {
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
  assert.equal(records.length, 16)
  assert.deepEqual(records[0], {
    schema: 'service-admin.cypress-child-exit.v1',
    phase: 'smoke_test',
    event: 'spawn',
  })
  assert.equal(records[1].exitCode, 7)
  assert.equal(records[1].phase, 'smoke_test')
  assert.equal(records[3].exitCode, null)
  assert.equal(records[3].signal, 'SIGTERM')
  assert.equal(records[5].exitCode, 'unavailable')
  assert.equal(records[5].signal, 'other')
  assert.equal(JSON.stringify(records).includes('PRIVATE_SENTINEL'), false)
  assert.deepEqual(Object.keys(records[1]), [
    'schema',
    'phase',
    'event',
    'exitCode',
    'signal',
  ])
})

test('retains a safe child error code and rethrows the original error', () => {
  const records = []
  const child = new EventEmitter()
  const api = { spawn: () => child }
  installCypressChildExitObserver(api, (line) => records.push(JSON.parse(line)))
  api.spawn('Cypress.exe')
  const error = Object.assign(new Error('PRIVATE_SENTINEL'), { code: 'EACCES' })
  assert.throws(() => child.emit('error', error), (caught) => caught === error)
  assert.deepEqual(records.at(-1), {
    schema: 'service-admin.cypress-child-exit.v1',
    phase: 'run',
    event: 'error',
    errorCode: 'EACCES',
  })
  assert.equal(JSON.stringify(records).includes('PRIVATE_SENTINEL'), false)
})

test('retains a safe synchronous spawn failure code and rethrows the original error', () => {
  const records = []
  const error = Object.assign(new Error('PRIVATE_SENTINEL'), { code: 'ENOENT' })
  const api = { spawn: () => { throw error } }
  installCypressChildExitObserver(api, (line) => records.push(JSON.parse(line)))
  assert.throws(() => api.spawn('Cypress.exe'), (caught) => caught === error)
  assert.deepEqual(records, [
    {
      schema: 'service-admin.cypress-child-exit.v1',
      phase: 'run',
      event: 'spawn_throw',
      errorCode: 'ENOENT',
    },
  ])
  assert.equal(JSON.stringify(records).includes('PRIVATE_SENTINEL'), false)
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
      assert.deepEqual(records.map((record) => record.event), [
        'spawn',
        ...(terminationEvent === 'exit' ? ['exit'] : ['exit', 'close']),
      ])
      assert.deepEqual(records[0], {
        schema: 'service-admin.cypress-child-exit.v1',
        phase: 'run',
        event: 'spawn',
      })
      for (const record of records.slice(1))
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
