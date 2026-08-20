import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
})

describe('FirstRunCredentialsPanel', () => {
  it('requires copy and confirm before acknowledge, then posts acknowledge', async () => {
    const user = userEvent.setup()
    const onAcknowledged = vi.fn()
    fetchMock
      .mockResolvedValueOnce({
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

    expect(
      await screen.findByText(
        /already stored in Secrets Broker at runtime\/local-operator/i
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/LOCAL_ADMIN_TOKEN/)).toBeInTheDocument()
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
    fetchMock.mockResolvedValue({
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

    render(<FirstRunCredentialsPanel onAcknowledged={onAcknowledged} />)

    expect(
      await screen.findByRole('button', { name: /continue after saving/i })
    ).toBeDisabled()
    expect(onAcknowledged).not.toHaveBeenCalled()
  })

  it('retries when Broker ingest is not ready instead of skipping INIT', async () => {
    const onAcknowledged = vi.fn()
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'first_run_vault_not_ready' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          firstRun: {
            pending: true,
            username: 'local-operator',
            token: TOKEN_SENTINEL,
            password: PASSWORD_SENTINEL,
            vaultPath: 'runtime/local-operator',
          },
        }),
      })

    render(<FirstRunCredentialsPanel onAcknowledged={onAcknowledged} />)

    expect(
      await screen.findByText(
        /waiting for secrets broker to store first-run credentials/i
      )
    ).toBeInTheDocument()
    expect(onAcknowledged).not.toHaveBeenCalled()

    expect(
      await screen.findByDisplayValue('local-operator', {}, { timeout: 3000 })
    ).toBeInTheDocument()
    expect(onAcknowledged).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: /continue after saving/i })
    ).toBeDisabled()
  })
})
