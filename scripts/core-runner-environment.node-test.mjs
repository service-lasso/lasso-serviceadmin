import assert from 'node:assert/strict'
import test from 'node:test'

import { nestedCoreRunnerEnvironment } from './core-runner-environment.mjs'

test('removes the outer provider activation tuple from the nested Core runner', () => {
  const environment = nestedCoreRunnerEnvironment(
    {
      SERVICE_LASSO_ADMIN_PROVIDER_OBSERVER_ROOT: '/private/provider-observer',
      SERVICE_LASSO_ADMIN_PROVIDER_OBSERVER_NONCE: 'a'.repeat(64),
      SERVICE_LASSO_TEST_CORE_ROOT: '/core',
    },
    {
      SERVICE_LASSO_TEST_ADMIN_SOURCE_HEAD: 'b'.repeat(40),
    }
  )

  assert.deepEqual(environment, {
    SERVICE_LASSO_TEST_CORE_ROOT: '/core',
    SERVICE_LASSO_TEST_ADMIN_SOURCE_HEAD: 'b'.repeat(40),
  })
})

test('does not mutate the caller environment', () => {
  const inherited = {
    SERVICE_LASSO_ADMIN_PROVIDER_OBSERVER_ROOT: '/private/provider-observer',
    SERVICE_LASSO_ADMIN_PROVIDER_OBSERVER_NONCE: 'a'.repeat(64),
  }

  nestedCoreRunnerEnvironment(inherited)

  assert.deepEqual(inherited, {
    SERVICE_LASSO_ADMIN_PROVIDER_OBSERVER_ROOT: '/private/provider-observer',
    SERVICE_LASSO_ADMIN_PROVIDER_OBSERVER_NONCE: 'a'.repeat(64),
  })
})
