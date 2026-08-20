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
  it('bootstraps the protected local broker without rendering key material', async () => {
    const user = userEvent.setup()
    setFirstRunSetupFixtureForTests({
      state: 'setup_required',
      setupMode: true,
      vault: { required: true, ready: false },
      operator: { osUsername: 'local-operator', identitySource: 'vault' },
      trustBoundary: {
        bindHost: '127.0.0.1',
        localOnly: true,
        localhostBootstrapAllowed: true,
        remoteBootstrapAllowed: false,
        setupTokenConfigured: false,
        blockers: [],
      },
    })

    await renderRoute('/')

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
    expect(await screen.findByText('Runtime health')).toBeVisible()
  })

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

    await renderRoute('/')
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

  it('renders a retryable error without leaking the bootstrap failure', async () => {
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

    await renderRoute('/')
    await user.click(
      await screen.findByRole('button', {
        name: /Initialize Secrets Broker/i,
      })
    )

    expect(await screen.findByText(/Bootstrap did not complete/i)).toBeVisible()
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

    await renderRoute('/')
    expect(await screen.findByText(/Bootstrap blocked/i)).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Initialize Secrets Broker/i })
    ).toBeDisabled()
  })

  it('fails closed visibly when the setup-status contract is unavailable', async () => {
    vi.spyOn(dashboardStub, 'fetchFirstRunSetupState').mockRejectedValueOnce(
      new Error('fixture runtime response must not be rendered')
    )

    const { queryClient } = await renderRoute('/')
    await queryClient.invalidateQueries({
      queryKey: ['service-lasso-first-run-setup'],
    })

    expect(
      await screen.findByText(/First-run setup status unavailable/i)
    ).toBeVisible()
    expect(document.body.textContent).not.toContain('fixture runtime response')
  })
})
