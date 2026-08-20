export type PolicySimulationOutcome =
  | 'allowed'
  | 'denied'
  | 'unknown'
  | 'locked'
  | 'source-auth-required'

export type PolicySimulationAction = 'read' | 'write' | 'write-back' | 'rotate'

export interface PolicySimulationScenario {
  id: string
  label: string
  outcome: PolicySimulationOutcome
  identity: {
    service: string
    workflow: string
    runRef: string
  }
  request: {
    namespace: string
    ref: string
    action: PolicySimulationAction
  }
  decision: {
    title: string
    reason: string
    policyRef: string
    sourceRef: string
    lifecycleRef: string
    auditRef: string
    dryRunMutation: 'none'
  }
  nextAction: string
}

export const policyOutcomeCopy: Record<PolicySimulationOutcome, string> = {
  allowed: 'Allowed',
  denied: 'Denied',
  unknown: 'Unknown / missing ref',
  locked: 'Locked',
  'source-auth-required': 'Source auth required',
}

export const policySimulationScenarios: PolicySimulationScenario[] = [
  {
    id: 'allowed-read',
    label: 'Allowed service read',
    outcome: 'allowed',
    identity: {
      service: '@serviceadmin',
      workflow: 'diagnostics-support-bundle',
      runRef: 'run://serviceadmin/diagnostics/2026-05-08T13:28Z',
    },
    request: {
      namespace: 'service-lasso/runtime',
      ref: 'secret://local/default/@serviceadmin/DIAGNOSTICS_SALT',
      action: 'read',
    },
    decision: {
      title: 'Read would be allowed',
      reason:
        'The service identity has read access to this namespace and the local encrypted source is available.',
      policyRef: 'policy://secrets/serviceadmin/read-runtime-metadata',
      sourceRef: 'source://local/default',
      lifecycleRef: 'lifecycle://@secretsbroker/providers/local/ready',
      auditRef: 'audit://policy-sim/sim_8f23_allowed',
      dryRunMutation: 'none',
    },
    nextAction:
      'Proceed only if the calling workflow still avoids logging or rendering resolved values.',
  },
  {
    id: 'denied-write',
    label: 'Denied write-back',
    outcome: 'denied',
    identity: {
      service: 'payments-api',
      workflow: 'stripe-key-rotation',
      runRef: 'run://dagu/payments/rotate-stripe-key/dry-run',
    },
    request: {
      namespace: 'service-lasso/payments',
      ref: 'secret://vault/kv/service-lasso/payments/STRIPE_KEY',
      action: 'write-back',
    },
    decision: {
      title: 'Write-back would be denied',
      reason:
        'The workflow identity can request rotation but cannot write to the production payments namespace.',
      policyRef: 'policy://secrets/payments/rotation-readonly',
      sourceRef: 'source://vault-east/kv',
      lifecycleRef: 'lifecycle://@secretsbroker/providers/vault-east/ready',
      auditRef: 'audit://policy-sim/sim_9d41_denied',
      dryRunMutation: 'none',
    },
    nextAction:
      'Request a scoped break-glass policy or run through the approved production rotation workflow.',
  },
  {
    id: 'missing-ref',
    label: 'Missing ref lookup',
    outcome: 'unknown',
    identity: {
      service: 'backup-worker',
      workflow: 'nightly-offsite-backup',
      runRef: 'run://dagu/backup/nightly/dry-run',
    },
    request: {
      namespace: 'service-lasso/backups',
      ref: 'secret://vault/kv/service-lasso/backups/MISSING_ARCHIVE_KEY',
      action: 'read',
    },
    decision: {
      title: 'Ref existence is unknown',
      reason:
        'The namespace policy can be evaluated, but the source reports no metadata for this ref.',
      policyRef: 'policy://secrets/backups/read',
      sourceRef: 'source://vault-east/kv',
      lifecycleRef: 'lifecycle://@secretsbroker/providers/vault-east/ready',
      auditRef: 'audit://policy-sim/sim_2c11_unknown',
      dryRunMutation: 'none',
    },
    nextAction:
      'Create the ref metadata or correct the workflow reference before starting the backup run.',
  },
  {
    id: 'locked-source',
    label: 'Locked local source',
    outcome: 'locked',
    identity: {
      service: '@serviceadmin',
      workflow: 'local-dev-startup',
      runRef: 'run://local/serviceadmin/startup/checks',
    },
    request: {
      namespace: 'service-lasso/local-dev',
      ref: 'secret://local/default/@serviceadmin/SESSION_SECRET',
      action: 'read',
    },
    decision: {
      title: 'Source is locked',
      reason:
        'Policy permits the request, but the local encrypted store is locked and cannot provide ref metadata.',
      policyRef: 'policy://secrets/local-dev/read',
      sourceRef: 'source://local/default',
      lifecycleRef: 'lifecycle://@secretsbroker/providers/local/locked',
      auditRef: 'audit://policy-sim/sim_77aa_locked',
      dryRunMutation: 'none',
    },
    nextAction:
      'Unlock or re-wrap the local store, then rerun the simulation before service startup.',
  },
  {
    id: 'source-auth-required',
    label: 'External source auth required',
    outcome: 'source-auth-required',
    identity: {
      service: 'customer-sync',
      workflow: 'sync-crm-nightly',
      runRef: 'run://dagu/customer-sync/nightly/dry-run',
    },
    request: {
      namespace: 'service-lasso/customer-sync',
      ref: 'secret://op/service-lasso/customer-sync/CRM_API_TOKEN',
      action: 'read',
    },
    decision: {
      title: 'External source auth is required',
      reason:
        'The policy can be evaluated, but the password-manager source requires operator authentication first.',
      policyRef: 'policy://secrets/customer-sync/read',
      sourceRef: 'source://1password/service-lasso',
      lifecycleRef:
        'lifecycle://@secretsbroker/providers/1password/auth-required',
      auditRef: 'audit://policy-sim/sim_4f19_auth_required',
      dryRunMutation: 'none',
    },
    nextAction:
      'Authenticate the external source and rerun the dry-run before starting the workflow.',
  },
]

export function policySimulationHasSecretMaterial(
  scenarios = policySimulationScenarios
): boolean {
  const serialized = JSON.stringify(scenarios)
  return (
    /\b(bearer|basic)\s+(?!auth\b)[a-z0-9._~+/=-]{8,}/i.test(serialized) ||
    /\b(access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|client[_-]?secret|session[_-]?secret|password|private[_-]?key|recovery[_-]?key|env[_-]?value)\s*[:=]\s*([^\s,;]+)/i.test(
      serialized
    ) ||
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(serialized)
  )
}
