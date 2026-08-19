import { expectActivePageIdentity } from '@/test/page-identity'
import { renderRoute } from '@/test/render-route'
import { canonicalBrokerOverviewResponse } from '@/test/secrets-broker-contract'
import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildBulkSecretCampaignPlan,
  buildBulkSecretCampaignApplyGate,
  buildBulkSecretCampaignApplyResult,
  buildBulkSecretCampaignClosureReview,
  buildBulkSecretCampaignOperatorHandoff,
  buildBulkSecretCampaignOwnerActionTicket,
  buildManagedSecretActionReadiness,
  buildSingleSecretDecommissionPreview,
  buildSingleSecretEditPreview,
  buildSingleSecretEvidenceBundle,
  buildSingleSecretExportGuardrail,
  buildSingleSecretConfirmationReceipt,
  buildSingleSecretClosureReview,
  buildSingleSecretLeakEvidence,
  buildSingleSecretOperationHistoryReview,
  buildSingleSecretOperationAuditTrail,
  buildSingleSecretAuditReceipt,
  buildSingleSecretOperationHistoryEntry,
  buildSingleSecretOperatorHandoff,
  buildSingleSecretOwnerActionTicket,
  buildSingleSecretPolicyPreview,
  buildSingleSecretRecoveryDecision,
  buildSingleSecretRevealLifecycle,
  buildSingleSecretRevealPreview,
  buildSingleSecretRotationPreview,
  buildSingleSecretOperationResult,
  buildSingleSecretOperationPlan,
  buildSingleSecretReplayGuard,
  buildSingleSecretStatusMonitor,
  buildSingleSecretSubmitEnvelope,
  buildStubSecretMutationPreview,
  filterManagedSecrets,
  managedSecretBulkApplyResultHasSecretMaterial,
  managedSecretBulkClosureReviewHasSecretMaterial,
  managedSecretBulkOperatorHandoffHasSecretMaterial,
  managedSecretBulkOwnerActionTicketHasSecretMaterial,
  managedSecretBulkPlanHasSecretMaterial,
  managedSecretActionReadinessHasSecretMaterial,
  managedSecretAuditReasonHasSecretMaterial,
  managedSecretClosureReviewHasSecretMaterial,
  managedSecretConfirmationReceiptHasSecretMaterial,
  managedSecretDecommissionPreviewHasSecretMaterial,
  managedSecretEditPreviewHasSecretMaterial,
  managedSecretEvidenceBundleHasSecretMaterial,
  managedSecretExportGuardrailHasSecretMaterial,
  managedSecretHistoryReviewHasSecretMaterial,
  managedSecretLeakEvidenceHasSecretMaterial,
  managedSecretOperatorHandoffHasSecretMaterial,
  managedSecretOwnerActionTicketHasSecretMaterial,
  managedSecretPolicyPreviewHasSecretMaterial,
  managedSecretRecoveryDecisionHasSecretMaterial,
  managedSecretRevealLifecycleHasSecretMaterial,
  managedSecretRevealPreviewHasSecretMaterial,
  managedSecretReplayGuardHasSecretMaterial,
  managedSecretRotationPreviewHasSecretMaterial,
  managedSecretSingleAuditTrailHasSecretMaterial,
  managedSecretAuditReceiptHasSecretMaterial,
  managedSecretStatusMonitorHasSecretMaterial,
  managedSecretSubmitEnvelopeHasSecretMaterial,
  managedSecretRows,
  managedSecretSafeSurfacesIncludeSecretMaterial,
  managedSecretSingleHistoryHasSecretMaterial,
  managedSecretsHaveSecretMaterial,
  valueSearchManagedSecrets,
} from './secrets-management'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Windows Release CI ran this suite at ~16s–30s per long interaction test. */
describe('Secrets Broker secrets management page', { timeout: 60_000 }, () => {
  it('renders the KV editor only when stub mode is disabled', async () => {
    await renderRoute('/secrets-broker/secrets', { stubData: false })

    await expectActivePageIdentity('Secrets')
    expect(await screen.findByText('KV store')).toBeVisible()
    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('data-layout', 'fixed')
    expect(main).toHaveClass('min-h-0')
    expect(screen.getByTestId('kv-store-card')).toHaveClass('flex-1')
    expect(
      screen.queryByText(/Secrets Broker API unavailable/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Live managed secret rows/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Live secret metadata status/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/No fixture rows/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Secrets management unavailable/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Single-secret preview gate/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/SESSION_SIGNING_KEY/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Simulate stub apply/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Request live controlled reveal/i })
    ).not.toBeInTheDocument()
  })

  it('lists live KV keys without values on the Secrets page', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/dashboard/services/%40secretsbroker') {
        return new Response(
          JSON.stringify({ service: { status: 'running' } }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }

      const contractResponse = canonicalBrokerOverviewResponse(url)
      if (contractResponse) return contractResponse

      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return new Response(
          JSON.stringify({ data: { keys: ['demo/', 'kv-sentinel-alpha'] } }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    await renderRoute('/secrets-broker/secrets', { stubData: false })

    expect(await screen.findByText('KV store')).toBeVisible()
    expect(
      await screen.findByRole('button', { name: 'kv-sentinel-alpha' })
    ).toBeVisible()
    expect(
      screen.queryByText('No values in the key list')
    ).not.toBeInTheDocument()
    expect(screen.getByText('KV Path')).toBeVisible()
    expect(screen.getByText('KV Value')).toBeVisible()
    expect(
      screen.queryByText(/Live managed secret rows/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Preview reset dry-run/i })
    ).not.toBeInTheDocument()
  })

  it('renders the KV editor only in stub mode as well', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return new Response(
          JSON.stringify({ data: { keys: ['apps/', 'db'] } }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response(JSON.stringify({}), {
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await renderRoute('/secrets-broker/secrets')

    await expectActivePageIdentity('Secrets')
    expect(await screen.findByText('KV store')).toBeVisible()
    expect(await screen.findByRole('button', { name: 'db' })).toBeVisible()
    expect(
      screen.queryByDisplayValue('kv-sentinel-alpha')
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Operator queue/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Live secret metadata status/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Secrets management table/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Simulate stub apply/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/SESSION_SIGNING_KEY/i)).not.toBeInTheDocument()
  })

  it('reads the secret search param into the KV path filter', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/kv/metadata/') && url.includes('list=true')) {
        return new Response(
          JSON.stringify({
            data: {
              keys: ['apps/', 'db', 'services/@serviceadmin/'],
            },
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response(JSON.stringify({}), {
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await renderRoute('/secrets-broker/secrets?secret=%40serviceadmin')

    await expectActivePageIdentity('Secrets')
    expect(screen.getByLabelText('Filter paths')).toHaveValue('@serviceadmin')
    expect(
      await screen.findByRole('button', { name: 'services/@serviceadmin/' })
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'db' })).not.toBeInTheDocument()
  })

  it('keeps fixtures and modeled safe surfaces free of secret material', () => {
    expect(managedSecretsHaveSecretMaterial()).toBe(false)
    expect(managedSecretSafeSurfacesIncludeSecretMaterial()).toBe(false)
    expect(
      filterManagedSecrets(managedSecretRows, 'session', 'all')
    ).toHaveLength(1)
    expect(
      valueSearchManagedSecrets(managedSecretRows, 'session', false)
    ).toEqual([])
    expect(
      valueSearchManagedSecrets(managedSecretRows, 'session', true)
    ).toHaveLength(1)
    expect(
      buildStubSecretMutationPreview(
        managedSecretRows[0],
        'delete',
        'ready',
        'operator requested safe preview',
        true
      ).canApply
    ).toBe(true)
    expect(
      buildStubSecretMutationPreview(
        managedSecretRows[0],
        'edit',
        'denied',
        'operator requested safe preview',
        true
      ).canApply
    ).toBe(false)
    expect(
      managedSecretAuditReasonHasSecretMaterial('password=SuperSecret1234')
    ).toBe(true)
    expect(
      buildStubSecretMutationPreview(
        managedSecretRows[0],
        'delete',
        'ready',
        'password=SuperSecret1234',
        true
      )
    ).toMatchObject({
      dryRunStatus: 'audit reason rejected',
      auditRequirement:
        'remove secret-like material from the audit reason before preview',
      canApply: false,
    })

    const rotatePlan = buildSingleSecretOperationPlan(
      managedSecretRows[0],
      'reset',
      'operator requested rotation preview',
      true,
      'ready'
    )
    expect(rotatePlan).toMatchObject({
      endpoint: 'POST /v1/management/secrets/{ref}/rotate:dry-run',
      capabilityDecision: 'supported: reset dry-run',
      applyGate: 'operation submit ready after dry-run revalidation',
      canSubmit: true,
    })
    const rejectedReasonPlan = buildSingleSecretOperationPlan(
      managedSecretRows[0],
      'reset',
      'bearer abcdefghijklmnop',
      true,
      'ready'
    )
    expect(rejectedReasonPlan).toMatchObject({
      auditRequirement:
        'audit reason rejected because it contains secret-like material',
      applyGate: 'audit reason contains secret-like material',
      canSubmit: false,
    })
    expect(rejectedReasonPlan.blockers).toContain(
      'audit reason contains secret-like material'
    )
    expect(rotatePlan.safePayloadFields).toEqual(
      expect.arrayContaining([
        'ref',
        'operationId',
        'auditReasonMetadata',
        'rotationPlanRef',
        'dependentServiceRefs',
        'restartPlanRefs',
        'idempotencyRef',
      ])
    )
    expect(rotatePlan.revalidationChecks).toEqual(
      expect.arrayContaining([
        'rotation can submit without controlled reveal',
        'dependent service restart and reload plan checked',
      ])
    )
    const rotationPreview = buildSingleSecretRotationPreview(
      managedSecretRows[0],
      rotatePlan
    )
    expect(rotationPreview).toMatchObject({
      eligible: true,
      badge: 'rotation preview ready',
      rotationPlanRef:
        'rotation-plan-reset-serviceadmin-session-signing-metadata',
      idempotencyRef: 'idem-reset-serviceadmin-session-signing-metadata-submit',
      retryWindowRef:
        'retry-window-reset-serviceadmin-session-signing-operation-id-only',
      applyGate:
        'ready for broker-owned rotate/reset submit after final service impact revalidation',
      auditEventId: 'audit-reset-serviceadmin-session-signing-preview',
    })
    expect(rotationPreview.dependentServiceRefs).toEqual(
      expect.arrayContaining([
        '@serviceadmin runtime session loader',
        '@serviceadmin operator API',
      ])
    )
    expect(rotationPreview.restartPlanRefs).toEqual(
      expect.arrayContaining([
        'restart-serviceadmin-runtime-session-loader-after-rotation-metadata',
      ])
    )
    expect(rotationPreview.omittedUnsafeFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'generatedValue',
        'replacementValue',
        'requestBody',
        'responseBody',
        'providerCredentials',
        'providerTokens',
        'cookies',
        'privateKeys',
        'recoveryMaterial',
        'environmentValues',
      ])
    )
    expect(rotationPreview.safeMetadataRows).toEqual(
      expect.arrayContaining([
        'rotation preview never reveals the current value or generated replacement value',
        'operator can rotate without opening a controlled reveal session',
      ])
    )
    expect(managedSecretRotationPreviewHasSecretMaterial(rotationPreview)).toBe(
      false
    )
    const blockedRotationPreview = buildSingleSecretRotationPreview(
      managedSecretRows[3],
      buildSingleSecretOperationPlan(
        managedSecretRows[3],
        'reset',
        'operator requested rotation preview',
        true,
        'ready'
      )
    )
    expect(blockedRotationPreview).toMatchObject({
      eligible: false,
      badge: 'rotation preview blocked',
      applyGate: 'ref unavailable',
    })
    expect(blockedRotationPreview.blockers).toEqual(
      expect.arrayContaining(['ref unavailable', 'reset dry-run unsupported'])
    )
    expect(
      managedSecretRotationPreviewHasSecretMaterial(blockedRotationPreview)
    ).toBe(false)
    expect(rotatePlan.safePayloadFields).toEqual(
      expect.arrayContaining([
        'rotationReason',
        'rotationPlanRef',
        'dependentServiceRefs',
        'restartPlanRefs',
      ])
    )
    const rotateResult = buildSingleSecretOperationResult(
      managedSecretRows[0],
      rotatePlan
    )
    expect(rotateResult).toMatchObject({
      operationId: rotatePlan.operationId,
      ref: managedSecretRows[0].ref,
      action: 'reset',
      outcome: 'submitted',
      applied: false,
      resultBadge: 'submitted to broker',
      auditStatus: 'stub audit event recorded with metadata only',
      nextAction:
        'monitor broker rotation outcome and dependent service restart notes',
      recoveryStatus:
        'rotation retry is operation-id scoped and provider-owned',
      retryPolicy:
        'retry only by operation id when broker marks the attempt retry-safe',
    })
    expect(rotateResult.recoverySteps).toEqual(
      expect.arrayContaining([
        'track rotation operation id until provider status settles',
        'retry by operation id when the provider marks the retry safe',
      ])
    )
    expect(rotateResult.safetyRows).toEqual(
      expect.arrayContaining([
        'raw value was not revealed',
        'rotation can be requested without controlled reveal',
      ])
    )
    const rotateSubmitEnvelope = buildSingleSecretSubmitEnvelope(
      managedSecretRows[0],
      rotatePlan
    )
    expect(rotateSubmitEnvelope).toMatchObject({
      operationId: rotatePlan.operationId,
      endpoint: 'POST /v1/management/secrets/{ref}/rotate:dry-run',
      idempotencyKey: 'idem-reset-serviceadmin-session-signing-metadata-submit',
      correlationId: 'corr-reset-serviceadmin-session-signing-metadata-submit',
      readyForSubmit: true,
      blockedReason: 'ready after final broker revalidation',
    })
    expect(rotateSubmitEnvelope.payloadFields).toEqual(
      expect.arrayContaining([
        'ref',
        'operationId',
        'auditReasonMetadata',
        'rotationReason',
      ])
    )
    expect(rotateSubmitEnvelope.omittedFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'providerCredentials',
        'providerTokens',
        'environmentValues',
        'requestBodyEcho',
      ])
    )
    expect(rotateSubmitEnvelope.transportGuardrails).toEqual(
      expect.arrayContaining([
        'ref stays in the broker route template and is not copied into query strings',
      ])
    )
    expect(rotateSubmitEnvelope.storageGuardrails).toEqual(
      expect.arrayContaining([
        'no local storage or session storage writes are required for submit',
      ])
    )
    expect(rotateSubmitEnvelope.diagnosticsGuardrails).toEqual(
      expect.arrayContaining([
        'failure evidence records typed status and correlation id only',
      ])
    )
    expect(
      managedSecretSubmitEnvelopeHasSecretMaterial(rotateSubmitEnvelope)
    ).toBe(false)
    const rotateReceipt = buildSingleSecretConfirmationReceipt(
      managedSecretRows[0],
      rotatePlan,
      rotateSubmitEnvelope,
      'operator requested rotation preview',
      true
    )
    expect(rotateReceipt).toMatchObject({
      receiptId: 'receipt-reset-serviceadmin-session-signing-accepted',
      operationId: rotatePlan.operationId,
      accepted: true,
      auditReasonStatus: 'accepted as broker audit metadata',
      confirmationStatus: 'explicit stub preview confirmation accepted',
      blockedReason: 'none',
    })
    expect(rotateReceipt.allowedReceiptFields).toEqual(
      expect.arrayContaining([
        'receiptId',
        'operationId',
        'auditReasonStatus',
        'confirmationStatus',
        'idempotencyKey',
        'correlationId',
      ])
    )
    expect(rotateReceipt.omittedReceiptFields).toEqual(
      expect.arrayContaining([
        'auditReasonText',
        'rawValue',
        'requestBody',
        'responseBody',
        'providerCredentials',
      ])
    )
    expect(rotateReceipt.safeReceiptRows).toEqual(
      expect.arrayContaining([
        'confirmation receipt accepted; submit remains operation-id scoped',
        'audit reason text is represented only by broker audit metadata status',
      ])
    )
    expect(
      managedSecretConfirmationReceiptHasSecretMaterial(rotateReceipt)
    ).toBe(false)
    const rotateReplayGuard = buildSingleSecretReplayGuard(
      managedSecretRows[0],
      rotatePlan,
      rotateSubmitEnvelope
    )
    expect(rotateReplayGuard).toMatchObject({
      operationId: rotatePlan.operationId,
      planFingerprint:
        'plan-fp-reset-serviceadmin-session-signing-metadata-only',
      idempotencyKey: 'idem-reset-serviceadmin-session-signing-metadata-submit',
      correlationId: 'corr-reset-serviceadmin-session-signing-metadata-submit',
      readyForReplaySafeSubmit: true,
      replayDecision:
        'first submit and retry are allowed only with the same operation id and idempotency key',
    })
    expect(rotateReplayGuard.refBindingRows).toEqual(
      expect.arrayContaining([
        'cross-ref replay rejected before broker mutation',
        'cross-action replay rejected before broker mutation',
        'stale dry-run fingerprint requires a fresh preview',
      ])
    )
    expect(rotateReplayGuard.omittedReplayFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBody',
        'responseBody',
        'auditReasonText',
      ])
    )
    expect(rotateReplayGuard.safeReplayRows).toEqual(
      expect.arrayContaining([
        'idempotency evidence uses operation id, correlation id, ref metadata, and action metadata only',
        'retry status is operation-id scoped and never includes request or response bodies',
      ])
    )
    expect(managedSecretReplayGuardHasSecretMaterial(rotateReplayGuard)).toBe(
      false
    )

    const missingPlan = buildSingleSecretOperationPlan(
      managedSecretRows[3],
      'reset',
      'operator requested rotation preview',
      true,
      'ready'
    )
    const blockedSubmitEnvelope = buildSingleSecretSubmitEnvelope(
      managedSecretRows[3],
      missingPlan
    )
    const blockedReceipt = buildSingleSecretConfirmationReceipt(
      managedSecretRows[3],
      missingPlan,
      blockedSubmitEnvelope,
      'operator requested rotation preview',
      true
    )
    expect(blockedReceipt).toMatchObject({
      receiptId: 'receipt-reset-payments-signing-ref-blocked',
      accepted: false,
      auditReasonStatus: 'accepted as broker audit metadata',
      confirmationStatus: 'explicit stub preview confirmation accepted',
      blockedReason: 'ref unavailable',
    })
    expect(blockedReceipt.safeReceiptRows).toEqual(
      expect.arrayContaining([
        'confirmation receipt blocked before broker mutation',
        'submit envelope blocked: ref unavailable',
      ])
    )
    expect(
      managedSecretConfirmationReceiptHasSecretMaterial(blockedReceipt)
    ).toBe(false)
    const blockedReplayGuard = buildSingleSecretReplayGuard(
      managedSecretRows[3],
      missingPlan,
      blockedSubmitEnvelope
    )
    expect(blockedReplayGuard).toMatchObject({
      readyForReplaySafeSubmit: false,
      replayDecision: 'replay blocked: ref unavailable',
    })
    expect(blockedReplayGuard.stalePlanGuard).toMatch(
      /reject submit if ref, action, policy/i
    )
    expect(managedSecretReplayGuardHasSecretMaterial(blockedReplayGuard)).toBe(
      false
    )

    const rotateLeakEvidence = buildSingleSecretLeakEvidence(
      managedSecretRows[0],
      rotatePlan,
      rotateSubmitEnvelope
    )
    expect(rotateLeakEvidence).toMatchObject({
      route: '/secrets-broker/secrets',
      selectedRef: 'secret://local/default/@serviceadmin/SESSION_SIGNING_KEY',
      action: 'reset',
      browserStorageWrites:
        'localStorage writes: none; sessionStorage writes: none',
      diagnosticsRef:
        'diagnostics-reset-serviceadmin-session-signing-metadata-only',
      supportBundleRef:
        'support-reset-serviceadmin-session-signing-metadata-only',
      safeForScreenshots: true,
    })
    expect(rotateLeakEvidence.allowedRouteParams).toEqual(
      expect.arrayContaining([
        'ref=<managed secret ref>',
        'action=reset',
        'secret=<metadata table search>',
        'page/pageSize=<table pagination>',
      ])
    )
    expect(rotateLeakEvidence.omittedFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBody',
        'responseBody',
        'providerAuthMaterial',
        'supportBundlePayloadBodies',
      ])
    )
    expect(rotateLeakEvidence.safeEvidenceRows).toEqual(
      expect.arrayContaining([
        'route state uses only ref/action metadata and table filters',
        'browser storage remains unused for selected action state and submit envelopes',
      ])
    )
    expect(managedSecretLeakEvidenceHasSecretMaterial(rotateLeakEvidence)).toBe(
      false
    )

    const rotateExportGuard = buildSingleSecretExportGuardrail(
      managedSecretRows[0],
      rotatePlan,
      rotateSubmitEnvelope
    )
    expect(rotateExportGuard).toMatchObject({
      exportGuardId: 'export-guard-reset-serviceadmin-session-signing-metadata',
      operationId: rotatePlan.operationId,
      ref: 'secret://local/default/@serviceadmin/SESSION_SIGNING_KEY',
      action: 'reset',
      metadataExportStatus:
        'metadata report available for operation ids, refs, audit refs, typed outcomes, and next actions only',
      rawExportStatus:
        'raw value copy, raw export, and spreadsheet-style payload export are unavailable',
    })
    expect(rotateExportGuard.allowedExportFields).toEqual(
      expect.arrayContaining([
        'operationId',
        'ref',
        'action',
        'auditEventId',
        'correlationId',
        'nextAction',
      ])
    )
    expect(rotateExportGuard.blockedExportFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBody',
        'responseBody',
        'providerCredentials',
        'providerTokens',
        'recoveryMaterial',
        'environmentValues',
      ])
    )
    expect(rotateExportGuard.safeExportRows).toEqual(
      expect.arrayContaining([
        'metadata export is scoped to the selected ref and operation id',
        'raw value export and bulk raw reveal are out of scope',
        'spreadsheet-style secret editing remains unavailable',
      ])
    )
    expect(
      managedSecretExportGuardrailHasSecretMaterial(rotateExportGuard)
    ).toBe(false)

    const appliedResult = buildSingleSecretOperationResult(
      managedSecretRows[0],
      rotatePlan,
      'applied'
    )
    expect(appliedResult).toMatchObject({
      outcome: 'applied',
      applied: true,
      resultBadge: 'broker applied',
      auditStatus: 'stub audit event and broker success metadata recorded',
      recoveryStatus: 'operation settled with broker success metadata',
      retryPolicy: 'no retry needed after broker success',
      nextAction:
        'monitor dependent service restart notes and rotation freshness',
    })
    expect(appliedResult.auditFeedback).toMatchObject({
      auditEventId: 'audit-reset-serviceadmin-session-signing-preview',
      correlationId: 'corr-reset-serviceadmin-session-signing-applied',
      eventState: 'settled with broker success metadata',
      dependentServiceStatus:
        'dependent service restart metadata ready for operator review',
      sinkStatus: 'audit sink available in stub metadata model',
    })
    expect(appliedResult.auditFeedback.evidenceRows).toEqual(
      expect.arrayContaining([
        'audit payload excludes raw values and credential material',
        'route, query string, local storage, and diagnostics receive no secret material',
      ])
    )

    const deniedResult = buildSingleSecretOperationResult(
      managedSecretRows[0],
      rotatePlan,
      'policy-denied'
    )
    expect(deniedResult).toMatchObject({
      outcome: 'policy-denied',
      applied: false,
      resultBadge: 'policy denied',
      recoveryStatus:
        'policy denial is fail-closed and requires a new authorized plan',
      retryPolicy: 'fresh plan required before any retry',
      nextAction:
        'update policy assignment or request least-privilege approval',
    })
    expect(deniedResult.recoverySteps).toEqual(
      expect.arrayContaining([
        'preserve the denied operation id for audit review only',
        'request least-privilege policy approval before any new submit',
        'create a fresh audited preview after policy assignment changes',
      ])
    )

    const authRequiredResult = buildSingleSecretOperationResult(
      managedSecretRows[0],
      rotatePlan,
      'auth-required'
    )
    expect(authRequiredResult).toMatchObject({
      outcome: 'auth-required',
      applied: false,
      resultBadge: 'auth required',
      recoveryStatus:
        'provider reauthentication must complete in the broker-owned auth flow',
      retryPolicy: 'fresh plan required before any retry',
      providerAuthChallengeRef:
        'auth-challenge-reset-serviceadmin-session-signing-metadata',
      nextAction:
        'complete broker provider reauthentication and create a fresh preview',
    })
    expect(authRequiredResult.resultStatus).toMatch(
      /requires fresh operator authentication before source access/i
    )
    expect(authRequiredResult.recoverySteps).toEqual(
      expect.arrayContaining([
        'complete provider reauthentication in the broker-owned auth flow',
        'discard this dry-run token after auth challenge starts',
        'create a fresh audited preview after provider session is refreshed',
      ])
    )
    expect(authRequiredResult.safetyRows).toEqual(
      expect.arrayContaining([
        'provider reauthentication uses broker-owned challenge refs; credentials are never entered in the Service Admin table',
      ])
    )
    expect(authRequiredResult.auditFeedback).toMatchObject({
      eventState: 'recorded as auth challenge with no source access',
    })
    expect(authRequiredResult.auditFeedback.evidenceRows).toEqual(
      expect.arrayContaining([
        'provider auth challenge refs contain status metadata only and never provider credentials',
      ])
    )
    expect(
      managedSecretSingleHistoryHasSecretMaterial([
        buildSingleSecretOperationHistoryEntry(
          managedSecretRows[0],
          rotatePlan,
          2,
          'auth-required'
        ),
      ])
    ).toBe(false)
    expect(authRequiredResult.providerAuthChallengeRef).not.toMatch(
      /credential|token|cookie|private key|DEMO_REVEAL_VALUE_42/i
    )

    const auditUnavailableResult = buildSingleSecretOperationResult(
      managedSecretRows[0],
      rotatePlan,
      'audit-unavailable'
    )
    expect(auditUnavailableResult).toMatchObject({
      outcome: 'audit-unavailable',
      applied: false,
      resultBadge: 'audit unavailable',
      auditStatus:
        'stub audit outage metadata recorded; mutation failed closed',
      recoveryStatus:
        'audit outage is fail-closed and requires a fresh audited preview',
      retryPolicy: 'fresh plan required before any retry',
      nextAction: 'restore audit sink availability and create a fresh preview',
    })
    expect(auditUnavailableResult.resultStatus).toMatch(
      /blocked because audit persistence is unavailable/i
    )
    expect(auditUnavailableResult.auditFeedback).toMatchObject({
      eventState: 'recorded as audit unavailable with no source access',
      sinkStatus:
        'audit sink unavailable; mutation is blocked until broker confirms retention',
    })
    expect(
      managedSecretSingleHistoryHasSecretMaterial([
        buildSingleSecretOperationHistoryEntry(
          managedSecretRows[0],
          rotatePlan,
          2,
          'audit-unavailable'
        ),
      ])
    ).toBe(false)

    const providerUnavailableResult = buildSingleSecretOperationResult(
      managedSecretRows[0],
      rotatePlan,
      'provider-unavailable'
    )
    expect(providerUnavailableResult).toMatchObject({
      outcome: 'provider-unavailable',
      applied: false,
      resultBadge: 'provider unavailable',
      auditStatus:
        'stub provider outage metadata recorded; mutation failed closed',
      recoveryStatus:
        'provider outage is fail-closed and requires a fresh audited preview',
      retryPolicy: 'fresh plan required before any retry',
      providerAuthChallengeRef: null,
      providerRecoveryRef:
        'provider-recovery-reset-serviceadmin-session-signing-metadata',
      nextAction:
        'restore provider connectivity or capability support and create a fresh preview',
    })
    expect(providerUnavailableResult.resultStatus).toMatch(
      /provider connector is unavailable or unsupported/i
    )
    expect(providerUnavailableResult.recoverySteps).toEqual(
      expect.arrayContaining([
        'wait for broker health to confirm the provider connector is reachable',
        'keep the current operation id for support evidence only',
        'create a fresh audited preview after provider capability metadata refreshes',
      ])
    )
    expect(providerUnavailableResult.safetyRows).toEqual(
      expect.arrayContaining([
        'provider outage details are limited to connector state, capability metadata, and correlation id',
      ])
    )
    expect(providerUnavailableResult.auditFeedback).toMatchObject({
      eventState: 'recorded as provider unavailable with no source access',
    })
    expect(providerUnavailableResult.auditFeedback.evidenceRows).toEqual(
      expect.arrayContaining([
        'provider outage evidence contains connector status metadata only and never provider credentials',
      ])
    )
    expect(
      managedSecretSingleHistoryHasSecretMaterial([
        buildSingleSecretOperationHistoryEntry(
          managedSecretRows[0],
          rotatePlan,
          2,
          'provider-unavailable'
        ),
      ])
    ).toBe(false)
    expect(providerUnavailableResult.providerRecoveryRef).not.toMatch(
      /credential|token|cookie|private key|request body|response body|DEMO_REVEAL_VALUE_42/i
    )

    const staleResult = buildSingleSecretOperationResult(
      managedSecretRows[0],
      rotatePlan,
      'stale-plan'
    )
    expect(staleResult).toMatchObject({
      outcome: 'stale-plan',
      applied: false,
      resultBadge: 'stale plan',
      auditStatus: 'stub stale-plan rejection recorded; mutation failed closed',
      recoveryStatus: 'stale plan recovery requires a fresh audited preview',
      retryPolicy: 'fresh plan required before any retry',
      nextAction: 'create a fresh dry-run plan before retry',
    })
    expect(staleResult.resultStatus).toMatch(
      /dry-run plan token expired before final broker revalidation/i
    )
    expect(staleResult.recoverySteps).toEqual(
      expect.arrayContaining([
        'discard the expired dry-run token and operation submit envelope',
        'refresh policy, provider capability, audit sink, and ref metadata before retry',
        'create a fresh audited preview before any broker submit is attempted',
      ])
    )
    expect(staleResult.safetyRows).toEqual(
      expect.arrayContaining([
        'stale-plan evidence is limited to operation id, ref, action, and expired preview metadata',
      ])
    )
    expect(staleResult.auditFeedback).toMatchObject({
      eventState: 'recorded as stale-plan rejection',
    })
    expect(staleResult.auditFeedback.evidenceRows).toEqual(
      expect.arrayContaining([
        'stale-plan evidence contains expired preview metadata only and never request or response bodies',
      ])
    )
    expect(
      managedSecretSingleHistoryHasSecretMaterial([
        buildSingleSecretOperationHistoryEntry(
          managedSecretRows[0],
          rotatePlan,
          2,
          'stale-plan'
        ),
      ])
    ).toBe(false)

    const failedResult = buildSingleSecretOperationResult(
      managedSecretRows[0],
      rotatePlan,
      'failed'
    )
    expect(failedResult).toMatchObject({
      outcome: 'failed',
      applied: false,
      resultBadge: 'apply failed',
      brokerFailureRef:
        'broker-failure-reset-serviceadmin-session-signing-metadata',
      brokerFailureCategory: 'provider_retryable_safe_error',
      recoveryStatus:
        'broker failure recovery depends on retry-safe operation metadata',
      retryPolicy:
        'retry only with the same operation id when broker marks retry safe',
      nextAction:
        'review safe broker failure metadata and retry only when marked safe',
    })
    expect(failedResult.recoverySteps).toEqual(
      expect.arrayContaining([
        'preserve the broker failure reference for support evidence only',
        'retry only when the broker marks the same operation id retry safe',
        'create a fresh preview if the failure category changes before retry',
      ])
    )
    expect(failedResult.safetyRows).toEqual(
      expect.arrayContaining([
        'broker failure evidence is limited to operation id, category, retry-safe status, and correlation id',
      ])
    )
    expect(failedResult.auditFeedback).toMatchObject({
      eventState: 'recorded as safe broker failure metadata',
    })
    expect(failedResult.auditFeedback.evidenceRows).toEqual(
      expect.arrayContaining([
        'broker failure evidence contains typed category metadata only and never request or response bodies',
      ])
    )
    expect(failedResult.brokerFailureRef).not.toMatch(
      /credential|token|cookie|private key|request body|response body|DEMO_REVEAL_VALUE_42/i
    )
    const failedMonitor = buildSingleSecretStatusMonitor(
      managedSecretRows[0],
      rotatePlan,
      failedResult
    )
    const failedRecoveryDecision = buildSingleSecretRecoveryDecision(
      managedSecretRows[0],
      rotatePlan,
      failedResult,
      failedMonitor
    )
    expect(failedRecoveryDecision).toMatchObject({
      outcome: 'failed',
      badge: 'retry gated',
      retryAllowed: true,
      freshPreviewRequired: true,
      operatorAction:
        'retry only with the same operation id after reviewing broker failure metadata',
      brokerAction:
        'allow one operation-id retry when broker marks it retry-safe',
      blocker: 'broker safe failure metadata review required',
      retryRef: 'retry-reset-serviceadmin-session-signing-operation-id-only',
    })
    expect(
      managedSecretRecoveryDecisionHasSecretMaterial(failedRecoveryDecision)
    ).toBe(false)

    const historyEntry = buildSingleSecretOperationHistoryEntry(
      managedSecretRows[0],
      rotatePlan,
      1,
      'failed'
    )
    expect(historyEntry).toMatchObject({
      operationId: rotatePlan.operationId,
      rowName: 'SESSION_SIGNING_KEY',
      provider: 'local encrypted store',
      auditEventId: 'audit-reset-serviceadmin-session-signing-1',
      statusBadge: 'apply failed',
      submittedAt: 'stub-sequence-1',
    })
    expect(historyEntry.auditFeedback).toMatchObject({
      auditEventId: 'audit-reset-serviceadmin-session-signing-1',
      correlationId: 'corr-reset-serviceadmin-session-signing-failed',
      eventState: 'recorded as safe broker failure metadata',
    })
    expect(managedSecretSingleHistoryHasSecretMaterial([historyEntry])).toBe(
      false
    )
    const appliedHistoryEntry = buildSingleSecretOperationHistoryEntry(
      managedSecretRows[0],
      rotatePlan,
      2,
      'applied'
    )
    const historyReview = buildSingleSecretOperationHistoryReview(
      [historyEntry, appliedHistoryEntry],
      {
        action: 'reset',
        outcome: 'failed',
        query: 'broker failure',
      }
    )
    expect(historyReview).toMatchObject({
      totalCount: 2,
      filteredCount: 1,
      appliedCount: 0,
      blockedCount: 1,
      pendingCount: 0,
      safeSearchStatus:
        'history search matched metadata-only operation evidence',
    })
    expect(historyReview.entries[0]).toMatchObject({
      outcome: 'failed',
      auditEventId: 'audit-reset-serviceadmin-session-signing-1',
    })
    expect(historyReview.allowedFields).toEqual(
      expect.arrayContaining([
        'operationId',
        'ref',
        'outcome',
        'auditEventId',
        'correlationId',
      ])
    )
    expect(historyReview.omittedFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBody',
        'responseBody',
        'providerCredentials',
        'providerTokens',
        'cookies',
        'privateKeys',
        'recoveryMaterial',
        'environmentValues',
      ])
    )
    expect(historyReview.safeEvidenceRows).toEqual(
      expect.arrayContaining([
        'history filters operate on refs, operation ids, action/outcome, audit ids, correlation ids, and provider metadata only',
        'filtered history rows remain safe for support triage and screenshots because value display regions stay hidden',
      ])
    )
    expect(managedSecretHistoryReviewHasSecretMaterial(historyReview)).toBe(
      false
    )

    const cancelledResult = buildSingleSecretOperationResult(
      managedSecretRows[0],
      rotatePlan,
      'cancelled'
    )
    expect(cancelledResult).toMatchObject({
      outcome: 'cancelled',
      applied: false,
      resultBadge: 'cancelled by operator',
      auditStatus:
        'stub cancellation metadata recorded; mutation not submitted',
      recoveryStatus:
        'cancelled preview was not submitted and can only resume with a fresh dry-run',
      retryPolicy: 'fresh plan required before any retry',
      nextAction:
        'create a fresh dry-run preview if the operator resumes this action',
    })
    expect(cancelledResult.recoverySteps).toEqual(
      expect.arrayContaining([
        'record the cancelled operation id as audit metadata only',
        'discard the cancelled submit envelope before any broker mutation',
        'create a fresh audited preview if the operator resumes',
      ])
    )
    expect(cancelledResult.safetyRows).toEqual(
      expect.arrayContaining([
        'cancellation evidence is limited to operation id, ref, action, audit reason metadata, and correlation id',
      ])
    )
    expect(cancelledResult.auditFeedback).toMatchObject({
      eventState: 'recorded as operator cancellation with no broker mutation',
    })
    expect(cancelledResult.auditFeedback.evidenceRows).toEqual(
      expect.arrayContaining([
        'cancellation evidence contains typed operator intent metadata only and never request or response bodies',
      ])
    )
    const cancelledTrail = buildSingleSecretOperationAuditTrail(
      managedSecretRows[0],
      rotatePlan,
      'cancelled'
    )
    expect(cancelledTrail[2]).toMatchObject({
      status: 'terminal operator cancellation',
      terminal: true,
    })
    const cancelledMonitor = buildSingleSecretStatusMonitor(
      managedSecretRows[0],
      rotatePlan,
      cancelledResult
    )
    expect(cancelledMonitor).toMatchObject({
      terminalState: 'terminal operator cancellation',
      stateBadge: 'cancelled',
      retryAllowed: false,
      stalePlanGuard:
        'status updates are accepted only when operation id, ref, action, and correlation id match the latest preview',
    })
    expect(cancelledMonitor.statusRows).toEqual(
      expect.arrayContaining([
        'cancelled preview: operator stopped before broker mutation',
      ])
    )
    expect(cancelledMonitor.safeEvidenceRows).toEqual(
      expect.arrayContaining([
        'cancelled preview recovery creates a fresh dry-run and omits request and response body echoes',
      ])
    )
    expect(managedSecretStatusMonitorHasSecretMaterial(cancelledMonitor)).toBe(
      false
    )

    const auditTrail = buildSingleSecretOperationAuditTrail(
      managedSecretRows[0],
      rotatePlan,
      'applied'
    )
    expect(auditTrail).toHaveLength(4)
    expect(auditTrail[0]).toMatchObject({
      label: 'Dry-run preview recorded',
      actorRef: 'serviceadmin-ui',
      terminal: false,
    })
    expect(auditTrail[1]).toMatchObject({
      label: 'Apply gate evaluated',
      actorRef: 'secretsbroker-policy',
      evidence: 'confirmation, capability, policy, and audit metadata accepted',
    })
    expect(auditTrail[2]).toMatchObject({
      label: 'Broker status callback',
      actorRef: '@secretsbroker',
      status: 'terminal success',
      evidence: 'corr-reset-serviceadmin-session-signing-applied',
      terminal: true,
    })
    expect(auditTrail[3]).toMatchObject({
      label: 'Audit sink retention',
      actorRef: '@secretsbroker-audit',
      evidence: 'audit-reset-serviceadmin-session-signing-preview',
    })
    expect(auditTrail.map((step) => step.redaction).join(' ')).toMatch(
      /omits payloads, tokens, cookies, keys, and raw secret material/i
    )
    expect(managedSecretSingleAuditTrailHasSecretMaterial(auditTrail)).toBe(
      false
    )
    const auditReceipt = buildSingleSecretAuditReceipt(
      managedSecretRows[0],
      rotatePlan,
      appliedResult,
      auditTrail
    )
    expect(auditReceipt).toMatchObject({
      receiptId: 'audit-receipt-reset-serviceadmin-session-signing-applied',
      operationId: rotatePlan.operationId,
      outcome: 'applied',
      auditEventId: 'audit-reset-serviceadmin-session-signing-preview',
      correlationId: 'corr-reset-serviceadmin-session-signing-applied',
      terminalStepStatus: 'terminal success',
      retentionStatus:
        'audit receipt retained with metadata-only terminal evidence',
    })
    expect(auditReceipt.receiptChecksum).toMatch(/^safe-audit-\d{5}$/)
    expect(auditReceipt.safeReceiptFields).toEqual(
      expect.arrayContaining([
        'receiptId',
        'operationId',
        'ref',
        'action',
        'outcome',
        'auditEventId',
        'correlationId',
        'receiptChecksum',
      ])
    )
    expect(auditReceipt.omittedReceiptArtifacts).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBody',
        'responseBody',
        'requestHeaders',
        'providerCredentials',
        'providerTokens',
        'cookies',
        'privateKeys',
        'recoveryMaterial',
        'environmentValues',
      ])
    )
    expect(auditReceipt.safeReceiptRows).toEqual(
      expect.arrayContaining([
        'audit receipts are derived from operation ids, refs, typed outcomes, audit ids, and correlation ids only',
        'receipt checksum proves the metadata set reviewed without hashing or storing secret payloads',
        'retained audit receipts are shareable for support and issue trails without raw values',
      ])
    )
    expect(managedSecretAuditReceiptHasSecretMaterial(auditReceipt)).toBe(false)
    const authRequiredTrail = buildSingleSecretOperationAuditTrail(
      managedSecretRows[0],
      rotatePlan,
      'auth-required'
    )
    expect(authRequiredTrail[2]).toMatchObject({
      status: 'paused for broker reauthentication',
      terminal: true,
    })
    expect(
      managedSecretSingleAuditTrailHasSecretMaterial(authRequiredTrail)
    ).toBe(false)
    const authRequiredReceipt = buildSingleSecretAuditReceipt(
      managedSecretRows[0],
      rotatePlan,
      authRequiredResult,
      authRequiredTrail
    )
    expect(authRequiredReceipt).toMatchObject({
      outcome: 'auth-required',
      terminalStepStatus: 'paused for broker reauthentication',
      retentionStatus:
        'audit receipt retained with metadata-only terminal evidence',
    })
    expect(
      managedSecretAuditReceiptHasSecretMaterial(authRequiredReceipt)
    ).toBe(false)
    const statusMonitor = buildSingleSecretStatusMonitor(
      managedSecretRows[0],
      rotatePlan,
      appliedResult
    )
    expect(statusMonitor).toMatchObject({
      operationId: rotatePlan.operationId,
      statusEndpoint: 'GET /v1/management/secret-operations/{operationId}',
      terminalState: 'terminal success',
      stateBadge: 'settled',
      retryAllowed: false,
      retryToken: 'fresh broker preview required before retry',
      operatorNextAction:
        'monitor dependent service restart notes and rotation freshness',
    })
    expect(statusMonitor.allowedStatusFields).toEqual(
      expect.arrayContaining([
        'operationId',
        'ref',
        'action',
        'outcome',
        'correlationId',
      ])
    )
    expect(statusMonitor.omittedStatusFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBodyEcho',
        'providerCredentials',
        'environmentValues',
      ])
    )
    expect(statusMonitor.safeEvidenceRows).toEqual(
      expect.arrayContaining([
        'status polling is keyed by operation id, not by secret value',
        'terminal status records typed broker metadata only',
      ])
    )
    expect(managedSecretStatusMonitorHasSecretMaterial(statusMonitor)).toBe(
      false
    )
    const evidenceBundle = buildSingleSecretEvidenceBundle(
      managedSecretRows[0],
      rotatePlan,
      appliedResult,
      statusMonitor
    )
    expect(evidenceBundle).toMatchObject({
      bundleId: 'support-evidence-reset-serviceadmin-session-signing-applied',
      operationId: rotatePlan.operationId,
      reportRef: 'report-reset-serviceadmin-session-signing-applied-metadata',
      diagnosticsRef:
        'diagnostics-reset-serviceadmin-session-signing-settled-metadata',
      supportBundleStatus:
        'safe support bundle ready after terminal broker metadata',
    })
    expect(evidenceBundle.allowedFields).toEqual(
      expect.arrayContaining([
        'operationId',
        'ref',
        'outcome',
        'auditEventId',
        'correlationId',
        'dependentServiceRefs',
      ])
    )
    expect(evidenceBundle.omittedArtifacts).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBody',
        'responseBody',
        'providerCredentials',
        'screenshotsWithVisibleValues',
        'diagnosticPayloadsWithBodies',
      ])
    )
    expect(evidenceBundle.safeEvidenceRows).toEqual(
      expect.arrayContaining([
        'support reports are generated from typed broker metadata, not from secret payloads',
        'diagnostics and support bundles omit request bodies, response bodies, provider auth material, and raw environment values',
      ])
    )
    expect(managedSecretEvidenceBundleHasSecretMaterial(evidenceBundle)).toBe(
      false
    )
    const recoveryDecision = buildSingleSecretRecoveryDecision(
      managedSecretRows[0],
      rotatePlan,
      appliedResult,
      statusMonitor
    )
    expect(recoveryDecision).toMatchObject({
      decisionId: 'recovery-reset-serviceadmin-session-signing-applied',
      operationId: rotatePlan.operationId,
      outcome: 'applied',
      badge: 'settled',
      retryAllowed: false,
      freshPreviewRequired: false,
      operatorAction:
        'review terminal metadata and dependent service freshness',
      brokerAction: 'retain terminal status and audit metadata for review',
      blocker: 'none',
      rollbackRef:
        'rotation-monitor-reset-serviceadmin-session-signing-metadata',
      retryRef: 'retry blocked until a fresh broker preview is created',
    })
    expect(recoveryDecision.allowedRecoveryFields).toEqual(
      expect.arrayContaining([
        'decisionId',
        'operationId',
        'correlationId',
        'auditEventId',
        'retryAllowed',
      ])
    )
    expect(recoveryDecision.omittedRecoveryFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBodyEcho',
        'responseBodyEcho',
        'providerCredentials',
        'environmentValues',
      ])
    )
    expect(recoveryDecision.safeRecoveryRows).toEqual(
      expect.arrayContaining([
        'recovery decisions are derived from typed broker metadata only',
        'retry eligibility is scoped to operation id, ref, action, and correlation id',
      ])
    )
    expect(
      managedSecretRecoveryDecisionHasSecretMaterial(recoveryDecision)
    ).toBe(false)
    const operatorHandoff = buildSingleSecretOperatorHandoff(
      managedSecretRows[0],
      rotatePlan,
      appliedResult,
      statusMonitor,
      recoveryDecision
    )
    expect(operatorHandoff).toMatchObject({
      handoffId: 'handoff-reset-serviceadmin-session-signing-applied',
      operationId: rotatePlan.operationId,
      outcome: 'applied',
      lane: 'settled',
      owner: 'operator',
      severity: 'info',
      badge: 'closed',
      blockedReason: null,
      requiredAction: 'review terminal status and no further mutation action',
    })
    expect(operatorHandoff.shareableEvidenceRefs).toEqual(
      expect.arrayContaining([
        'audit-reset-serviceadmin-session-signing-preview',
        'corr-reset-serviceadmin-session-signing-applied',
        'impact-reset-serviceadmin-session-signing-applied-metadata',
        statusMonitor.statusEndpoint,
      ])
    )
    expect(operatorHandoff.allowedHandoffFields).toEqual(
      expect.arrayContaining([
        'handoffId',
        'operationId',
        'auditEventId',
        'correlationId',
        'statusEndpoint',
      ])
    )
    expect(operatorHandoff.omittedHandoffFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBody',
        'responseBody',
        'providerCredentials',
        'screenshotsWithVisibleValues',
      ])
    )
    expect(operatorHandoff.safeHandoffRows).toEqual(
      expect.arrayContaining([
        'operator handoffs use ids, refs, typed outcomes, owner lanes, and audit metadata only',
        'handoff evidence can be copied into issue or audit notes without raw secret material',
      ])
    )
    expect(managedSecretOperatorHandoffHasSecretMaterial(operatorHandoff)).toBe(
      false
    )
    const ownerActionTicket = buildSingleSecretOwnerActionTicket(
      managedSecretRows[0],
      rotatePlan,
      operatorHandoff
    )
    expect(ownerActionTicket).toMatchObject({
      ticketId: 'owner-action-reset-serviceadmin-session-signing-applied',
      operationId: rotatePlan.operationId,
      lane: 'settled',
      owner: 'operator',
      severity: 'info',
      freshPreviewRequired: false,
      acknowledgementStatus:
        'acknowledge terminal broker metadata before closing operator review',
      safeEscalationRoute:
        'keep in operator queue with metadata-only evidence refs',
    })
    expect(ownerActionTicket.allowedTicketFields).toEqual(
      expect.arrayContaining([
        'ticketId',
        'operationId',
        'auditEventId',
        'correlationId',
        'statusEndpoint',
      ])
    )
    expect(ownerActionTicket.omittedTicketFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBody',
        'responseBody',
        'providerCredentials',
        'diagnosticPayloadsWithBodies',
      ])
    )
    expect(ownerActionTicket.safeTicketRows).toEqual(
      expect.arrayContaining([
        'owner action tickets are generated from the safe handoff packet only',
        'no mutation payload is retained while the operation is monitored or settled',
      ])
    )
    expect(
      managedSecretOwnerActionTicketHasSecretMaterial(ownerActionTicket)
    ).toBe(false)
    const closureReview = buildSingleSecretClosureReview(
      managedSecretRows[0],
      rotatePlan,
      appliedResult,
      statusMonitor,
      evidenceBundle,
      auditReceipt,
      operatorHandoff,
      ownerActionTicket
    )
    expect(closureReview).toMatchObject({
      closureId: 'closure-review-reset-serviceadmin-session-signing-applied',
      operationId: rotatePlan.operationId,
      outcome: 'applied',
      reviewState: 'ready-to-close',
      badge: 'operator review can close',
      canCloseOperatorReview: true,
    })
    expect(closureReview.requiredBeforeClose).toEqual(
      expect.arrayContaining([
        'acknowledge terminal audit receipt',
        'retain support evidence bundle reference',
        'confirm dependent service status is reviewed',
      ])
    )
    expect(closureReview.retainedEvidenceRefs).toEqual(
      expect.arrayContaining([
        auditReceipt.receiptId,
        auditReceipt.receiptChecksum,
        evidenceBundle.bundleId,
        evidenceBundle.reportRef,
        statusMonitor.statusEndpoint,
        operatorHandoff.handoffId,
        ownerActionTicket.ticketId,
      ])
    )
    expect(closureReview.allowedClosureFields).toEqual(
      expect.arrayContaining([
        'closureId',
        'operationId',
        'auditEventId',
        'correlationId',
        'receiptChecksum',
        'statusEndpoint',
        'ownerActionTicketId',
      ])
    )
    expect(closureReview.omittedClosureFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBody',
        'responseBody',
        'providerCredentials',
        'providerTokens',
        'cookies',
        'privateKeys',
        'recoveryMaterial',
        'environmentValues',
        'screenshotsWithVisibleValues',
        'diagnosticPayloadsWithBodies',
      ])
    )
    expect(closureReview.safeClosureRows).toEqual(
      expect.arrayContaining([
        'closure review stores only ids, refs, typed outcomes, audit refs, and support evidence refs',
        'operator review may close after terminal metadata and audit receipt acknowledgement',
        'closing or keeping the review open never requires raw value reveal, request body replay, provider credentials, or diagnostic payload bodies',
      ])
    )
    expect(managedSecretClosureReviewHasSecretMaterial(closureReview)).toBe(
      false
    )
    const authRequiredMonitor = buildSingleSecretStatusMonitor(
      managedSecretRows[0],
      rotatePlan,
      authRequiredResult
    )
    expect(authRequiredMonitor).toMatchObject({
      terminalState: 'paused for broker authentication',
      stateBadge: 'auth challenge',
      retryAllowed: false,
      retryToken: 'fresh broker preview required before retry',
      operatorNextAction:
        'complete broker provider reauthentication and create a fresh preview',
    })
    expect(authRequiredMonitor.statusRows).toEqual(
      expect.arrayContaining([
        'auth challenge: broker-owned provider reauthentication required',
      ])
    )
    expect(authRequiredMonitor.safeEvidenceRows).toEqual(
      expect.arrayContaining([
        'provider reauthentication happens outside Service Admin and omits provider credentials',
      ])
    )
    expect(
      managedSecretStatusMonitorHasSecretMaterial(authRequiredMonitor)
    ).toBe(false)
    const authRequiredRecoveryDecision = buildSingleSecretRecoveryDecision(
      managedSecretRows[0],
      rotatePlan,
      authRequiredResult,
      authRequiredMonitor
    )
    expect(authRequiredRecoveryDecision).toMatchObject({
      outcome: 'auth-required',
      badge: 'fresh preview required',
      retryAllowed: false,
      freshPreviewRequired: true,
      operatorAction:
        'complete provider reauthentication, then create a fresh audited preview',
      brokerAction: 'issue broker-owned provider challenge metadata only',
      blocker: 'auth required',
    })
    expect(authRequiredRecoveryDecision.safeRecoveryRows).toEqual(
      expect.arrayContaining([
        'provider challenge stays broker-owned and omits auth material',
      ])
    )
    expect(
      managedSecretRecoveryDecisionHasSecretMaterial(
        authRequiredRecoveryDecision
      )
    ).toBe(false)
    const authRequiredHandoff = buildSingleSecretOperatorHandoff(
      managedSecretRows[0],
      rotatePlan,
      authRequiredResult,
      authRequiredMonitor,
      authRequiredRecoveryDecision
    )
    expect(authRequiredHandoff).toMatchObject({
      outcome: 'auth-required',
      lane: 'provider-auth',
      owner: 'provider owner',
      severity: 'warning',
      badge: 'owner action required',
      blockedReason: 'auth required',
      requiredAction:
        'complete provider reauthentication, then create a fresh audited preview',
      validatorNote:
        'blocked state must be revalidated with a fresh preview before another mutation attempt',
    })
    expect(authRequiredHandoff.safeHandoffRows).toEqual(
      expect.arrayContaining([
        'blocked handoffs require owner action and a fresh broker preview before another submit',
      ])
    )
    expect(
      managedSecretOperatorHandoffHasSecretMaterial(authRequiredHandoff)
    ).toBe(false)
    const authRequiredTicket = buildSingleSecretOwnerActionTicket(
      managedSecretRows[0],
      rotatePlan,
      authRequiredHandoff
    )
    expect(authRequiredTicket).toMatchObject({
      ticketId: 'owner-action-reset-serviceadmin-session-signing-auth-required',
      lane: 'provider-auth',
      owner: 'provider owner',
      severity: 'warning',
      acknowledgementStatus:
        'owner acknowledgement required before another broker preview',
      freshPreviewRequired: true,
      safeEscalationRoute:
        'keep in operator queue with metadata-only evidence refs',
    })
    expect(authRequiredTicket.safeTicketRows).toEqual(
      expect.arrayContaining([
        'fresh broker preview is required after owner action before any mutation retry',
        'provider authentication happens outside Service Admin and omits provider credentials',
      ])
    )
    expect(
      managedSecretOwnerActionTicketHasSecretMaterial(authRequiredTicket)
    ).toBe(false)
    const authRequiredEvidenceBundle = buildSingleSecretEvidenceBundle(
      managedSecretRows[0],
      rotatePlan,
      authRequiredResult,
      authRequiredMonitor
    )
    const authRequiredClosureReview = buildSingleSecretClosureReview(
      managedSecretRows[0],
      rotatePlan,
      authRequiredResult,
      authRequiredMonitor,
      authRequiredEvidenceBundle,
      authRequiredReceipt,
      authRequiredHandoff,
      authRequiredTicket
    )
    expect(authRequiredClosureReview).toMatchObject({
      closureId:
        'closure-review-reset-serviceadmin-session-signing-auth-required',
      outcome: 'auth-required',
      reviewState: 'owner-action-required',
      badge: 'owner action required before close',
      canCloseOperatorReview: false,
    })
    expect(authRequiredClosureReview.requiredBeforeClose).toEqual(
      expect.arrayContaining([
        'complete provider reauthentication, then create a fresh audited preview',
        'complete owner acknowledgement',
        'create a fresh preview before any new mutation attempt',
      ])
    )
    expect(authRequiredClosureReview.safeClosureRows).toEqual(
      expect.arrayContaining([
        'blocked operations stay open until owner action and a fresh preview are completed',
      ])
    )
    expect(
      managedSecretClosureReviewHasSecretMaterial(authRequiredClosureReview)
    ).toBe(false)
    const auditUnavailableTrail = buildSingleSecretOperationAuditTrail(
      managedSecretRows[0],
      rotatePlan,
      'audit-unavailable'
    )
    expect(auditUnavailableTrail[2]).toMatchObject({
      status: 'terminal audit unavailable',
      terminal: true,
    })
    expect(
      managedSecretSingleAuditTrailHasSecretMaterial(auditUnavailableTrail)
    ).toBe(false)
    const auditUnavailableMonitor = buildSingleSecretStatusMonitor(
      managedSecretRows[0],
      rotatePlan,
      auditUnavailableResult
    )
    expect(auditUnavailableMonitor).toMatchObject({
      terminalState: 'terminal audit unavailable',
      stateBadge: 'audit blocked',
      retryAllowed: false,
      retryToken: 'fresh broker preview required before retry',
      operatorNextAction:
        'restore audit sink availability and create a fresh preview',
    })
    expect(
      managedSecretStatusMonitorHasSecretMaterial(auditUnavailableMonitor)
    ).toBe(false)
    const providerUnavailableTrail = buildSingleSecretOperationAuditTrail(
      managedSecretRows[0],
      rotatePlan,
      'provider-unavailable'
    )
    expect(providerUnavailableTrail[2]).toMatchObject({
      status: 'terminal provider unavailable',
      terminal: true,
    })
    expect(
      managedSecretSingleAuditTrailHasSecretMaterial(providerUnavailableTrail)
    ).toBe(false)
    const providerUnavailableMonitor = buildSingleSecretStatusMonitor(
      managedSecretRows[0],
      rotatePlan,
      providerUnavailableResult
    )
    expect(providerUnavailableMonitor).toMatchObject({
      terminalState: 'terminal provider unavailable',
      stateBadge: 'provider outage',
      retryAllowed: false,
      retryToken: 'fresh broker preview required before retry',
      operatorNextAction:
        'restore provider connectivity or capability support and create a fresh preview',
    })
    expect(providerUnavailableMonitor.statusRows).toEqual(
      expect.arrayContaining([
        'provider status: connector unavailable or unsupported',
      ])
    )
    expect(providerUnavailableMonitor.safeEvidenceRows).toEqual(
      expect.arrayContaining([
        'provider recovery happens in broker/provider configuration and omits provider credentials',
      ])
    )
    expect(
      managedSecretStatusMonitorHasSecretMaterial(providerUnavailableMonitor)
    ).toBe(false)
    const stalePlanTrail = buildSingleSecretOperationAuditTrail(
      managedSecretRows[0],
      rotatePlan,
      'stale-plan'
    )
    expect(stalePlanTrail[2]).toMatchObject({
      status: 'terminal stale-plan rejection',
      terminal: true,
    })
    expect(managedSecretSingleAuditTrailHasSecretMaterial(stalePlanTrail)).toBe(
      false
    )
    const stalePlanMonitor = buildSingleSecretStatusMonitor(
      managedSecretRows[0],
      rotatePlan,
      staleResult
    )
    expect(stalePlanMonitor).toMatchObject({
      terminalState: 'terminal stale-plan rejection',
      stateBadge: 'stale-plan',
      retryAllowed: false,
      retryToken: 'fresh broker preview required before retry',
      operatorNextAction: 'create a fresh dry-run plan before retry',
    })
    expect(stalePlanMonitor.stalePlanGuard).toMatch(
      /existing dry-run token rejected/i
    )
    expect(stalePlanMonitor.statusRows).toEqual(
      expect.arrayContaining([
        'stale preview: broker rejected the expired dry-run token',
      ])
    )
    expect(stalePlanMonitor.safeEvidenceRows).toEqual(
      expect.arrayContaining([
        'stale-plan recovery creates a new dry-run and omits request and response body echoes',
      ])
    )
    expect(managedSecretStatusMonitorHasSecretMaterial(stalePlanMonitor)).toBe(
      false
    )

    const actionReadiness = buildManagedSecretActionReadiness(
      managedSecretRows[0]
    )
    expect(actionReadiness).toHaveLength(5)
    expect(actionReadiness.every((item) => item.canPreview)).toBe(true)
    expect(managedSecretActionReadinessHasSecretMaterial(actionReadiness)).toBe(
      false
    )

    const missingActionReadiness = buildManagedSecretActionReadiness(
      managedSecretRows[3]
    )
    expect(missingActionReadiness.every((item) => !item.canPreview)).toBe(true)
    expect(missingActionReadiness[0].blockers).toContain('ref unavailable')
    expect(missingActionReadiness[3].blockers).toContain(
      'delete dry-run unsupported'
    )
    expect(
      managedSecretActionReadinessHasSecretMaterial(missingActionReadiness)
    ).toBe(false)

    const revealPlan = buildSingleSecretOperationPlan(
      managedSecretRows[0],
      'reveal',
      'operator requested controlled reveal',
      true,
      'ready'
    )
    const revealPreview = buildSingleSecretRevealPreview(
      managedSecretRows[0],
      revealPlan
    )
    expect(revealPreview).toMatchObject({
      eligible: true,
      badge: 'reveal challenge ready',
      revealChallengeId:
        'challenge-reveal-serviceadmin-session-signing-metadata',
      auditEventId: 'audit-reveal-serviceadmin-session-signing-preview',
      applyGate:
        'ready for broker-owned reveal challenge after final revalidation',
    })
    expect(revealPreview.displayGuardrails).toEqual(
      expect.arrayContaining([
        'value stays hidden until the broker returns an authorized short-lived display',
        'copy and export remain unavailable from this management table',
      ])
    )
    expect(revealPreview.safeMetadataRows).toEqual(
      expect.arrayContaining([
        'raw secret value is not fetched during preview generation',
        'route, query string, local storage, diagnostics, and support bundles receive no secret material',
      ])
    )
    expect(managedSecretRevealPreviewHasSecretMaterial(revealPreview)).toBe(
      false
    )
    const authorizedRevealLifecycle = buildSingleSecretRevealLifecycle(
      managedSecretRows[0],
      revealPreview,
      'authorized'
    )
    expect(authorizedRevealLifecycle).toMatchObject({
      state: 'authorized',
      badge: 'authorized display metadata',
      revealSessionRef:
        'reveal-session-reveal-serviceadmin-session-signing-metadata',
      valueStatus: 'hidden; no value is stored, copied, exported, or logged',
      blockedReason: null,
    })
    expect(authorizedRevealLifecycle.safeEvidenceRows).toEqual(
      expect.arrayContaining([
        'short-lived display can be revoked or expire without persisting value payloads',
      ])
    )
    expect(authorizedRevealLifecycle.omittedUnsafeFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'displayPayload',
        'requestBody',
        'responseBody',
        'providerCredentials',
        'providerTokens',
        'cookies',
        'privateKeys',
        'recoveryMaterial',
        'environmentValues',
      ])
    )
    expect(
      managedSecretRevealLifecycleHasSecretMaterial(authorizedRevealLifecycle)
    ).toBe(false)

    const deniedRevealLifecycle = buildSingleSecretRevealLifecycle(
      managedSecretRows[0],
      revealPreview,
      'denied'
    )
    expect(deniedRevealLifecycle).toMatchObject({
      state: 'denied',
      badge: 'policy denied',
      revealSessionRef: 'no active display session',
      blockedReason: 'broker policy denied reveal after challenge review',
    })
    expect(deniedRevealLifecycle.safeEvidenceRows).toEqual(
      expect.arrayContaining([
        'policy-denied state records decision refs without source access',
      ])
    )
    expect(
      managedSecretRevealLifecycleHasSecretMaterial(deniedRevealLifecycle)
    ).toBe(false)

    const missingRevealPlan = buildSingleSecretOperationPlan(
      managedSecretRows[3],
      'reveal',
      'operator requested controlled reveal',
      true,
      'ready'
    )
    const blockedRevealPreview = buildSingleSecretRevealPreview(
      managedSecretRows[3],
      missingRevealPlan
    )
    expect(blockedRevealPreview).toMatchObject({
      eligible: false,
      badge: 'reveal challenge blocked',
      applyGate: 'ref unavailable',
    })
    expect(blockedRevealPreview.blockers).toEqual(
      expect.arrayContaining(['ref unavailable', 'reveal unsupported'])
    )
    expect(
      managedSecretRevealPreviewHasSecretMaterial(blockedRevealPreview)
    ).toBe(false)

    const missingDeletePlan = buildSingleSecretOperationPlan(
      managedSecretRows[3],
      'delete',
      'operator requested delete preview',
      true,
      'ready'
    )
    expect(missingDeletePlan.canSubmit).toBe(false)
    expect(missingDeletePlan.blockers).toContain('ref unavailable')
    expect(missingDeletePlan.blockers).toContain('delete dry-run unsupported')
    expect(missingDeletePlan.safePayloadFields).toEqual(
      expect.arrayContaining(['recoveryPlanRef', 'dependentServiceRefs'])
    )
    expect(missingDeletePlan.revalidationChecks).toEqual(
      expect.arrayContaining([
        'dependent service references and recovery guidance checked',
      ])
    )
    const blockedDeleteSubmitEnvelope = buildSingleSecretSubmitEnvelope(
      managedSecretRows[3],
      missingDeletePlan
    )
    expect(blockedDeleteSubmitEnvelope).toMatchObject({
      readyForSubmit: false,
      blockedReason: 'ref unavailable',
    })
    expect(blockedDeleteSubmitEnvelope.payloadFields).toEqual(
      expect.arrayContaining(['recoveryPlanRef', 'dependentServiceRefs'])
    )
    expect(
      managedSecretSubmitEnvelopeHasSecretMaterial(blockedDeleteSubmitEnvelope)
    ).toBe(false)

    const singlePolicyPlan = buildSingleSecretOperationPlan(
      managedSecretRows[0],
      'policy',
      'operator requested policy assignment preview',
      true,
      'ready'
    )
    expect(singlePolicyPlan.safePayloadFields).toEqual(
      expect.arrayContaining(['targetPolicyRef', 'policyDiffMetadata'])
    )
    expect(singlePolicyPlan.revalidationChecks).toEqual(
      expect.arrayContaining([
        'target policy assignment diff checked as metadata only',
      ])
    )
    const policyResult = buildSingleSecretOperationResult(
      managedSecretRows[0],
      singlePolicyPlan
    )
    expect(policyResult.impactEvidence).toMatchObject({
      title: 'Policy assignment impact evidence',
      impactRef:
        'impact-policy-serviceadmin-session-signing-submitted-metadata',
      rollbackRef: 'rollback-policy-serviceadmin-session-signing-metadata',
      freshPreviewRequirement:
        'wait for broker terminal metadata before any follow-up preview',
    })
    expect(policyResult.impactEvidence.dependentServiceRefs).toEqual(
      expect.arrayContaining(['@serviceadmin operator API'])
    )
    expect(policyResult.impactEvidence.omittedUnsafeFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBody',
        'responseBody',
        'providerCredentials',
        'providerTokens',
        'cookies',
        'privateKeys',
        'recoveryMaterial',
        'environmentValues',
      ])
    )
    expect(policyResult.impactEvidence.safeEvidenceRows).toEqual(
      expect.arrayContaining([
        'policy impact keeps previous and target policy refs as metadata-only rollback context',
      ])
    )
    expect(policyResult.safetyRows).toEqual(
      expect.arrayContaining([
        'policy change carries target policy metadata only',
      ])
    )
    expect(policyResult).toMatchObject({
      recoveryStatus: 'policy rollback requires a fresh audited preview',
      retryPolicy: 'fresh plan required before any retry',
    })
    expect(policyResult.recoverySteps).toEqual(
      expect.arrayContaining([
        'record previous policy reference as audit metadata',
        'reapply previous policy only through a fresh audited preview',
      ])
    )
    const policyPreview = buildSingleSecretPolicyPreview(
      managedSecretRows[0],
      singlePolicyPlan
    )
    expect(policyPreview).toMatchObject({
      eligible: true,
      badge: 'policy preview ready',
      currentPolicyRef: 'policy/openclaw/service-lasso/read-single-secret',
      targetPolicyRef:
        'policy/openclaw/service-lasso/serviceadmin/least-privilege-single-ref',
      rollbackPlanRef: 'rollback-policy-serviceadmin-session-signing-metadata',
      applyGate:
        'ready for broker-owned policy assignment submit after final revalidation',
    })
    expect(policyPreview.policyDiffMetadata).toEqual(
      expect.arrayContaining([
        'previousPolicyRef: policy/openclaw/service-lasso/read-single-secret',
        'targetPolicyRef: policy/openclaw/service-lasso/serviceadmin/least-privilege-single-ref',
      ])
    )
    expect(policyPreview.affectedConsumerRefs).toEqual(
      expect.arrayContaining(['@serviceadmin operator API'])
    )
    expect(policyPreview.enforcementChecks).toEqual(
      expect.arrayContaining([
        'per-service resolve policy is revalidated before submit',
        'audit writer availability is required before apply',
      ])
    )
    expect(policyPreview.safeMetadataRows).toEqual(
      expect.arrayContaining([
        'policy preview never reads or writes the current secret value',
        'rollback plan reference contains previous policy metadata only',
      ])
    )
    expect(managedSecretPolicyPreviewHasSecretMaterial(policyPreview)).toBe(
      false
    )

    const editPlan = buildSingleSecretOperationPlan(
      managedSecretRows[0],
      'edit',
      'operator requested metadata update preview',
      true,
      'ready'
    )
    expect(editPlan.safePayloadFields).toEqual(
      expect.arrayContaining([
        'metadataDiff',
        'patchPlanHash',
        'rollbackPlanRef',
      ])
    )
    expect(editPlan.revalidationChecks).toEqual(
      expect.arrayContaining([
        'metadata diff, schema guard, and conflict check reviewed',
      ])
    )
    const editPreview = buildSingleSecretEditPreview(
      managedSecretRows[0],
      editPlan
    )
    expect(editPreview).toMatchObject({
      eligible: true,
      badge: 'edit preview ready',
      patchPlanHash: 'patch-edit-serviceadmin-session-signing-metadata-sha256',
      conflictCheckRef: 'conflict-edit-serviceadmin-session-signing-metadata',
      rollbackPlanRef:
        'update-rollback-edit-serviceadmin-session-signing-metadata',
      applyGate:
        'ready for broker-owned edit/update submit after final conflict and policy revalidation',
    })
    expect(editPreview.targetMetadataFields).toEqual(
      expect.arrayContaining(['rotationPolicyRef', 'ownerServiceRef'])
    )
    expect(editPreview.immutableFields).toEqual(
      expect.arrayContaining([
        'ref',
        'providerCredential',
        'rawValue',
        'providerToken',
        'environmentValue',
      ])
    )
    expect(editPreview.affectedConsumerRefs).toEqual(
      expect.arrayContaining(['@serviceadmin runtime config loader'])
    )
    expect(editPreview.omittedUnsafeFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBody',
        'responseBody',
        'providerCredentials',
        'providerTokens',
        'cookies',
        'privateKeys',
        'recoveryMaterial',
        'environmentValues',
      ])
    )
    expect(editPreview.safeDiffRows).toEqual(
      expect.arrayContaining([
        'metadata diff contains field names, old/new metadata refs, and validation status only',
        'clear-value table editing is unavailable and cannot be represented in the patch plan',
      ])
    )
    expect(managedSecretEditPreviewHasSecretMaterial(editPreview)).toBe(false)

    const missingPolicyPlan = buildSingleSecretOperationPlan(
      managedSecretRows[3],
      'policy',
      'operator requested policy assignment preview',
      true,
      'ready'
    )
    const blockedPolicyPreview = buildSingleSecretPolicyPreview(
      managedSecretRows[3],
      missingPolicyPlan
    )
    expect(blockedPolicyPreview).toMatchObject({
      eligible: false,
      badge: 'policy preview blocked',
      targetPolicyRef:
        'policy/openclaw/service-lasso/payments-single-ref-review',
      applyGate: 'ref unavailable',
    })
    expect(blockedPolicyPreview.blockers).toEqual(
      expect.arrayContaining(['ref unavailable', 'policy preview unsupported'])
    )
    expect(
      managedSecretPolicyPreviewHasSecretMaterial(blockedPolicyPreview)
    ).toBe(false)

    const deletePlan = buildSingleSecretOperationPlan(
      managedSecretRows[0],
      'delete',
      'operator requested delete preview',
      true,
      'ready'
    )
    const decommissionPreview = buildSingleSecretDecommissionPreview(
      managedSecretRows[0],
      deletePlan
    )
    expect(decommissionPreview).toMatchObject({
      mode: 'decommission',
      eligible: true,
      badge: 'decommission preview ready',
      recoveryPlanRef: 'recovery-delete-serviceadmin-session-signing-metadata',
      tombstoneRef: 'tombstone-delete-serviceadmin-session-signing-metadata',
      applyGate:
        'ready for broker-owned delete/decommission submit after final revalidation',
    })
    expect(decommissionPreview.dependentServiceRefs).toEqual(
      expect.arrayContaining(['@serviceadmin runtime session loader'])
    )
    expect(decommissionPreview.safeMetadataRows).toEqual(
      expect.arrayContaining([
        'current secret value is not read before delete/decommission preview',
        'recovery plan reference is metadata-only and does not embed secret material',
      ])
    )
    expect(
      managedSecretDecommissionPreviewHasSecretMaterial(decommissionPreview)
    ).toBe(false)

    const blockedDecommissionPreview = buildSingleSecretDecommissionPreview(
      managedSecretRows[3],
      missingDeletePlan
    )
    expect(blockedDecommissionPreview).toMatchObject({
      eligible: false,
      badge: 'disable preview blocked',
      applyGate: 'ref unavailable',
    })
    expect(blockedDecommissionPreview.blockers).toEqual(
      expect.arrayContaining(['ref unavailable', 'delete dry-run unsupported'])
    )
    expect(
      managedSecretDecommissionPreviewHasSecretMaterial(
        blockedDecommissionPreview
      )
    ).toBe(false)

    const deleteResult = buildSingleSecretOperationResult(
      managedSecretRows[0],
      deletePlan
    )
    expect(deleteResult.impactEvidence).toMatchObject({
      title: 'Delete/decommission impact evidence',
      impactRef:
        'impact-delete-serviceadmin-session-signing-submitted-metadata',
      rollbackRef: 'recovery-delete-serviceadmin-session-signing-metadata',
    })
    expect(deleteResult.impactEvidence.dependentServiceRefs).toEqual(
      expect.arrayContaining(['@serviceadmin runtime session loader'])
    )
    expect(deleteResult.impactEvidence.safeEvidenceRows).toEqual(
      expect.arrayContaining([
        'decommission impact keeps tombstone and recovery references separate from secret material',
      ])
    )
    expect(deleteResult).toMatchObject({
      recoveryStatus:
        'delete/decommission requires recovery-guided broker ownership',
      retryPolicy: 'fresh plan required before any retry',
    })
    expect(deleteResult.recoverySteps).toEqual(
      expect.arrayContaining([
        'verify dependent service references before broker decommission',
        'restore only through a fresh broker plan if apply fails',
      ])
    )

    const bulkPlan = buildBulkSecretCampaignPlan(
      managedSecretRows,
      managedSecretRows.map((row) => row.id),
      'rotate-reset'
    )
    expect(bulkPlan.selectedCount).toBe(4)
    expect(bulkPlan.applicableCount).toBe(1)
    expect(bulkPlan.deniedCount).toBe(1)
    expect(bulkPlan.unsupportedCount).toBe(1)
    expect(bulkPlan.authRequiredCount).toBe(1)
    expect(bulkPlan.missingProviderCount).toBe(1)
    expect(bulkPlan.applyAvailable).toBe(true)
    expect(bulkPlan.planToken).toMatch(/rotate_reset/)
    expect(bulkPlan.items[0].operationItemId).toMatch(/campaign-/)
    expect(managedSecretBulkPlanHasSecretMaterial(bulkPlan)).toBe(false)

    const blockedGate = buildBulkSecretCampaignApplyGate(
      bulkPlan,
      'operator requested controlled campaign rotation',
      'CONFIRM HIGH RISK CAMPAIGN',
      'ready',
      true,
      false
    )
    expect(blockedGate.canApply).toBe(false)
    expect(blockedGate.blockers).toContain(
      'broker campaign apply API not connected'
    )

    const cleanPlan = buildBulkSecretCampaignPlan(
      managedSecretRows,
      [managedSecretRows[0].id],
      'rotate-reset'
    )
    const rejectedReasonGate = buildBulkSecretCampaignApplyGate(
      cleanPlan,
      'api_key=SuperSecret1234',
      'CONFIRM HIGH RISK CAMPAIGN',
      'ready',
      true,
      true
    )
    expect(rejectedReasonGate).toMatchObject({
      auditReasonAccepted: false,
      canApply: false,
    })
    expect(rejectedReasonGate.blockers).toContain(
      'audit reason contains secret-like material'
    )
    expect(rejectedReasonGate.statusRows).toContain(
      'audit reason rejected: remove secret-like material'
    )
    const staleGate = buildBulkSecretCampaignApplyGate(
      cleanPlan,
      'operator requested controlled campaign rotation',
      'CONFIRM HIGH RISK CAMPAIGN',
      'stale-plan',
      true,
      true
    )
    expect(staleGate.canApply).toBe(false)
    expect(staleGate.revalidationPassed).toBe(false)
    expect(staleGate.revalidationStatus).toMatch(/stale plan/i)

    const readyGate = buildBulkSecretCampaignApplyGate(
      cleanPlan,
      'operator requested controlled campaign rotation',
      'CONFIRM HIGH RISK CAMPAIGN',
      'ready',
      true,
      true
    )
    expect(readyGate.canApply).toBe(true)

    const applyResult = buildBulkSecretCampaignApplyResult(
      bulkPlan,
      'partial-failure'
    )
    expect(applyResult.outcome).toBe('partial_failure')
    expect(applyResult.appliedCount).toBe(1)
    expect(applyResult.deniedCount).toBe(1)
    expect(applyResult.unsupportedCount).toBe(1)
    expect(applyResult.authRequiredCount).toBe(1)
    expect(applyResult.skippedCount).toBe(0)
    expect(managedSecretBulkApplyResultHasSecretMaterial(applyResult)).toBe(
      false
    )
    const partialClosure = buildBulkSecretCampaignClosureReview(applyResult)
    expect(partialClosure).toMatchObject({
      campaignId: applyResult.campaignId,
      operationId: applyResult.operationId,
      outcome: 'partial_failure',
      reviewState: 'blocked',
      canCloseCampaignReview: false,
    })
    expect(partialClosure.requiredBeforeClose).toEqual(
      expect.arrayContaining([
        'resolve the typed blocker named by the campaign next action',
        'create a fresh campaign dry-run before any new mutation attempt',
      ])
    )
    expect(partialClosure.allowedClosureFields).toEqual(
      expect.arrayContaining(['campaignId', 'operationId', 'typedItemOutcomes'])
    )
    expect(partialClosure.omittedClosureFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBody',
        'providerCredentials',
        'bulkSpreadsheetPayload',
      ])
    )
    expect(
      managedSecretBulkClosureReviewHasSecretMaterial(partialClosure)
    ).toBe(false)

    const partialHandoff = buildBulkSecretCampaignOperatorHandoff(
      applyResult,
      partialClosure
    )
    expect(partialHandoff).toMatchObject({
      campaignId: applyResult.campaignId,
      operationId: applyResult.operationId,
      outcome: 'partial_failure',
      lane: 'item-recovery',
      owner: 'broker operator',
      severity: 'warning',
      blockedReason: applyResult.nextAction,
    })
    expect(partialHandoff.shareableEvidenceRefs).toEqual(
      expect.arrayContaining([
        applyResult.campaignId,
        applyResult.operationId,
        applyResult.planToken,
        partialClosure.auditRefs[0],
        partialClosure.supportRefs[0],
        applyResult.items[0].operationItemId,
      ])
    )
    expect(partialHandoff.allowedHandoffFields).toEqual(
      expect.arrayContaining([
        'campaignId',
        'operationId',
        'itemOperationIds',
        'typedItemOutcomes',
        'supportEvidenceRefs',
      ])
    )
    expect(partialHandoff.omittedHandoffFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBody',
        'responseBody',
        'providerCredentials',
        'diagnosticPayloadsWithBodies',
        'bulkSpreadsheetPayload',
      ])
    )
    expect(
      managedSecretBulkOperatorHandoffHasSecretMaterial(partialHandoff)
    ).toBe(false)

    const partialOwnerTicket =
      buildBulkSecretCampaignOwnerActionTicket(partialHandoff)
    expect(partialOwnerTicket).toMatchObject({
      campaignId: applyResult.campaignId,
      operationId: applyResult.operationId,
      lane: 'item-recovery',
      owner: 'broker operator',
      severity: 'warning',
      freshPlanRequired: true,
      requiredAction:
        'review retry-safe item operation ids and retry only by operation id',
    })
    expect(partialOwnerTicket.allowedTicketFields).toEqual(
      expect.arrayContaining([
        'ticketId',
        'campaignId',
        'operationId',
        'itemOperationIds',
        'typedItemOutcomes',
      ])
    )
    expect(partialOwnerTicket.omittedTicketFields).toEqual(
      expect.arrayContaining([
        'rawValue',
        'requestBody',
        'responseBody',
        'providerCredentials',
        'environmentValues',
        'screenshotsWithVisibleValues',
        'bulkSpreadsheetPayload',
      ])
    )
    expect(
      managedSecretBulkOwnerActionTicketHasSecretMaterial(partialOwnerTicket)
    ).toBe(false)

    const retryablePartialPlan = buildBulkSecretCampaignPlan(
      managedSecretRows,
      [managedSecretRows[0].id, managedSecretRows[2].id],
      'update-edit'
    )
    const retryablePartialResult = buildBulkSecretCampaignApplyResult(
      retryablePartialPlan,
      'partial-failure'
    )
    const retryablePartialClosure = buildBulkSecretCampaignClosureReview(
      retryablePartialResult
    )
    expect(retryablePartialClosure).toMatchObject({
      outcome: 'partial_failure',
      reviewState: 'monitoring',
      canCloseCampaignReview: false,
    })
    expect(retryablePartialClosure.requiredBeforeClose).toEqual(
      expect.arrayContaining([
        'review retry-safe failed item operation ids',
        'retry only items marked retry safe and only by operation id',
      ])
    )
    expect(
      managedSecretBulkClosureReviewHasSecretMaterial(retryablePartialClosure)
    ).toBe(false)

    const successfulResult = buildBulkSecretCampaignApplyResult(
      cleanPlan,
      'success'
    )
    const successfulClosure =
      buildBulkSecretCampaignClosureReview(successfulResult)
    expect(successfulClosure).toMatchObject({
      outcome: 'applied',
      reviewState: 'closable',
      canCloseCampaignReview: true,
    })
    expect(successfulClosure.safeClosureRows).toEqual(
      expect.arrayContaining([
        'campaign review may close after audit acknowledgement and dependent service status review',
      ])
    )
    expect(
      managedSecretBulkClosureReviewHasSecretMaterial(successfulClosure)
    ).toBe(false)
    const successfulHandoff = buildBulkSecretCampaignOperatorHandoff(
      successfulResult,
      successfulClosure
    )
    const successfulOwnerTicket =
      buildBulkSecretCampaignOwnerActionTicket(successfulHandoff)
    expect(successfulHandoff).toMatchObject({
      outcome: 'applied',
      lane: 'settled',
      owner: 'operator',
      severity: 'info',
      blockedReason: null,
    })
    expect(successfulOwnerTicket).toMatchObject({
      lane: 'settled',
      freshPlanRequired: false,
      acknowledgementStatus:
        'acknowledge terminal campaign metadata before closing operator review',
    })
    expect(
      managedSecretBulkOperatorHandoffHasSecretMaterial(successfulHandoff)
    ).toBe(false)
    expect(
      managedSecretBulkOwnerActionTicketHasSecretMaterial(successfulOwnerTicket)
    ).toBe(false)

    const bulkPolicyDeniedResult = buildBulkSecretCampaignApplyResult(
      cleanPlan,
      'policy-denied'
    )
    expect(bulkPolicyDeniedResult.outcome).toBe('policy_denied')
    expect(bulkPolicyDeniedResult.appliedCount).toBe(0)
    expect(bulkPolicyDeniedResult.deniedCount).toBe(1)
    expect(bulkPolicyDeniedResult.auditStatus).toMatch(/policy denied/i)
    expect(bulkPolicyDeniedResult.nextAction).toMatch(
      /least-privilege policy approval/i
    )
    expect(bulkPolicyDeniedResult.items[0]).toMatchObject({
      outcome: 'denied',
      applied: false,
      retrySafe: false,
      auditStatus:
        'campaign audit recorded; policy denied and item mutation not applied',
      recovery:
        'mutation failed closed because broker policy denied this item after final revalidation',
      nextAction: 'request policy change or remove this ref from the campaign',
    })
    expect(
      managedSecretBulkApplyResultHasSecretMaterial(bulkPolicyDeniedResult)
    ).toBe(false)

    const bulkAuthRequiredResult = buildBulkSecretCampaignApplyResult(
      cleanPlan,
      'auth-required'
    )
    expect(bulkAuthRequiredResult.outcome).toBe('auth_required')
    expect(bulkAuthRequiredResult.appliedCount).toBe(0)
    expect(bulkAuthRequiredResult.authRequiredCount).toBe(1)
    expect(bulkAuthRequiredResult.auditStatus).toMatch(
      /provider reauthentication required/i
    )
    expect(bulkAuthRequiredResult.nextAction).toMatch(
      /complete provider reauthentication/i
    )
    expect(bulkAuthRequiredResult.items[0]).toMatchObject({
      outcome: 'auth-required',
      applied: false,
      retrySafe: false,
      auditStatus:
        'campaign audit recorded; provider auth required and item mutation not applied',
      recovery:
        'mutation failed closed because broker requires provider reauthentication',
      nextAction: 'complete provider auth then create a fresh plan',
    })
    expect(
      managedSecretBulkApplyResultHasSecretMaterial(bulkAuthRequiredResult)
    ).toBe(false)

    const bulkAuditUnavailableResult = buildBulkSecretCampaignApplyResult(
      cleanPlan,
      'audit-unavailable'
    )
    expect(bulkAuditUnavailableResult.outcome).toBe('audit_unavailable')
    expect(bulkAuditUnavailableResult.appliedCount).toBe(0)
    expect(bulkAuditUnavailableResult.auditUnavailableCount).toBe(1)
    expect(bulkAuditUnavailableResult.auditStatus).toMatch(/audit unavailable/i)
    expect(bulkAuditUnavailableResult.nextAction).toMatch(/restore audit sink/i)
    expect(bulkAuditUnavailableResult.items[0]).toMatchObject({
      outcome: 'audit-unavailable',
      applied: false,
      retrySafe: false,
      auditStatus: 'campaign audit unavailable; item mutation not applied',
      recovery:
        'mutation failed closed because item audit could not be persisted',
      nextAction:
        'restore audit persistence then create a fresh campaign preview',
    })
    expect(
      managedSecretBulkApplyResultHasSecretMaterial(bulkAuditUnavailableResult)
    ).toBe(false)
    const auditUnavailableClosure = buildBulkSecretCampaignClosureReview(
      bulkAuditUnavailableResult
    )
    const auditUnavailableHandoff = buildBulkSecretCampaignOperatorHandoff(
      bulkAuditUnavailableResult,
      auditUnavailableClosure
    )
    expect(auditUnavailableHandoff).toMatchObject({
      lane: 'audit-recovery',
      owner: 'audit operator',
      severity: 'critical',
      requiredAction:
        'restore audit persistence before creating a fresh campaign preview',
    })
    expect(
      managedSecretBulkOperatorHandoffHasSecretMaterial(auditUnavailableHandoff)
    ).toBe(false)

    const bulkProviderUnavailableResult = buildBulkSecretCampaignApplyResult(
      cleanPlan,
      'provider-unavailable'
    )
    expect(bulkProviderUnavailableResult.outcome).toBe('provider_unavailable')
    expect(bulkProviderUnavailableResult.appliedCount).toBe(0)
    expect(bulkProviderUnavailableResult.providerUnavailableCount).toBe(1)
    expect(bulkProviderUnavailableResult.auditStatus).toMatch(
      /provider connector unavailable/i
    )
    expect(bulkProviderUnavailableResult.nextAction).toMatch(
      /restore provider connectivity/i
    )
    expect(bulkProviderUnavailableResult.items[0]).toMatchObject({
      outcome: 'provider-unavailable',
      applied: false,
      retrySafe: false,
      auditStatus:
        'campaign audit recorded; provider unavailable and item mutation not applied',
      recovery:
        'mutation failed closed because provider connector was unavailable',
      nextAction:
        'restore provider connectivity then create a fresh campaign preview',
    })
    expect(
      managedSecretBulkApplyResultHasSecretMaterial(
        bulkProviderUnavailableResult
      )
    ).toBe(false)

    const policyPlan = buildBulkSecretCampaignPlan(
      managedSecretRows,
      managedSecretRows.map((row) => row.id),
      'apply-policy'
    )
    expect(policyPlan.applyAvailable).toBe(true)
    expect(policyPlan.applicableCount).toBe(1)
    expect(policyPlan.unsupportedCount).toBe(2)
    expect(policyPlan.deniedCount).toBe(1)
    expect(policyPlan.planToken).toMatch(/apply_policy/)
    expect(policyPlan.items[0].targetPolicy).toMatch(/bulk-campaign-apply/)
    expect(managedSecretBulkPlanHasSecretMaterial(policyPlan)).toBe(false)

    const migrationPlan = buildBulkSecretCampaignPlan(
      managedSecretRows,
      managedSecretRows.map((row) => row.id),
      'migrate-provider'
    )
    expect(migrationPlan.applyAvailable).toBe(true)
    expect(migrationPlan.applicableCount).toBe(1)
    expect(migrationPlan.unsupportedCount).toBe(1)
    expect(migrationPlan.authRequiredCount).toBe(1)
    expect(migrationPlan.missingProviderCount).toBe(1)
    expect(migrationPlan.deniedCount).toBe(1)
    expect(migrationPlan.items[0].targetProvider).toBe('vault-prod')
    expect(migrationPlan.items[1].targetProvider).toBe('local-default')
    expect(managedSecretBulkPlanHasSecretMaterial(migrationPlan)).toBe(false)

    const migrationResult = buildBulkSecretCampaignApplyResult(
      migrationPlan,
      'partial-failure'
    )
    expect(migrationResult.outcome).toBe('partial_failure')
    expect(migrationResult.appliedCount).toBe(1)
    expect(migrationResult.unsupportedCount).toBe(1)
    expect(migrationResult.authRequiredCount).toBe(1)
    expect(migrationResult.deniedCount).toBe(1)
    expect(managedSecretBulkApplyResultHasSecretMaterial(migrationResult)).toBe(
      false
    )
  })
})
