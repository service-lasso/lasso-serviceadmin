import { describe, expect, it } from 'vitest'
import {
  policySimulationHasSecretMaterial,
  policySimulationScenarios,
} from './policy-simulation'

describe('Secrets Broker policy simulation fixtures', () => {
  it('keeps policy simulation fixtures free of secret material', () => {
    expect(policySimulationScenarios).toHaveLength(5)
    expect(policySimulationHasSecretMaterial()).toBe(false)
  })
})
