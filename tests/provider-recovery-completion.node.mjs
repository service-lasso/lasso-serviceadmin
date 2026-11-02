import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

// RC-003: parse the whole verifier and exercise its extracted owning functions
// without launching its top-level runner. All execution requires full admission.
const verifier = await readFile(
  new URL('../scripts/verify-real-broker-browser.mjs', import.meta.url),
  'utf8'
)
const lifecycle = await readFile(
  new URL('../cypress/e2e/secrets-broker/real-lifecycle.cy.js', import.meta.url),
  'utf8'
)
const nonce = 'a'.repeat(64)
const capability = 'b'.repeat(64)
const controlUrl = 'http://127.0.0.1:12345/__service_lasso_test'
const runtimeInputs = { liveReceipt: { nonce } }
test('whole actual verifier parses without evaluating its top-level runner', () => {
  // Extracted functions omit the owning closure and custody path. Check the
  // complete actual module with Node's parser, without starting that path.
  const result = spawnSync(
    process.execPath,
    [
      '--check',
      fileURLToPath(
        new URL('../scripts/verify-real-broker-browser.mjs', import.meta.url)
      ),
    ],
    {
      env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    }
  )
  assert.equal(result.error, undefined)
  assert.equal(result.signal, null)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '')
})
const observed = () => ({
  outcome: 'provider_fault_observed',
  receipt: {
    schema: 'service-lasso.real-admin-browser-provider-control.v1',
    phase: 'authenticated_provider_request',
    nonce,
    state: 'controlled_fault_consumed',
  },
})
function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function verifierContext(
  fetch,
  readHeldJsonFile = async () => {
    throw new Error('private read')
  }
) {
  const timers = []
  const context = vm.createContext({
    fetch,
    readHeldJsonFile,
    Buffer,
    AbortController,
    performance: { now: () => 100 },
    setTimeout: (callback, ms) => {
      timers.push({ callback, ms })
      return timers.length
    },
    clearTimeout: () => {},
    providerControlNonce: capability,
  })
  const start = verifier.indexOf('async function awaitProviderRecoveryCompletion(')
  const end = verifier.indexOf('function waitForReady(', start)
  assert.ok(start >= 0 && end > start)
  vm.runInContext(verifier.slice(start, end), context)
  return { context, timers }
}
test('actual verifier waits once for recovery before any private held-file read', async () => {
  const completion = deferred()
  let requests = 0
  let reads = 0
  const { context, timers } = verifierContext(
    async (url, options) => {
      requests += 1
      assert.equal(url, `${controlUrl}/provider-fault-receipt?wait=recovery`)
      assert.equal(
        options.headers['x-service-lasso-provider-control-nonce'],
        capability
      )
      assert.equal(options.redirect, 'error')
      await completion.promise
      return new Response(JSON.stringify(observed()))
    },
    async () => {
      reads += 1
      throw new Error('private read')
    }
  )
  const pending = context.verifyControlledProviderFault(
    runtimeInputs,
    {},
    controlUrl,
    450
  )
  await Promise.resolve()
  assert.equal(reads, 0)
  assert.equal(requests, 1)
  assert.equal(timers[0].ms, 350)
  completion.resolve()
  await assert.rejects(pending, /private read/)
  assert.equal(reads, 3)
})
test('actual verifier accepts the complete bound private chain only after completion', async () => {
  const source = { head: 'd'.repeat(40), tree: 'e'.repeat(40) }
  const base = {
    schema: observed().receipt.schema,
    private: true,
    nonce,
    platform: 'win32',
    source,
    adminSource: source,
    controlNonce: capability,
    phase: 'authenticated_provider_request',
  }
  const receipts = {
    'live-provider-control-receipt.json': {
      ...base,
      state: 'observed_before_controlled_fault',
      causalSink: 'authenticated_vault_provider_request',
    },
    'live-provider-control-consumed-receipt.json': {
      ...base,
      state: 'controlled_fault_consumed',
      causalSink: 'next_authenticated_vault_provider_request',
    },
    'live-provider-control-recovery-receipt.json': {
      ...base,
      state: 'controlled_fault_recovered',
      causalSink: 'next_authenticated_vault_provider_request',
      originalRequest: {
        method: 'GET',
        path: '/v1/secret/data/browser/provider-control',
        authClass: 'vault_token',
      },
      baselineStatus: 404,
      recoveryStatus: 404,
      rearm: 'rejected',
      secondConsume: false,
    },
  }
  const reads = []
  const { context } = verifierContext(
    async () => new Response(JSON.stringify(observed())),
    async ({ literalPath }) => {
      reads.push(literalPath)
      return { value: receipts[literalPath] }
    }
  )
  context.platform = 'win32'
  context.adminSource = source
  await context.verifyControlledProviderFault(
    runtimeInputs,
    source,
    controlUrl,
    20_000
  )
  assert.deepEqual(reads.sort(), Object.keys(receipts).sort())
  receipts[
    'live-provider-control-recovery-receipt.json'
  ].originalRequest.authClass = 'bearer'
  await assert.rejects(
    context.verifyControlledProviderFault(
      runtimeInputs,
      source,
      controlUrl,
      20_000
    ),
    /private receipt chain/
  )
})
test('actual verifier rejects absent, failed, wrong-live-nonce and expanded completion before private reads', async () => {
  for (const response of [
    new Response('', { status: 403 }),
    new Response(
      JSON.stringify({ outcome: 'provider_fault_unobserved', receipt: null }),
      { status: 409 }
    ),
    new Response(
      JSON.stringify({ outcome: 'provider_fault_unobserved', receipt: null }),
      { status: 500 }
    ),
    new Response('{'),
    new Response(JSON.stringify({ ...observed(), extra: true })),
    new Response(
      JSON.stringify({
        ...observed(),
        receipt: { ...observed().receipt, nonce: 'c'.repeat(64) },
      })
    ),
    new Response(' '.repeat(4097)),
  ]) {
    let reads = 0
    let requests = 0
    const { context } = verifierContext(
      async () => {
        requests += 1
        return response
      },
      async () => {
        reads += 1
      }
    )
    await assert.rejects(
      context.verifyControlledProviderFault(runtimeInputs, {}, controlUrl, 20_000)
    )
    assert.equal(reads, 0)
    assert.equal(requests, 1)
  }
})
test('actual verifier never grants a fresh budget and caps a one-shot request at five seconds', async () => {
  let requests = 0
  const { context, timers } = verifierContext(async () => {
    requests += 1
    return new Response(JSON.stringify(observed()))
  })
  await assert.rejects(
    context.awaitProviderRecoveryCompletion(runtimeInputs, controlUrl, 100),
    /deadline expired/
  )
  assert.equal(requests, 0)
  await context.awaitProviderRecoveryCompletion(runtimeInputs, controlUrl, 20_000)
  assert.equal(requests, 1)
  assert.equal(timers[0].ms, 5000)
})
test('actual verifier aborts a pending completion with no private reads or retry', async () => {
  let requests = 0
  let reads = 0
  const { context, timers } = verifierContext(
    (_url, { signal }) => {
      requests += 1
      return new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted')))
      )
    },
    async () => {
      reads += 1
    }
  )
  const pending = context.verifyControlledProviderFault(
    runtimeInputs,
    {},
    controlUrl,
    450
  )
  timers[0].callback()
  await assert.rejects(pending, /aborted/)
  assert.equal(requests, 1)
  assert.equal(reads, 0)
})

function cypressConsumer(responseForRecovery) {
  const queue = []
  const requests = []
  const events = []
  const completionStarted = deferred()
  const expect = (value) => ({
    not: {
      to: {
        have: {
          property: (key) => assert.equal(Object.hasOwn(value, key), false),
        },
      },
    },
    to: {
      equal: (other) => assert.equal(value, other),
      match: (pattern) => assert.match(value, pattern),
      deep: {
        equal: (other) =>
          assert.deepEqual(
            JSON.parse(JSON.stringify(value)),
            JSON.parse(JSON.stringify(other))
          ),
      },
      include: (other) => {
        for (const [key, entry] of Object.entries(other))
          assert.equal(value[key], entry)
      },
      have: {
        all: {
          keys: (...keys) =>
            assert.deepEqual(Object.keys(value).sort(), keys.sort()),
        },
      },
      not: {
        have: {
          property: (key) => assert.equal(Object.hasOwn(value, key), false),
        },
      },
    },
  })
  const chain = {
    click: () => chain,
    type: () => chain,
    should: () => chain,
    within: (callback) => {
      queue.push(callback)
      return chain
    },
  }
  const cy = {
    task: () => ({ then: (callback) => queue.push(() => callback(true)) }),
    env: () => ({
      then: (callback) =>
        queue.push(() =>
          callback({
            testControlUrl: controlUrl,
            providerControlNonce: capability,
          })
        ),
    }),
    contains: () => chain,
    get: () => chain,
    then: (callback) => queue.push(callback),
    request: (options) => ({
      then: (callback) =>
        queue.push(async () => {
          requests.push(options)
          let response
          if (options.url.endsWith('?wait=recovery')) {
            events.push('completion-request')
            completionStarted.resolve()
            response = await responseForRecovery()
            events.push('completion-response')
          } else if (options.url.endsWith('/provider-fault-receipt')) {
            response = { status: 200, body: observed() }
          } else {
            response =
              requests.length === 1
                ? { status: 200, body: { outcome: 'provider_fault_armed' } }
                : { status: 409 }
            if (response.status === 409) events.push('actual409')
          }
          callback(response)
        }),
    }),
  }
  const context = vm.createContext({
    cy,
    expect,
    visibleTableRow: () => chain,
    dialog: () => chain,
    controlledProviderValidationClicks: 0,
    recoveryProviderValidationClicks: 0,
  })
  const start = lifecycle.indexOf('function consumeControlledProviderFault()')
  const end = lifecycle.indexOf('function restartBrokerAndOpenSecrets(', start)
  assert.ok(start >= 0 && end > start)
  vm.runInContext(lifecycle.slice(start, end), context)
  context.consumeControlledProviderFault()
  const drain = async () => {
    while (queue.length) {
      const action = queue.shift()
      // Cypress inserts commands enqueued by a callback before commands which
      // were already pending. Model that ordering instead of a FIFO shortcut.
      const following = queue.splice(0)
      await action()
      queue.push(...following)
    }
  }
  return { drain, requests, events, context, completionStarted }
}
test('actual Cypress consumer delays its deliberate 503 failure until the one-shot completion', async () => {
  const gate = deferred()
  const caller = cypressConsumer(async () => {
    await gate.promise
    return { status: 200, body: observed() }
  })
  let finished = false
  // Observe rejection immediately, including a failure before the handshake.
  const pending = caller.drain().finally(() => {
    finished = true
  })
  const settled = pending.then(
    () => ({ failed: false }),
    (error) => ({ failed: true, error })
  )
  try {
    await Promise.race([
      caller.completionStarted.promise,
      settled.then(({ failed, error }) => {
        if (failed) throw error
        throw new Error('Consumer drain ended before completion request.')
      }),
    ])
    assert.deepEqual(caller.events, ['actual409', 'completion-request'])
    assert.equal(finished, false)
    const request = caller.requests.at(-1)
    assert.equal(request.timeout, 5000)
    assert.equal(request.retryOnNetworkFailure, false)
    assert.equal(request.retryOnStatusCodeFailure, false)
    assert.equal(request.log, false)
    gate.resolve()
    await assert.rejects(
      pending,
      /Controlled authenticated provider 503 was observed/
    )
    assert.deepEqual(caller.events, [
      'actual409',
      'completion-request',
      'completion-response',
    ])
    assert.equal(caller.context.controlledProviderValidationClicks, 1)
    assert.equal(caller.context.recoveryProviderValidationClicks, 1)
  } finally {
    gate.resolve()
    await settled
  }
})
test('actual Cypress consumer fails closed on rejected or expanded completion', async () => {
  for (const response of [
    { status: 409, body: { outcome: 'provider_fault_unobserved', receipt: null } },
    { status: 500, body: { outcome: 'provider_fault_unobserved', receipt: null } },
    { status: 200, body: { ...observed(), controlNonce: capability } },
  ]) {
    const caller = cypressConsumer(async () => response)
    await assert.rejects(
      caller.drain(),
      (error) =>
        !error.message.includes('Controlled authenticated provider 503 was observed')
    )
    assert.equal(
      caller.requests.filter(({ url }) => url.endsWith('?wait=recovery')).length,
      1
    )
  }
})
