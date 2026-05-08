import { renderRoute } from '@/test/render-route'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  policySimulationHasSecretMaterial,
  policySimulationScenarios,
} from './policy-simulation'

describe('Secrets Broker policy simulation surface', () => {
  it('renders an allowed read dry-run without resolving secret values', async () => {
    await renderRoute('/secrets-policy-simulation')

    expect(
      await screen.findByRole('heading', {
        name: /Secrets Broker policy simulation/i,
      })
    ).toBeVisible()
    expect(
      screen.getByText(/Simulation only — no broker mutation/i)
    ).toBeVisible()
    expect(screen.getByText(/Allowed service read/i)).toBeVisible()
    expect(screen.getAllByText(/Allowed/i)[0]).toBeVisible()
    expect(screen.getAllByText(/@serviceadmin/i)[0]).toBeVisible()
    expect(
      screen.getByText(
        /secret:\/\/local\/default\/@serviceadmin\/DIAGNOSTICS_SALT/i
      )
    ).toBeVisible()
    expect(screen.getByText(/mutation: none/i)).toBeVisible()
    expect(screen.getByText(/policy:\/\/secrets\/serviceadmin/i)).toBeVisible()
    expect(
      screen.queryByText(/correct-horse|sk_live|bearer\s+[a-z0-9]/i)
    ).not.toBeInTheDocument()
  })

  it('covers denied unknown locked and source-auth-required outcomes', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-policy-simulation')

    await user.selectOptions(
      screen.getByLabelText(/Simulation scenario/i),
      'denied-write'
    )
    expect(screen.getByText(/Write-back would be denied/i)).toBeVisible()
    expect(screen.getAllByText(/Denied/i)[0]).toBeVisible()
    expect(screen.getByText(/rotation-readonly/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Simulation scenario/i),
      'missing-ref'
    )
    expect(screen.getByText(/Ref existence is unknown/i)).toBeVisible()
    expect(screen.getAllByText(/Unknown \/ missing ref/i)[0]).toBeVisible()
    expect(screen.getByText(/MISSING_ARCHIVE_KEY/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Simulation scenario/i),
      'locked-source'
    )
    expect(screen.getByText(/Source is locked/i)).toBeVisible()
    expect(screen.getAllByText(/Locked/i)[0]).toBeVisible()
    expect(screen.getByText(/providers\/local\/locked/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Simulation scenario/i),
      'source-auth-required'
    )
    expect(screen.getByText(/External source auth is required/i)).toBeVisible()
    expect(screen.getAllByText(/Source auth required/i)[0]).toBeVisible()
    expect(
      screen.getByText(/providers\/1password\/auth-required/i)
    ).toBeVisible()
  })

  it('keeps policy simulation fixtures free of secret material', () => {
    expect(policySimulationScenarios).toHaveLength(5)
    expect(policySimulationHasSecretMaterial()).toBe(false)
  })
})
