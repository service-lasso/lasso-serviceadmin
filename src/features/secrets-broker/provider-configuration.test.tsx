import { describe, expect, it } from 'vitest'
import {
  configurationFixturesHaveSecretMaterial,
  migrationPlans,
  providerConfigurations,
} from './provider-configuration'

describe('Secrets Broker provider configuration fixtures', () => {
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
