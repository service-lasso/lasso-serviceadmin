import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FIRST_RUN_VAULT_BACKUP_COPY,
  FIRST_RUN_VAULT_NOT_READY,
  LOCAL_OPERATOR_VAULT_FIELD_NAMES,
  LOCAL_OPERATOR_VAULT_PATH,
  fetchFirstRunCredentials,
  parseFirstRunCredentials,
} from './first-run-credentials'

const TOKEN_SENTINEL = 'test-local-admin-token'
const PASSWORD_SENTINEL = 'test-local-operator-password'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('first-run credential parser', () => {
  it('accepts a pending envelope and rejects empty secrets', () => {
    expect(
      parseFirstRunCredentials({
        firstRun: {
          pending: true,
          username: 'local-operator',
          token: TOKEN_SENTINEL,
          password: PASSWORD_SENTINEL,
        },
      })
    ).toEqual({
      username: 'local-operator',
      token: TOKEN_SENTINEL,
      password: PASSWORD_SENTINEL,
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
          password: PASSWORD_SENTINEL,
        },
      })
    ).toBeNull()
  })
})

describe('first-run credential fetch', () => {
  it('returns ready credentials from a pending envelope', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        firstRun: {
          pending: true,
          username: 'local-operator',
          token: TOKEN_SENTINEL,
          password: PASSWORD_SENTINEL,
        },
      }),
    })

    await expect(fetchFirstRunCredentials()).resolves.toEqual({
      kind: 'ready',
      credentials: {
        username: 'local-operator',
        token: TOKEN_SENTINEL,
        password: PASSWORD_SENTINEL,
      },
    })
  })

  it('treats 404 as not pending so INIT can skip to login', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'first_run_not_pending' }),
    })

    await expect(fetchFirstRunCredentials()).resolves.toEqual({
      kind: 'not_pending',
    })
  })

  it('treats 503 first_run_vault_not_ready as wait-and-retry, not skip', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: FIRST_RUN_VAULT_NOT_READY }),
    })

    await expect(fetchFirstRunCredentials()).resolves.toEqual({
      kind: 'vault_not_ready',
    })
  })
})

describe('first-run vault backup copy', () => {
  it('names the Broker path and field names without secret values', () => {
    expect(FIRST_RUN_VAULT_BACKUP_COPY).toContain(LOCAL_OPERATOR_VAULT_PATH)
    for (const fieldName of LOCAL_OPERATOR_VAULT_FIELD_NAMES) {
      expect(FIRST_RUN_VAULT_BACKUP_COPY).toContain(fieldName)
    }
    expect(FIRST_RUN_VAULT_BACKUP_COPY).not.toContain(TOKEN_SENTINEL)
    expect(FIRST_RUN_VAULT_BACKUP_COPY).not.toContain(PASSWORD_SENTINEL)
    expect(FIRST_RUN_VAULT_BACKUP_COPY).not.toMatch(/^[A-Z_]+=/m)
  })
})
