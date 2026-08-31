export type ProviderState =
  | 'local-default'
  | 'healthy'
  | 'auth-required'
  | 'unsupported'
  | 'validation-failed'

export type MigrationState =
  | 'dry-run-ready'
  | 'dry-run-partial'
  | 'apply-ready'
  | 'apply-success'
  | 'apply-partial'

export type ProviderCapability = {
  id: string
  label: string
  supported: boolean
}

export type ProviderConfiguration = {
  id: string
  name: string
  kind: string
  state: ProviderState
  status: string
  credentialHandle: string
  address: string
  namespaces: string[]
  capabilities: ProviderCapability[]
  nextAction: string
  auditStatus: string
  recovery: string
}

export type MigrationItem = {
  ref: string
  source: string
  target: string
  owner: string
  state: 'planned' | 'skipped' | 'denied' | 'failed' | 'migrated'
  policyResult: 'allowed' | 'denied' | 'review'
  risk: 'low' | 'medium' | 'high'
  expectedAction: string
  auditRequirement: string
  recovery: string
}

export type MigrationPlan = {
  state: MigrationState
  title: string
  outcome: string
  operationId: string
  sourceProvider: string
  targetProvider: string
  items: MigrationItem[]
  nextAction: string
  rollback: string
  applyEnabled: boolean
}

export const providerCapabilities: ProviderCapability[] = [
  { id: 'read', label: 'Read', supported: true },
  { id: 'reveal', label: 'Reveal', supported: true },
  { id: 'write', label: 'Write/update', supported: true },
  { id: 'rotate', label: 'Rotate/reset', supported: true },
  { id: 'policy', label: 'Policy', supported: true },
  { id: 'value_search', label: 'Value search', supported: true },
  { id: 'audit', label: 'Audit', supported: true },
]

export const providerConfigurations: Record<
  ProviderState,
  ProviderConfiguration
> = {
  'local-default': {
    id: 'local',
    name: 'Local encrypted store',
    kind: 'local-encrypted-store',
    state: 'local-default',
    status:
      'No external provider configured; local-first encrypted store is active.',
    credentialHandle: 'local-master-key-handle',
    address: 'loopback/local',
    namespaces: ['services/*', 'workspaces/*'],
    capabilities: providerCapabilities,
    nextAction:
      'Select a target provider and validate safe credential references before migration.',
    auditStatus: 'audit available',
    recovery: 'Encrypted backup restore is available before migration apply.',
  },
  healthy: {
    id: 'vault-prod',
    name: 'Vault production',
    kind: 'vault',
    state: 'healthy',
    status:
      'Provider configuration validated; broker reports read/reveal and migration-source readiness.',
    credentialHandle:
      'ref:secret://local/provider/vault-prod/credential-handle',
    address: 'https://vault.example.invalid',
    namespaces: ['services/*'],
    capabilities: providerCapabilities.map((capability) =>
      capability.id === 'write' || capability.id === 'rotate'
        ? { ...capability, supported: false }
        : capability
    ),
    nextAction: 'Run migration dry-run before applying any provider migration.',
    auditStatus: 'audit available',
    recovery:
      'Rerun migration for denied/failed refs after fixing provider state.',
  },
  'auth-required': {
    id: 'vault-auth-required',
    name: 'Vault auth required',
    kind: 'vault',
    state: 'auth-required',
    status:
      'Provider requires credential ref refresh before validation or migration can proceed.',
    credentialHandle: 'missing credential reference',
    address: 'https://vault.example.invalid',
    namespaces: ['services/*'],
    capabilities: providerCapabilities.map((capability) => ({
      ...capability,
      supported: capability.id === 'audit',
    })),
    nextAction:
      'Reconnect provider with a safe credential reference; do not paste provider credentials into Service Admin.',
    auditStatus: 'audit available',
    recovery: 'No migration apply until provider auth is restored.',
  },
  unsupported: {
    id: 'env-readonly',
    name: 'Environment source',
    kind: 'env',
    state: 'unsupported',
    status:
      'Read-only source can be a migration source but cannot be a migration target.',
    credentialHandle: 'not required',
    address: 'process environment',
    namespaces: ['services/*'],
    capabilities: providerCapabilities.map((capability) => ({
      ...capability,
      supported: ['read', 'audit'].includes(capability.id),
    })),
    nextAction: 'Select a provider with migration_target support.',
    auditStatus: 'audit available',
    recovery:
      'Choose local encrypted store or a write-capable provider target.',
  },
  'validation-failed': {
    id: 'vault-invalid',
    name: 'Vault validation failed',
    kind: 'vault',
    state: 'validation-failed',
    status:
      'Validation failed closed because provider address or credential handle is invalid.',
    credentialHandle: 'ref rejected by broker validation',
    address: 'https://vault.invalid',
    namespaces: ['services/*'],
    capabilities: providerCapabilities.map((capability) => ({
      ...capability,
      supported: capability.id === 'audit',
    })),
    nextAction: 'Fix provider address/credential handle and rerun validation.',
    auditStatus: 'audit recorded',
    recovery: 'Keep local provider active until validation passes.',
  },
}

const baseMigrationItems: MigrationItem[] = [
  {
    ref: 'secret://local/default/@serviceadmin/SESSION_SIGNING_KEY',
    source: 'local',
    target: 'vault-prod',
    owner: '@serviceadmin',
    state: 'planned',
    policyResult: 'allowed',
    risk: 'low',
    expectedAction: 'copy inside broker with metadata-only result',
    auditRequirement: 'required',
    recovery: 'retry idempotent operation id if interrupted',
  },
  {
    ref: 'secret://local/default/@node/NODE_REGISTRY_AUTH',
    source: 'local',
    target: 'vault-prod',
    owner: '@node',
    state: 'denied',
    policyResult: 'denied',
    risk: 'medium',
    expectedAction: 'skipped until policy grants target namespace',
    auditRequirement: 'required',
    recovery: 'review policy and rerun dry-run for this ref',
  },
  {
    ref: 'secret://provider/payments/PAYMENTS_SIGNING_REF',
    source: 'provider',
    target: 'vault-prod',
    owner: 'payments-api',
    state: 'skipped',
    policyResult: 'review',
    risk: 'high',
    expectedAction: 'requires provider auth before migration',
    auditRequirement: 'required',
    recovery: 'reconnect source provider and retry',
  },
]

export const migrationPlans: Record<MigrationState, MigrationPlan> = {
  'dry-run-ready': {
    state: 'dry-run-ready',
    title: 'Migration dry-run ready',
    outcome: 'dry_run_ready',
    operationId: 'migration-preview-2026-05-08-a',
    sourceProvider: 'local',
    targetProvider: 'vault-prod',
    items: baseMigrationItems.slice(0, 1),
    nextAction:
      'Review metadata-only plan, enter audit reason, then enable confirmation.',
    rollback: 'No rollback required for dry-run; no values moved.',
    applyEnabled: false,
  },
  'dry-run-partial': {
    state: 'dry-run-partial',
    title: 'Migration dry-run partial denial',
    outcome: 'partial_failure',
    operationId: 'migration-preview-2026-05-08-b',
    sourceProvider: 'local',
    targetProvider: 'vault-prod',
    items: baseMigrationItems,
    nextAction:
      'Resolve denied/skipped refs or proceed only when acceptable policy allows partial migration.',
    rollback: 'No rollback required for dry-run; denied refs remain unchanged.',
    applyEnabled: false,
  },
  'apply-ready': {
    state: 'apply-ready',
    title: 'Migration apply ready after confirmation',
    outcome: 'ready_for_apply',
    operationId: 'migration-apply-2026-05-08-a',
    sourceProvider: 'local',
    targetProvider: 'vault-prod',
    items: baseMigrationItems.slice(0, 1),
    nextAction:
      'Apply remains gated by explicit confirmation and audit reason.',
    rollback: 'Encrypted backup restore available before apply.',
    applyEnabled: true,
  },
  'apply-success': {
    state: 'apply-success',
    title: 'Migration success',
    outcome: 'applied',
    operationId: 'migration-apply-2026-05-08-b',
    sourceProvider: 'local',
    targetProvider: 'vault-prod',
    items: baseMigrationItems.slice(0, 1).map((item) => ({
      ...item,
      state: 'migrated',
      expectedAction: 'completed inside broker',
    })),
    nextAction:
      'Verify provider status and keep recovery notes attached to audit record.',
    rollback:
      'Rerun using previous provider as source if rollback is supported.',
    applyEnabled: false,
  },
  'apply-partial': {
    state: 'apply-partial',
    title: 'Migration partial failure',
    outcome: 'partial_failure',
    operationId: 'migration-apply-2026-05-08-c',
    sourceProvider: 'local',
    targetProvider: 'vault-prod',
    items: baseMigrationItems.map((item, index) =>
      index === 0 ? { ...item, state: 'migrated' } : item
    ),
    nextAction:
      'Review denied/failed refs, fix provider or policy, and retry by operation id.',
    rollback:
      'Unmigrated refs remain on source; migrated refs can be retried idempotently.',
    applyEnabled: false,
  },
}

export const configurationSafetyBoundaries = [
  'Provider credentials are represented as safe refs/handles only; the UI never asks operators to paste credential values.',
  'Configuration status and validation results show provider metadata, capabilities, audit state, and next actions only.',
  'Migration dry-run is metadata-only: refs, source/target provider ids, policy result, risk, expected action, audit requirement, and recovery guidance.',
  'Migration apply requires explicit confirmation, operation id, and audit reason before apply becomes available.',
  'Denied, unsupported, auth-required, validation failed, and partial failure states fail closed without exposing raw values.',
]

export const configurationSafeSurfaces = {
  route: '/secrets-broker/configuration',
  pageTitle: 'Service Admin - Secrets Broker Configuration',
  breadcrumb: 'Secrets Broker / Configuration',
  diagnostics:
    'provider_config=handles_only; migration=dry_run_first; raw_values=hidden',
  supportBundle:
    'provider configuration and migration include provider ids, refs, status, and audit metadata only; credentials and raw values omitted',
  persistedStorage: 'none',
}

const forbiddenSecretPattern =
  /(secret-value|plaintext|correct-horse-battery-staple|portable-master-key|raw key|sk-[a-z0-9]|ghp_[a-z0-9]|AKIA[0-9A-Z]{16}|password\s*=|api[_-]?key\s*=|private key|cookie=|bearer\s+[a-z0-9]|fixture-provider-credential-value|credential-value)/i

export function configurationFixturesHaveSecretMaterial() {
  return forbiddenSecretPattern.test(
    JSON.stringify({
      providerConfigurations,
      migrationPlans,
      configurationSafeSurfaces,
    })
  )
}
