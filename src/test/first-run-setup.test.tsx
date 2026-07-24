import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { setFirstRunSetupFixtureForTests } from '@/lib/service-lasso-dashboard/stub'
import { renderRoute } from './render-route'

afterEach(() => {
  setFirstRunSetupFixtureForTests(null)
})

describe('first-run setup gate', () => {
  it('requires generated vault key save confirmation before showing the app shell', async () => {
    const user = userEvent.setup()
    setFirstRunSetupFixtureForTests({
      status: 'generated_key_pending_ack',
      required: true,
      vault: {
        id: 'vault-local',
        name: 'Local operator vault',
        keySource: 'generated',
        keyFingerprint: 'sha256:demo-generated',
        keyReveal: {
          value: 'slv_demo_generated_key_material',
          generatedAt: '2026-07-24T05:30:00+10:00',
          acknowledged: false,
        },
      },
      rootOwner: {
        id: 'root-local',
        displayName: 'Local root owner',
        createdAt: null,
      },
      machine: {
        hostname: 'admin-workstation',
        osUser: 'local-operator',
        platform: 'win32',
      },
      warnings: [],
      nextActions: ['Save the generated vault key.'],
    })

    await renderRoute('/')

    expect(
      await screen.findByRole('heading', {
        name: /Service Lasso first-run setup/i,
      })
    ).toBeVisible()
    expect(screen.getByText('slv_demo_generated_key_material')).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Confirm saved/i })
    ).toBeDisabled()

    await user.click(screen.getByLabelText(/Confirm vault key saved/i))
    await user.click(screen.getByRole('button', { name: /Confirm saved/i }))

    await waitFor(() => {
      expect(
        screen.queryByText('slv_demo_generated_key_material')
      ).not.toBeInTheDocument()
    })
    expect(
      await screen.findByRole('heading', { name: /^Dashboard$/i })
    ).toBeVisible()
  })

  it('shows supplied vault key source metadata without revealing raw key material', async () => {
    setFirstRunSetupFixtureForTests({
      status: 'required',
      required: true,
      vault: {
        id: 'vault-headless',
        name: 'Headless vault',
        keySource: 'secret_file',
        keyFingerprint: 'sha256:external-key',
        keyReveal: null,
      },
      rootOwner: {
        id: 'root-headless',
        displayName: 'Headless root owner',
        createdAt: null,
      },
      machine: {
        hostname: 'container-host',
        osUser: 'svc-lasso',
        platform: 'linux',
      },
      warnings: [],
      nextActions: ['Complete setup with the supplied key source.'],
    })

    await renderRoute('/')

    expect(
      await screen.findByRole('heading', {
        name: /Service Lasso first-run setup/i,
      })
    ).toBeVisible()
    expect(screen.getByText(/Externally supplied key/i)).toBeVisible()
    expect(screen.getByText('sha256:external-key')).toBeVisible()
    expect(
      screen.queryByText(/slv_demo_generated_key_material/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Confirm saved/i })
    ).not.toBeInTheDocument()
  })
})
