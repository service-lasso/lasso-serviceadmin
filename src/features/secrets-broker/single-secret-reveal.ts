export type SingleSecretRevealState =
  | 'hidden'
  | 'auth-required'
  | 'policy-denied'
  | 'broker-offline'
  | 'unconfigured'
  | 'audit-unavailable'
  | 'allowed'
  | 'cancelled'
  | 'expired'

export type SingleSecretRevealReference = {
  id: string
  ref: string
  name: string
  owningService: string
  provider: string
  source: string
  lastUpdatedAt: string
  policy: string
  auditEventId: string
  fakeRawValue: string
}

export type SingleSecretRevealScenario = {
  id: SingleSecretRevealState
  label: string
  badge: string
  canReveal: boolean
  status: string
  reason: string
  auditStatus: string
  nextAction: string
}

export const singleSecretRevealReference: SingleSecretRevealReference = {
  id: 'serviceadmin-session-signing',
  ref: 'secret://local/default/@serviceadmin/SESSION_SIGNING_KEY',
  name: 'SESSION_SIGNING_KEY',
  owningService: '@serviceadmin',
  provider: 'local encrypted store',
  source: 'local-default',
  lastUpdatedAt: '2026-05-08T10:44:00Z',
  policy: 'policy/openclaw/service-lasso/read-single-secret',
  auditEventId: 'audit-reveal-001',
  fakeRawValue: 'DEMO_REVEAL_VALUE_42',
}

export const singleSecretRevealScenarios: SingleSecretRevealScenario[] = [
  {
    id: 'hidden',
    label: 'Hidden / default',
    badge: 'Hidden',
    canReveal: false,
    status: 'Value hidden by default',
    reason:
      'Select a safe metadata ref, review the owner/provider/policy context, then request a privileged reveal.',
    auditStatus: 'No reveal requested',
    nextAction: 'Review metadata before requesting reveal authorization.',
  },
  {
    id: 'auth-required',
    label: 'Authorization required',
    badge: 'Auth required',
    canReveal: false,
    status: 'Reveal blocked until operator authorization completes',
    reason:
      'The broker requires a fresh privileged operator authorization before resolving this ref.',
    auditStatus: 'Authorization challenge pending',
    nextAction:
      'Complete privileged authorization and retry the reveal request.',
  },
  {
    id: 'policy-denied',
    label: 'Policy denied',
    badge: 'Policy denied',
    canReveal: false,
    status: 'Reveal denied by policy',
    reason:
      'The active Service Admin identity is not allowed to reveal this ref under the current policy decision.',
    auditStatus: 'Denied event recorded without value material',
    nextAction:
      'Escalate policy ownership; do not bypass through diagnostics or exports.',
  },
  {
    id: 'broker-offline',
    label: 'Broker offline',
    badge: 'Broker offline',
    canReveal: false,
    status: 'Reveal unavailable because @secretsbroker is offline',
    reason:
      'Service Admin cannot reach the broker API, so it must fail closed and keep the value hidden.',
    auditStatus: 'No reveal event emitted while broker is unreachable',
    nextAction: 'Restore broker health before attempting a reveal.',
  },
  {
    id: 'unconfigured',
    label: 'Broker unconfigured',
    badge: 'Setup needed',
    canReveal: false,
    status: 'Reveal unavailable until a source/backend is configured',
    reason:
      'The selected ref has metadata, but no configured source can resolve it safely.',
    auditStatus: 'Setup-required status only',
    nextAction:
      'Configure a source/backend; raw values stay hidden during setup.',
  },
  {
    id: 'audit-unavailable',
    label: 'Audit unavailable / blocked',
    badge: 'Audit blocked',
    canReveal: false,
    status: 'Reveal blocked because audit recording is unavailable',
    reason:
      'Privileged reveal requires a durable audit event before any value can be displayed.',
    auditStatus: 'Audit sink unavailable; reveal refused',
    nextAction: 'Restore audit recording before retrying.',
  },
  {
    id: 'allowed',
    label: 'Reveal allowed',
    badge: 'Allowed',
    canReveal: true,
    status: 'Ready for explicit, time-limited reveal',
    reason:
      'Policy allowed the selected single ref, broker health is good, and audit recording is available.',
    auditStatus: 'Reveal audit will be recorded before display',
    nextAction: 'Click reveal only when the operator needs the value now.',
  },
  {
    id: 'cancelled',
    label: 'Cancelled reveal',
    badge: 'Cancelled',
    canReveal: false,
    status: 'Reveal cancelled; value remains hidden',
    reason:
      'The operator cancelled before display. No raw material was fetched or rendered.',
    auditStatus: 'Cancellation status recorded without value material',
    nextAction: 'Start a new explicit reveal request if still required.',
  },
  {
    id: 'expired',
    label: 'Reveal expired / re-hidden',
    badge: 'Expired',
    canReveal: false,
    status: 'Reveal window expired; value re-hidden',
    reason:
      'The short-lived display window has ended. Service Admin discards visible raw material.',
    auditStatus: 'Expiry recorded; value no longer visible',
    nextAction: 'Request a new reveal if the operator still has a valid need.',
  },
]

export const singleSecretRevealSafeSurfaces = {
  route: '/secrets-broker#privileged-secret-reveal',
  pageTitle: 'Secrets Broker setup',
  breadcrumb: 'Secrets Broker / privileged single-secret reveal',
  diagnostics:
    'reveal_status=redacted; selected_ref=metadata_only; raw_value=hidden',
  supportBundle:
    'single_secret_reveal: ref metadata, policy outcome, and audit status only; raw value omitted',
  consoleEvents: [
    'single-secret-reveal:selected-ref-metadata',
    'single-secret-reveal:audit-status-updated',
  ],
  persistedStorage: 'none',
}

const providerCredentialPattern =
  /(sk-[a-z0-9]|ghp_[a-z0-9]|AKIA[0-9A-Z]{16}|password\s*=|api[_-]?key\s*=|private key|cookie=|bearer\s+[a-z0-9])/i

export function revealSafeSurfacesIncludeRawValue(): boolean {
  const surfaceText = JSON.stringify(singleSecretRevealSafeSurfaces)
  return surfaceText.includes(singleSecretRevealReference.fakeRawValue)
}

export function revealFixtureLooksLikeProviderCredential(): boolean {
  return providerCredentialPattern.test(
    singleSecretRevealReference.fakeRawValue
  )
}
