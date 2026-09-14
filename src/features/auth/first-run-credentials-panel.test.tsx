import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as firstRunCredentials from '@/lib/service-lasso-dashboard/first-run-credentials'
import { FirstRunCredentialsPanel } from './first-run-credentials-panel'

const TOKEN_SENTINEL = 'test-local-admin-token'
const PASSWORD_SENTINEL = 'test-local-operator-password'

const fetchMock = vi.fn()
const writeTextMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  writeTextMock.mockReset()
  writeTextMock.mockResolvedValue(undefined)
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: writeTextMock },
  })
  vi.spyOn(firstRunCredentials, 'delayFirstRunVaultRetry').mockResolvedValue(
    undefined
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function pendingEnvelopeResponse() {
  return {
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
  }
}

describe('FirstRunCredentialsPanel', () => {
  it('requires copy and confirm before acknowledge, then posts acknowledge', async () => {
    const user = userEvent.setup()
    const onAcknowledged = vi.fn()
    fetchMock
      .mockResolvedValueOnce(pendingEnvelopeResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          firstRun: { pending: false, credentialsAcknowledged: true },
        }),
      })

    render(<FirstRunCredentialsPanel onAcknowledged={onAcknowledged} />)

    expect(
      await screen.findByDisplayValue('local-operator')
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue(TOKEN_SENTINEL)).toBeInTheDocument()
    expect(screen.getByDisplayValue(PASSWORD_SENTINEL)).toBeInTheDocument()

    const copy = screen.getByText(/already stored in secrets broker/i)
    expect(copy).toHaveTextContent('runtime/local-operator')
    expect(copy).toHaveTextContent('LOCAL_OPERATOR_USERNAME')
    expect(copy).toHaveTextContent('LOCAL_ADMIN_TOKEN')
    expect(copy).toHaveTextContent('LOCAL_OPERATOR_PASSWORD')
    expect(copy).not.toHaveTextContent(TOKEN_SENTINEL)
    expect(copy).not.toHaveTextContent(PASSWORD_SENTINEL)

    const acknowledge = screen.getByRole('button', {
      name: /continue after saving/i,
    })
    expect(acknowledge).toBeDisabled()

    await user.click(
      screen.getByRole('button', { name: /copy local-admin token/i })
    )
    await user.click(
      screen.getByRole('button', { name: /copy local-operator password/i })
    )
    expect(acknowledge).toBeDisabled()

    await user.click(screen.getByLabelText(/i saved this token/i))
    expect(acknowledge).toBeEnabled()

    await user.click(acknowledge)
    await waitFor(() => {
      expect(onAcknowledged).toHaveBeenCalledTimes(1)
    })
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/runtime/auth/first-run/acknowledge',
      { method: 'POST' }
    )
    expect(onAcknowledged).toHaveBeenCalledTimes(1)
  })

  it('does not auto-dismiss while the operator has not acknowledged', async () => {
    const onAcknowledged = vi.fn()
    fetchMock.mockResolvedValue(pendingEnvelopeResponse())

    render(<FirstRunCredentialsPanel onAcknowledged={onAcknowledged} />)

    expect(
      await screen.findByRole('button', { name: /continue after saving/i })
    ).toBeDisabled()
    expect(onAcknowledged).not.toHaveBeenCalled()
  })

  it('keeps loading and retries GET first-run on 503 first_run_vault_not_ready', async () => {
    const onAcknowledged = vi.fn()
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: firstRunCredentials.FIRST_RUN_VAULT_NOT_READY,
        }),
      })
      .mockResolvedValueOnce(pendingEnvelopeResponse())

    render(<FirstRunCredentialsPanel onAcknowledged={onAcknowledged} />)

    expect(
      screen.getByText(/loading first-run credentials/i)
    ).toBeInTheDocument()
    expect(onAcknowledged).not.toHaveBeenCalled()

    expect(
      await screen.findByRole('button', { name: /continue after saving/i })
    ).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/runtime/auth/first-run')
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/runtime/auth/first-run')
    expect(firstRunCredentials.delayFirstRunVaultRetry).toHaveBeenCalledTimes(1)
    expect(onAcknowledged).not.toHaveBeenCalled()
    expect(
      screen.queryByText(/could not load first-run credentials/i)
    ).not.toBeInTheDocument()
  })

  it('skips INIT when GET first-run returns 404 not pending', async () => {
    const onAcknowledged = vi.fn()
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'first_run_not_pending' }),
    })

    render(<FirstRunCredentialsPanel onAcknowledged={onAcknowledged} />)

    await waitFor(() => {
      expect(onAcknowledged).toHaveBeenCalledTimes(1)
    })
    expect(
      screen.queryByRole('button', { name: /continue after saving/i })
    ).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
