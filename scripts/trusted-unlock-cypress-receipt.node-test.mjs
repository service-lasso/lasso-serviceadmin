import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('real provider control has no Cypress transport substitute', async () => {
  const [lifecycle, configuration, verifier] = await Promise.all([
    readFile(
      path.join(root, 'cypress', 'e2e', 'secrets-broker', 'real-lifecycle.cy.js'),
      'utf8'
    ),
    readFile(path.join(root, 'cypress.config.ts'), 'utf8'),
    readFile(path.join(root, 'scripts', 'verify-real-broker-browser.mjs'), 'utf8'),
  ])
  for (const required of [
    "providerControl('fail-next-provider-request', { method: 'POST' })",
    "outcome: 'provider_fault_unobserved'",
    "outcome: 'provider_fault_armed'",
    "providerControl('provider-fault-receipt')",
    "'provider_fault_observed'",
    "validateProviderConfiguration('ready')",
    "validateProviderConfiguration('unavailable')",
  ]) {
    assert.equal(lifecycle.includes(required), true)
  }
  assert.equal(lifecycle.includes('forceNetworkError'), false)
  assert.equal(lifecycle.includes('request.reply('), false)
  assert.equal(configuration.includes('realProviderControlEnabled'), true)
  assert.equal(verifier.includes('SERVICE_LASSO_REAL_PROVIDER_CONTROL'), true)
  assert.equal(verifier.includes("kill('SIGKILL')"), false)
})
