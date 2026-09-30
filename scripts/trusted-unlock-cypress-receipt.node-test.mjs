import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import net from 'node:net'
import test from 'node:test'
import { once } from 'node:events'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildQualificationFailureDiagnostic,
  parseTrustedUnlockReceiptDiagnostic,
} from './real-browser-qualification-progress.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function unusedPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close((error) =>
        error || !address || typeof address === 'string'
          ? reject(error ?? new Error('No local port was allocated.'))
          : resolve(address.port)
      )
    })
  })
}

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // The bounded loop only waits for the owned Vite process.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Timed out waiting for controlled Cypress fixture server.')
}

test('actual Cypress failure reaches the closed Node qualification receipt sink', { timeout: 90_000 }, async () => {
  const port = await unusedPort()
  const vite = spawn(
    process.execPath,
    [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: root, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true }
  )
  vite.stderr.resume()
  try {
    await waitForServer(`http://127.0.0.1:${port}`)
    const cypress = spawn(
      process.execPath,
      [
        path.join(root, 'node_modules', 'cypress', 'bin', 'cypress'),
        'run',
        '--browser',
        'electron',
        '--config',
        `baseUrl=http://127.0.0.1:${port},video=false,screenshotOnRunFailure=false`,
        '--env',
        'qualificationProgress=1,trustedUnlockReceiptControlFailure=1',
        '--spec',
        'cypress/e2e/secrets-broker/real-lifecycle.cy.js',
      ],
      { cwd: root, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true }
    )
    let stderr = ''
    cypress.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    const [exitCode] = await once(cypress, 'close')
    assert.notEqual(exitCode, 0)
    const receipts = stderr
      .split(/\r?\n/)
      .map(parseTrustedUnlockReceiptDiagnostic)
      .filter(Boolean)
    assert.deepEqual(receipts, [
      {
        schema: 'service-admin.trusted-unlock-receipt.v1',
        status: 'observed',
        present: true,
        verified: false,
        localRoot: false,
        loading: true,
        unavailable: false,
      },
    ])
    assert.deepEqual(
      buildQualificationFailureDiagnostic({
        failure: 'nonzero_exit',
        trustedUnlockReceipt: receipts[0],
      }).trustedUnlock,
      receipts[0]
    )
  } finally {
    if (vite.exitCode === null) {
      const closed = once(vite, 'close')
      vite.kill('SIGTERM')
      await closed
    }
  }
})
