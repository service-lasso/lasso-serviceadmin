export type ReleaseArtifactSource =
  | 'packaged-release-artifact'
  | 'exact-release-candidate'
  | 'frontend-fixture-mode'

export type QualificationPlatform =
  | 'windows-named-pipe'
  | 'linux-unix-socket'
  | 'loopback-development'

export type QualificationJourneyId =
  | 'fresh-setup'
  | 'existing-vault-restart'
  | 'state-ready'
  | 'state-locked'
  | 'state-setup-needed'
  | 'state-auth-required'
  | 'state-denied'
  | 'state-degraded'
  | 'state-unavailable'
  | 'inventory-search-filter-pagination'
  | 'reveal-with-expiry'
  | 'mutate-secret-lifecycle'
  | 'provider-validate-configure-reconnect'
  | 'migration-and-bulk-campaign'
  | 'audit-telemetry-events-lockout'
  | 'backup-key-rotation-restore'
  | 'topology-startup-impact'

export type QualificationJourneyRequirement = {
  id: QualificationJourneyId
  title: string
  requiresDurableMutation: boolean
  requiresRestartProof: boolean
  requiresAuditEvents: boolean
  requiresNoLeakSentinels: boolean
}

export type QualificationVersions = {
  expected: string
  catalog: string
  installed: string
  live: string
}

export type QualificationJourneyResult = {
  id: QualificationJourneyId
  passed: boolean
  auditEventCount?: number
  noLeakSentinelCount?: number
  restartProof?: boolean
  durableMutationProof?: boolean
}

export type SecretsBrokerReleaseQualificationRun = {
  artifactSource: ReleaseArtifactSource
  versions: Partial<QualificationVersions>
  platforms: QualificationPlatform[]
  journeys: QualificationJourneyResult[]
}

export const requiredQualificationPlatforms: QualificationPlatform[] = [
  'windows-named-pipe',
  'linux-unix-socket',
]

export const compatibilityOnlyPlatforms: QualificationPlatform[] = [
  'loopback-development',
]

export const secretsBrokerQualificationJourneys: QualificationJourneyRequirement[] =
  [
    {
      id: 'fresh-setup',
      title: 'Fresh setup',
      requiresDurableMutation: true,
      requiresRestartProof: true,
      requiresAuditEvents: true,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'existing-vault-restart',
      title: 'Existing vault restart',
      requiresDurableMutation: false,
      requiresRestartProof: true,
      requiresAuditEvents: true,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'state-ready',
      title: 'Ready state',
      requiresDurableMutation: false,
      requiresRestartProof: false,
      requiresAuditEvents: false,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'state-locked',
      title: 'Locked state',
      requiresDurableMutation: false,
      requiresRestartProof: false,
      requiresAuditEvents: true,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'state-setup-needed',
      title: 'Setup-needed state',
      requiresDurableMutation: false,
      requiresRestartProof: false,
      requiresAuditEvents: false,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'state-auth-required',
      title: 'Auth-required state',
      requiresDurableMutation: false,
      requiresRestartProof: false,
      requiresAuditEvents: true,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'state-denied',
      title: 'Denied state',
      requiresDurableMutation: false,
      requiresRestartProof: false,
      requiresAuditEvents: true,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'state-degraded',
      title: 'Degraded state',
      requiresDurableMutation: false,
      requiresRestartProof: false,
      requiresAuditEvents: false,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'state-unavailable',
      title: 'Unavailable state',
      requiresDurableMutation: false,
      requiresRestartProof: false,
      requiresAuditEvents: false,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'inventory-search-filter-pagination',
      title: 'Inventory search, filter, and pagination',
      requiresDurableMutation: false,
      requiresRestartProof: false,
      requiresAuditEvents: false,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'reveal-with-expiry',
      title: 'Reveal with expiry',
      requiresDurableMutation: false,
      requiresRestartProof: false,
      requiresAuditEvents: true,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'mutate-secret-lifecycle',
      title: 'Create, edit, reset, rotate, policy, and delete/decommission',
      requiresDurableMutation: true,
      requiresRestartProof: true,
      requiresAuditEvents: true,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'provider-validate-configure-reconnect',
      title: 'Provider validate, configure, and reconnect',
      requiresDurableMutation: true,
      requiresRestartProof: true,
      requiresAuditEvents: true,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'migration-and-bulk-campaign',
      title: 'Migration and bulk campaign',
      requiresDurableMutation: true,
      requiresRestartProof: true,
      requiresAuditEvents: true,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'audit-telemetry-events-lockout',
      title: 'Audit, telemetry, events, and lockout',
      requiresDurableMutation: false,
      requiresRestartProof: false,
      requiresAuditEvents: true,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'backup-key-rotation-restore',
      title: 'Backup, key rotation, and restore',
      requiresDurableMutation: true,
      requiresRestartProof: true,
      requiresAuditEvents: true,
      requiresNoLeakSentinels: true,
    },
    {
      id: 'topology-startup-impact',
      title: 'Topology and startup impact',
      requiresDurableMutation: false,
      requiresRestartProof: true,
      requiresAuditEvents: false,
      requiresNoLeakSentinels: true,
    },
  ]

export function validateSecretsBrokerReleaseQualificationRun(
  run: SecretsBrokerReleaseQualificationRun
): string[] {
  const gaps: string[] = []

  if (run.artifactSource === 'frontend-fixture-mode') {
    gaps.push('frontend fixture mode cannot satisfy release qualification')
  }

  for (const field of ['expected', 'catalog', 'installed', 'live'] as const) {
    if (!run.versions[field]) {
      gaps.push(`missing ${field} version evidence`)
    }
  }

  for (const platform of requiredQualificationPlatforms) {
    if (!run.platforms.includes(platform)) {
      gaps.push(`missing required platform ${platform}`)
    }
  }

  for (const requirement of secretsBrokerQualificationJourneys) {
    const result = run.journeys.find((journey) => journey.id === requirement.id)

    if (!result) {
      gaps.push(`missing journey ${requirement.id}`)
      continue
    }

    if (!result.passed) {
      gaps.push(`journey ${requirement.id} did not pass`)
    }

    if (requirement.requiresAuditEvents && !result.auditEventCount) {
      gaps.push(`journey ${requirement.id} is missing audit event proof`)
    }

    if (requirement.requiresNoLeakSentinels && !result.noLeakSentinelCount) {
      gaps.push(`journey ${requirement.id} is missing no-leak sentinels`)
    }

    if (requirement.requiresRestartProof && !result.restartProof) {
      gaps.push(`journey ${requirement.id} is missing restart proof`)
    }

    if (requirement.requiresDurableMutation && !result.durableMutationProof) {
      gaps.push(`journey ${requirement.id} is missing durable mutation proof`)
    }
  }

  return gaps
}
