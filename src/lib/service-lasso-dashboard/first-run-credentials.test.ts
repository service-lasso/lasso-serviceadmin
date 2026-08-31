import { describe, expect, it } from 'vitest'
import { parseFirstRunCredentials } from './first-run-credentials'

describe('first-run credential parser', () => {
  it('accepts a pending envelope and rejects empty secrets', () => {
    expect(
      parseFirstRunCredentials({
        firstRun: {
          pending: true,
          username: 'local-operator',
          token: 'test-local-admin-token',
          password: 'test-local-operator-password',
        },
      })
    ).toEqual({
      username: 'local-operator',
      token: 'test-local-admin-token',
      password: 'test-local-operator-password',
    })
    expect(
      parseFirstRunCredentials({
        firstRun: { pending: false, credentialsAcknowledged: true },
      })
    ).toBeNull()
    expect(
      parseFirstRunCredentials({
        firstRun: {
          pending: true,
          username: 'local-operator',
          token: '',
          password: 'test-local-operator-password',
        },
      })
    ).toBeNull()
  })
})
