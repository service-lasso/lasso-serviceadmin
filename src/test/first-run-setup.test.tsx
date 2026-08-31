import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as dashboardStub from '@/lib/service-lasso-dashboard/stub'
import { setFirstRunSetupFixtureForTests } from '@/lib/service-lasso-dashboard/stub'
import { renderRoute } from './render-route'

afterEach(() => {
  vi.restoreAllMocks()
  setFirstRunSetupFixtureForTests(null)
})

describe('first-run setup gate', () => {
  it(
    'bootstraps the protected local broker without rendering key material',
    { timeout: 60_000 },
    async () => {
      const user = userEvent.setup()
      setFirstRunSetupFixtureForTests({
        state: 'setup_required',
        setupMode: true,
        vault: { required: true, ready: false },
        operator: {
          osUsername: 'local-operator',
          identitySource: 'vault',
        },
        trustBoundary: {
          bindHost: '127.0.0.1',
          localOnly: true,
          localhostBootstrapAllowed: true,
          remoteBootstrapAllowed: false,
          setupTokenConfigured: false,
          blockers: [],
        },
      })

      const { queryClient } = await renderRoute('/', {
        firstRunSetupGate: true,
      })

      expect(
        await screen.findByRole('heading', {
          name: /Service Lasso first-run setup/i,
        })
      ).toBeVisible()
      expect(screen.getByText(/No master key is shown/i)).toBeVisible()
      expect(screen.queryByText(/recovery key/i)).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /copy/i })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /download/i })
      ).not.toBeInTheDocument()

      await user.click(
        screen.getByRole('button', { name: /Initialize Secrets Broker/i })
      )

      await waitFor(() => {
        expect(
          screen.queryByRole('heading', {
            name: /Service Lasso first-run setup/i,
          })
        ).not.toBeInTheDocument()
      })
      await waitFor(() => {
        expect(
          queryClient.getQueryData(['service-lasso-first-run-setup'])
        ).toMatchObject({
          state: 'not_required',
          setupMode: false,
          vault: { ready: true },
        })
      })
      await screen.findByRole('heading', { name: /^Dashboard$/i })
    }
  )

  it('requires a transient token for an authorized remote bootstrap', async () => {
    const user = userEvent.setup()
    setFirstRunSetupFixtureForTests({
      state: 'setup_required',
      setupMode: true,
      vault: { required: true, ready: false },
      trustBoundary: {
        bindHost: '0.0.0.0',
        localOnly: false,
        localhostBootstrapAllowed: false,
        remoteBootstrapAllowed: true,
        setupTokenConfigured: true,
        blockers: [],
      },
    })

    await renderRoute('/', { firstRunSetupGate: true })

    const submit = await screen.findByRole('button', {
      name: /Initialize Secrets Broker/i,
    })
    const token = screen.getByLabelText(/One-time setup token/i)
    expect(submit).toBeDisabled()
    await user.type(token, 'fixture-setup-token')
    expect(submit).toBeEnabled()
    await user.click(submit)

    await waitFor(() => {
      expect(
        screen.queryByDisplayValue('fixture-setup-token')
      ).not.toBeInTheDocument()
    })
    expect(document.body.textContent).not.toContain('fixture-setup-token')
  })

  it('renders a retryable error when protected bootstrap fails', async () => {
    const user = userEvent.setup()
    setFirstRunSetupFixtureForTests({
      state: 'setup_required',
      setupMode: true,
      vault: { required: true, ready: false },
      trustBoundary: {
        bindHost: '127.0.0.1',
        localOnly: true,
        localhostBootstrapAllowed: true,
        remoteBootstrapAllowed: false,
        setupTokenConfigured: false,
        blockers: [],
      },
    })
    vi.spyOn(dashboardStub, 'bootstrapFirstRunSetup').mockRejectedValueOnce(
      new Error('safe fixture failure')
    )

    await renderRoute('/', { firstRunSetupGate: true })
    await user.click(
      await screen.findByRole('button', {
        name: /Initialize Secrets Broker/i,
      })
    )

    expect(await screen.findByText(/Bootstrap did not complete/i)).toBeVisible()
    expect(
      screen.getByRole('heading', { name: /Service Lasso first-run setup/i })
    ).toBeVisible()
    expect(document.body.textContent).not.toContain('safe fixture failure')
  })

  it('fails closed when remote bootstrap has no configured token policy', async () => {
    setFirstRunSetupFixtureForTests({
      state: 'setup_required',
      setupMode: true,
      vault: { required: true, ready: false },
      trustBoundary: {
        bindHost: '0.0.0.0',
        localOnly: false,
        localhostBootstrapAllowed: false,
        remoteBootstrapAllowed: false,
        setupTokenConfigured: false,
        blockers: ['setup_token_required_for_remote_bind'],
      },
    })

    await renderRoute('/', { firstRunSetupGate: true })

    expect(await screen.findByText(/Bootstrap blocked/i)).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Initialize Secrets Broker/i })
    ).toBeDisabled()
  })

  it('recreates from first-run when the master key is lost without collecting key material', async () => {
    const user = userEvent.setup()
    setFirstRunSetupFixtureForTests({
      state: 'lost_key',
      setupMode: true,
      vault: { required: true, ready: false },
      operator: {
        osUsername: 'local-operator',
        identitySource: 'vault',
      },
      trustBoundary: {
        bindHost: '127.0.0.1',
        localOnly: true,
        localhostBootstrapAllowed: true,
        remoteBootstrapAllowed: false,
        setupTokenConfigured: false,
        blockers: [],
      },
    })

    await renderRoute('/', { firstRunSetupGate: true })

    expect(
      await screen.findByText(/Lost key requires store recreate/i)
    ).toBeVisible()
    expect(
      screen.getByText(/previous master key is never entered/i)
    ).toBeVisible()
    expect(screen.queryByLabelText(/master key/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/recovery share/i)).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: /Initialize Secrets Broker from a new store/i,
      })
    )

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          name: /Service Lasso first-run setup/i,
        })
      ).not.toBeInTheDocument()
    })
  })
})
