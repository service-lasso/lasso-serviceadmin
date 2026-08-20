import { describe, expect, it } from 'vitest'
import {
  requiredQualificationPlatforms,
  secretsBrokerQualificationJourneys,
  type SecretsBrokerReleaseQualificationRun,
  validateSecretsBrokerReleaseQualificationRun,
} from './secrets-release-qualification'

function completeRun(): SecretsBrokerReleaseQualificationRun {
  return {
    artifactSource: 'exact-release-candidate',
    versions: {
      expected: '2026.8.1-rc.1',
      catalog: '2026.8.1-rc.1',
      installed: '2026.8.1-rc.1',
      live: '2026.8.1-rc.1',
    },
    platforms: [...requiredQualificationPlatforms],
    journeys: secretsBrokerQualificationJourneys.map((journey) => ({
      id: journey.id,
      passed: true,
      auditEventCount: journey.requiresAuditEvents ? 1 : 0,
      durableMutationProof: journey.requiresDurableMutation,
      noLeakSentinelCount: journey.requiresNoLeakSentinels ? 1 : 0,
      restartProof: journey.requiresRestartProof,
    })),
  }
}

describe('Secrets Broker release qualification contract', () => {
  it('accepts a complete exact release candidate run', () => {
    expect(validateSecretsBrokerReleaseQualificationRun(completeRun())).toEqual(
      []
    )
  })

  it('rejects fixture-mode proof and missing release version evidence', () => {
    const run = completeRun()
    run.artifactSource = 'frontend-fixture-mode'
    run.versions.live = ''

    expect(validateSecretsBrokerReleaseQualificationRun(run)).toEqual([
      'frontend fixture mode cannot satisfy release qualification',
      'missing live version evidence',
    ])
  })

  it('requires named-pipe, unix-socket, audit, restart, mutation, and no-leak proof', () => {
    const run = completeRun()
    run.platforms = ['loopback-development']
    run.journeys = [
      {
        id: 'mutate-secret-lifecycle',
        passed: true,
      },
    ]

    expect(validateSecretsBrokerReleaseQualificationRun(run)).toContain(
      'missing required platform windows-named-pipe'
    )
    expect(validateSecretsBrokerReleaseQualificationRun(run)).toContain(
      'missing required platform linux-unix-socket'
    )
    expect(validateSecretsBrokerReleaseQualificationRun(run)).toContain(
      'journey mutate-secret-lifecycle is missing audit event proof'
    )
    expect(validateSecretsBrokerReleaseQualificationRun(run)).toContain(
      'journey mutate-secret-lifecycle is missing no-leak sentinels'
    )
    expect(validateSecretsBrokerReleaseQualificationRun(run)).toContain(
      'journey mutate-secret-lifecycle is missing restart proof'
    )
    expect(validateSecretsBrokerReleaseQualificationRun(run)).toContain(
      'journey mutate-secret-lifecycle is missing durable mutation proof'
    )
    expect(validateSecretsBrokerReleaseQualificationRun(run)).toContain(
      'missing journey fresh-setup'
    )
  })
})
