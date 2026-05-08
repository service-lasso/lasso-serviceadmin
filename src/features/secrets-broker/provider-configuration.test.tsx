import { renderRoute } from '@/test/render-route'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  configurationFixturesHaveSecretMaterial,
  migrationPlans,
  providerConfigurations,
} from './provider-configuration'

describe('Secrets Broker provider configuration page', () => {
  it('renders provider configuration and migration screen without credential or raw value leakage', async () => {
    await renderRoute('/secrets-broker/configuration')

    expect(
      await screen.findByRole('heading', { name: /^Configuration$/i })
    ).toBeVisible()
    expect(screen.getByText(/Handles only · dry-run first/i)).toBeVisible()
    expect(screen.getByText(/Current provider\/backend summary/i)).toBeVisible()
    expect(screen.getByText(/Credential values shown/i)).toBeVisible()
    expect(screen.getByText(/Migration dry-run \/ apply/i)).toBeVisible()
    expect(screen.getByText(/Provider credentials hidden/i)).toBeVisible()
    expect(
      screen.queryByText(/fixture-provider-credential-value/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/fixture-managed-secret-value/i)
    ).not.toBeInTheDocument()
  })

  it('covers provider validation states safely', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/configuration')

    await user.selectOptions(
      screen.getByLabelText(/Provider state scenario/i),
      'healthy'
    )
    expect(screen.getByText(/Provider configuration validated/i)).toBeVisible()
    expect(
      screen.getByText(
        /ref:secret:\/\/local\/provider\/vault-prod\/credential-handle/i
      )
    ).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Provider state scenario/i),
      'auth-required'
    )
    expect(
      screen.getByText(/Provider requires credential ref refresh/i)
    ).toBeVisible()
    expect(screen.getByText(/do not paste provider credentials/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Provider state scenario/i),
      'unsupported'
    )
    expect(screen.getByText(/cannot be a migration target/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Provider state scenario/i),
      'validation-failed'
    )
    expect(screen.getByText(/Validation failed closed/i)).toBeVisible()
    expect(
      screen.queryByText(/fixture-provider-credential-value/i)
    ).not.toBeInTheDocument()
  })

  it('covers migration dry-run apply gating and partial failure states', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/configuration')

    expect(
      screen.getByText(
        /Migration apply disabled until confirmation and audit reason/i
      )
    ).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Migration state scenario/i),
      'dry-run-partial'
    )
    expect(screen.getByText(/Migration dry-run partial denial/i)).toBeVisible()
    expect(screen.getByText(/partial_failure/i)).toBeVisible()
    expect(screen.getByText(/review policy and rerun dry-run/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Migration state scenario/i),
      'apply-ready'
    )
    await user.type(
      screen.getByLabelText(/Audit reason/i),
      'approved migration'
    )
    await user.click(
      screen.getByRole('button', { name: /Record confirmation/i })
    )
    expect(
      screen.getByRole('button', { name: /Migration apply ready/i })
    ).toBeEnabled()

    await user.selectOptions(
      screen.getByLabelText(/Migration state scenario/i),
      'apply-partial'
    )
    expect(screen.getAllByText(/Migration partial failure/i)[0]).toBeVisible()
    expect(screen.getByText(/Unmigrated refs remain on source/i)).toBeVisible()
    expect(
      screen.queryByText(/fixture-managed-secret-value/i)
    ).not.toBeInTheDocument()
  })

  it('keeps provider and migration fixtures free of secret material', () => {
    expect(configurationFixturesHaveSecretMaterial()).toBe(false)
    expect(providerConfigurations.healthy.credentialHandle).toContain('ref:')
    expect(migrationPlans['dry-run-partial'].items).toHaveLength(3)
    expect(
      migrationPlans['apply-ready'].applyEnabled,
      'apply-ready requires UI confirmation and audit reason before button enables'
    ).toBe(true)
  })
})
