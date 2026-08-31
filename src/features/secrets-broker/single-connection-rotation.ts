import type { SecretsBrokerProviderConnectionDetail } from './provider-connections'

export type SingleConnectionWorkflowState =
  | 'dry-run-ready'
  | 'dry-run-denied'
  | 'auth-required'
  | 'backend-unavailable'
  | 'audit-unavailable'
  | 'cancelled'
  | 'apply-ready'
  | 'apply-success'
  | 'apply-failed'

export type SingleConnectionRotationPlan = {
  state: SingleConnectionWorkflowState
  title: string
  outcome: string
  operationId: string
  connectionId: string
  connectionRef: string
  action: 'edit' | 'rotate' | 'revoke'
  dryRunRequired: boolean
  applyEnabled: boolean
  confirmationRequired: boolean
  auditRequired: boolean
  status: string
  nextAction: string
  recovery: string
  changes: Array<{
    field: string
    current: string
    proposed: string
    policy: 'allowed' | 'denied' | 'review'
    risk: 'low' | 'medium' | 'high'
    status: 'planned' | 'blocked' | 'cancelled' | 'applied' | 'failed'
  }>
}

const baseChanges: SingleConnectionRotationPlan['changes'] = [
  {
    field: 'credential handle',
    current: 'ref:secret://local/provider/vault-ops/current-handle',
    proposed: 'ref:secret://local/provider/vault-ops/rotated-handle',
    policy: 'allowed',
    risk: 'medium',
    status: 'planned',
  },
  {
    field: 'rotation window',
    current: 'next maintenance window',
    proposed: 'approved immediate rotation window',
    policy: 'review',
    risk: 'medium',
    status: 'planned',
  },
]

export function buildSingleConnectionRotationPlan(
  connection: SecretsBrokerProviderConnectionDetail,
  state: SingleConnectionWorkflowState
): SingleConnectionRotationPlan {
  const base = {
    state,
    connectionId: connection.id,
    connectionRef: connection.connectionRef,
    action: 'rotate' as const,
    dryRunRequired: true,
    confirmationRequired: true,
    auditRequired: true,
  }

  if (state === 'dry-run-denied') {
    return {
      ...base,
      title: 'Dry-run denied by policy',
      outcome: 'denied',
      operationId: 'single-rotation-preview-2026-05-08-denied',
      applyEnabled: false,
      status: 'Policy denied the proposed credential handle rotation.',
      nextAction:
        'Review workspace policy and rerun dry-run; apply remains blocked.',
      recovery: 'No values changed; keep existing credential handle active.',
      changes: baseChanges.map((change, index) => ({
        ...change,
        policy: index === 0 ? 'denied' : change.policy,
        status: index === 0 ? 'blocked' : change.status,
      })),
    }
  }

  if (state === 'auth-required') {
    return {
      ...base,
      title: 'Provider auth required',
      outcome: 'auth_required',
      operationId: 'single-rotation-preview-2026-05-08-auth',
      applyEnabled: false,
      status:
        'Provider credential handle cannot be validated until reconnect completes.',
      nextAction:
        'Reconnect provider through a safe credential ref before dry-run/apply.',
      recovery: 'Existing connection metadata remains unchanged.',
      changes: baseChanges.map((change) => ({ ...change, status: 'blocked' })),
    }
  }

  if (state === 'backend-unavailable') {
    return {
      ...base,
      title: 'Backend unavailable or unsupported',
      outcome: 'backend_unavailable',
      operationId: 'single-rotation-preview-2026-05-08-backend',
      applyEnabled: false,
      status:
        'Broker reports this backend cannot apply single-connection mutation now.',
      nextAction:
        'Wait for backend capability/health to recover, then rerun dry-run.',
      recovery:
        'No changes applied; dependents continue using current metadata.',
      changes: baseChanges.map((change) => ({ ...change, status: 'blocked' })),
    }
  }

  if (state === 'audit-unavailable') {
    return {
      ...base,
      title: 'Audit unavailable / apply blocked',
      outcome: 'audit_unavailable',
      operationId: 'single-rotation-preview-2026-05-08-audit',
      applyEnabled: false,
      status: 'Audit recording is unavailable, so apply fails closed.',
      nextAction:
        'Restore audit writer before previewed edit or rotation can apply.',
      recovery:
        'No changes applied; operation must be repeated after audit repair.',
      changes: baseChanges,
    }
  }

  if (state === 'cancelled') {
    return {
      ...base,
      title: 'Operation cancelled',
      outcome: 'cancelled',
      operationId: 'single-rotation-cancelled-2026-05-08',
      applyEnabled: false,
      status: 'Operator cancelled before apply; no provider metadata changed.',
      nextAction: 'Rerun dry-run if rotation is still required.',
      recovery: 'No rollback required because apply did not start.',
      changes: baseChanges.map((change) => ({
        ...change,
        status: 'cancelled',
      })),
    }
  }

  if (state === 'apply-ready') {
    return {
      ...base,
      title: 'Apply ready after explicit confirmation',
      outcome: 'ready_for_apply',
      operationId: 'single-rotation-apply-2026-05-08-ready',
      applyEnabled: true,
      status:
        'Dry-run is clean; apply remains gated by confirmation and audit reason.',
      nextAction:
        'Record audit reason, confirm exact connection id, then apply once.',
      recovery:
        'Use previous credential handle metadata if dependent service checks fail.',
      changes: baseChanges,
    }
  }

  if (state === 'apply-success') {
    return {
      ...base,
      title: 'Apply success',
      outcome: 'applied',
      operationId: 'single-rotation-apply-2026-05-08-success',
      applyEnabled: false,
      status:
        'Rotation metadata applied; dependent services should refresh/test next.',
      nextAction:
        'Run refresh/test and monitor audit events for dependent failures.',
      recovery:
        'Previous handle remains available to broker rollback tooling by ref only.',
      changes: baseChanges.map((change) => ({ ...change, status: 'applied' })),
    }
  }

  if (state === 'apply-failed') {
    return {
      ...base,
      title: 'Apply failure status feedback',
      outcome: 'apply_failed',
      operationId: 'single-rotation-apply-2026-05-08-failed',
      applyEnabled: false,
      status:
        'Apply failed after audit start; current metadata remains authoritative.',
      nextAction:
        'Use recovery guidance, inspect safe diagnostics, then rerun dry-run.',
      recovery:
        'Partial work is recoverable by operation id; raw values are never exported.',
      changes: baseChanges.map((change, index) => ({
        ...change,
        status: index === 0 ? 'failed' : 'blocked',
      })),
    }
  }

  return {
    ...base,
    title: 'Dry-run preview ready',
    outcome: 'dry_run_ready',
    operationId: 'single-rotation-preview-2026-05-08-ready',
    applyEnabled: false,
    status:
      'Preview generated with refs and metadata only; raw values were not loaded.',
    nextAction:
      'Review plan, record audit reason, and confirm before enabling apply.',
    recovery: 'No rollback required for dry-run; no provider state changed.',
    changes: baseChanges,
  }
}

export const singleConnectionWorkflowStates: Array<{
  value: SingleConnectionWorkflowState
  label: string
}> = [
  { value: 'dry-run-ready', label: 'Dry-run preview ready' },
  { value: 'dry-run-denied', label: 'Denied by policy' },
  { value: 'auth-required', label: 'Auth required' },
  { value: 'backend-unavailable', label: 'Backend unavailable / unsupported' },
  { value: 'audit-unavailable', label: 'Audit unavailable / apply blocked' },
  { value: 'cancelled', label: 'Cancelled operation' },
  { value: 'apply-ready', label: 'Apply ready after confirmation' },
  { value: 'apply-success', label: 'Apply success' },
  { value: 'apply-failed', label: 'Apply failure feedback' },
]

export function singleConnectionRotationPlanHasSecretValue(
  plan: SingleConnectionRotationPlan
) {
  return /hunter2|correct-horse|plain\s*text\s*secret|supersecret|sk-[a-z0-9_-]{12,}|ghp_[a-z0-9_]{12,}|AKIA[0-9A-Z]{16}|password\s*=|token\s*=|DETERMINISTIC_FAKE_ROTATION_VALUE_81/i.test(
    JSON.stringify(plan)
  )
}
