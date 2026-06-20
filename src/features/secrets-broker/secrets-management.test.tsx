import { renderRoute } from '@/test/render-route'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  buildBulkSecretCampaignPlan,
  buildBulkSecretCampaignApplyGate,
  buildBulkSecretCampaignApplyResult,
  buildSingleSecretOperationResult,
  buildSingleSecretOperationPlan,
  buildStubSecretMutationPreview,
  filterManagedSecrets,
  managedSecretBulkApplyResultHasSecretMaterial,
  managedSecretBulkPlanHasSecretMaterial,
  managedSecretRows,
  managedSecretSafeSurfacesIncludeSecretMaterial,
  managedSecretsHaveSecretMaterial,
  valueSearchManagedSecrets,
} from './secrets-management'

describe('Secrets Broker secrets management page', () => {
  it('hides stub previews and fixture rows when stub mode is disabled', async () => {
    await renderRoute('/secrets-broker/secrets', { stubData: false })

    expect(
      await screen.findByRole('heading', { name: /^Secrets$/i })
    ).toBeVisible()
    expect(screen.getByText(/Secrets Broker API unavailable/i)).toBeVisible()
    expect(screen.getByText(/No fixture rows/i)).toBeVisible()
    expect(
      screen.queryByText(/Single-secret preview gate/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/SESSION_SIGNING_KEY/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Simulate stub apply/i })
    ).not.toBeInTheDocument()
  })

  it('renders the Secrets sub-page table with metadata rows and no raw values', async () => {
    await renderRoute('/secrets-broker/secrets')

    expect(
      await screen.findByRole('heading', { name: /^Secrets$/i })
    ).toBeVisible()
    expect(
      screen.getByText(/Search refs, review provider state/i)
    ).toBeVisible()
    expect(screen.getByText(/Operator queue/i)).toBeVisible()
    expect(screen.getByText(/Find a ref/i)).toBeVisible()
    expect(screen.getByText(/Pick row action/i)).toBeVisible()
    expect(screen.getByText(/Dry-run before apply/i)).toBeVisible()
    expect(screen.getByText(/Visible values/i)).toBeVisible()
    expect(screen.getByText(/Stub preview · values hidden/i)).toBeVisible()
    expect(screen.getByText(/Single-secret preview gate/i)).toBeVisible()
    expect(screen.getAllByText(/Stub API · preview only/i)[0]).toBeVisible()
    expect(screen.getAllByText(/SESSION_SIGNING_KEY/i)[0]).toBeVisible()
    expect(screen.getByText(/ZITADEL_CLIENT_CREDENTIAL/i)).toBeVisible()
    expect(screen.getAllByText(/Controlled reveal/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Edit\/update dry-run/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Reset\/rotate dry-run/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Delete dry-run/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Apply policy preview/i)[0]).toBeVisible()
    expect(screen.getByText(/Broker operation contract/i)).toBeVisible()
    expect(screen.getByText(/single-metadata/i)).toBeVisible()
    expect(
      screen.getByText(/GET \/v1\/management\/secrets\/\{ref\}\/metadata/i)
    ).toBeVisible()
    expect(screen.getAllByText(/Raw values hidden/i)[0]).toBeVisible()
    expect(screen.getByText(/No bulk mutation/i)).toBeVisible()
    expect(screen.queryByText(/DEMO_REVEAL_VALUE_42/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Copy secret/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Controlled management surface/i)).toBeNull()
    expect(screen.queryByText(/^Safety boundaries$/i)).toBeNull()
  })

  it('keeps first-screen controls task-oriented before any long prose', async () => {
    await renderRoute('/secrets-broker/secrets')

    expect(
      await screen.findByRole('heading', { name: /^Secrets$/i })
    ).toBeVisible()
    expect(screen.getByText(/Operator queue/i)).toBeVisible()
    expect(screen.getByPlaceholderText(/Search secret metadata/i)).toBeVisible()
    expect(
      screen.getAllByRole('button', { name: /Controlled reveal/i })[0]
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Generate bulk dry-run plan/i })
    ).toBeVisible()
    expect(screen.queryByText(/Controlled management surface/i)).toBeNull()
    expect(screen.queryByText(/^Safety boundaries$/i)).toBeNull()
  })

  it('filters metadata locally without value search or plaintext indexing', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/secrets')

    await user.type(
      screen.getByPlaceholderText(/Search secret metadata/i),
      'payments'
    )
    expect(screen.getByText(/PAYMENTS_SIGNING_REF/i)).toBeVisible()
    expect(screen.getByText(/Metadata matches: 1/i)).toBeVisible()
    expect(screen.queryByText(/DEMO_REVEAL_VALUE_42/i)).not.toBeInTheDocument()
  })

  it('shows broker-backed value search supported and unsupported states without raw values', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/secrets')

    await user.type(
      screen.getByLabelText(/Broker-backed value search/i),
      'session'
    )
    expect(screen.getByText(/Value search unsupported/i)).toBeVisible()
    expect(screen.queryByText(/DEMO_REVEAL_VALUE_42/i)).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /Simulate supported value search/i })
    )
    expect(
      screen.getByText(/Value search supported: 1 safe ref metadata match/i)
    ).toBeVisible()
    expect(screen.queryByText(/DEMO_REVEAL_VALUE_42/i)).not.toBeInTheDocument()
  })

  it('generates a non-mutating bulk dry-run plan for selected refs', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/secrets')

    expect(screen.getByText(/Bulk campaign dry-run planner/i)).toBeVisible()
    expect(screen.getByText(/2 refs selected/i)).toBeVisible()

    await user.click(
      screen.getByLabelText(/Select NODE_REGISTRY_AUTH for bulk dry-run/i)
    )
    await user.click(
      screen.getByLabelText(/Select PAYMENTS_SIGNING_REF for bulk dry-run/i)
    )
    await user.click(
      screen.getByRole('button', { name: /Generate bulk dry-run plan/i })
    )

    expect(screen.getByText(/supported: metadata dry-run only/i)).toBeVisible()
    expect(
      screen.getByText(/auth required: provider challenge before dry-run/i)
    ).toBeVisible()
    expect(
      screen.getByText(/unsupported: reset dry-run unavailable/i)
    ).toBeVisible()
    expect(screen.getByText('missing provider/source')).toBeVisible()
    expect(
      screen.getByText(/denied: policy is readonly for this ref/i)
    ).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: /Apply bulk campaign/i,
      })
    ).toBeDisabled()
    expect(
      screen.getByText(/Campaign confirmation and revalidation/i)
    ).toBeVisible()
    expect(screen.getAllByText(/provider auth required/i)[0]).toBeVisible()
    expect(screen.queryByText(/DEMO_REVEAL_VALUE_42/i)).not.toBeInTheDocument()
  })

  it('applies a broker-backed bulk campaign after audit reason confirmation and fresh revalidation pass', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/secrets')

    await user.click(
      screen.getByLabelText(
        /Select ZITADEL_CLIENT_CREDENTIAL for bulk dry-run/i
      )
    )
    await user.click(
      screen.getByRole('button', { name: /Generate bulk dry-run plan/i })
    )

    expect(screen.getByText(/Revalidation blocked/i)).toBeVisible()
    expect(screen.getByText(/audit reason missing/i)).toBeVisible()
    expect(screen.getByText(/high-risk confirmation missing/i)).toBeVisible()
    expect(screen.getByText(/revalidation not run/i)).toBeVisible()
    expect(
      screen.getAllByText(/broker campaign API available/i)[0]
    ).toBeVisible()

    await user.type(
      screen.getByLabelText(/Campaign audit reason/i),
      'operator requested controlled campaign rotation'
    )
    await user.type(
      screen.getByLabelText(/Explicit confirmation/i),
      'CONFIRM HIGH RISK CAMPAIGN'
    )
    await user.click(
      screen.getByRole('button', { name: /Revalidate dry-run/i })
    )

    expect(screen.getAllByText(/Revalidated/i)[0]).toBeVisible()
    expect(screen.getByText(/audit reason recorded/i)).toBeVisible()
    expect(screen.getByText(/confirmation accepted/i)).toBeVisible()
    expect(screen.getByText(/revalidation passed/i)).toBeVisible()
    expect(
      screen.getAllByText(/broker campaign API available/i)[0]
    ).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: /Apply bulk campaign/i,
      })
    ).toBeEnabled()

    await user.click(
      screen.getByRole('button', { name: /Apply bulk campaign/i })
    )
    expect(screen.getByText(/Campaign apply result: applied/i)).toBeVisible()
    expect(screen.getAllByText(/Applied 1/i)[0]).toBeVisible()
    expect(screen.getByText(/campaign and item audit recorded/i)).toBeVisible()
    expect(screen.getAllByText(/retry by operation id/i)[0]).toBeVisible()
    expect(screen.queryByText(/DEMO_REVEAL_VALUE_42/i)).not.toBeInTheDocument()
  })

  it('shows partial failure and retry-safe per-item operation metadata', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/secrets')

    await user.selectOptions(screen.getByLabelText(/Campaign operation/i), [
      'update-edit',
    ])
    await user.click(
      screen.getByLabelText(
        /Select ZITADEL_CLIENT_CREDENTIAL for bulk dry-run/i
      )
    )
    await user.click(
      screen.getByLabelText(/Select NODE_REGISTRY_AUTH for bulk dry-run/i)
    )
    await user.click(
      screen.getByRole('button', { name: /Generate bulk dry-run plan/i })
    )
    await user.type(
      screen.getByLabelText(/Campaign audit reason/i),
      'operator requested controlled campaign update'
    )
    await user.type(
      screen.getByLabelText(/Explicit confirmation/i),
      'CONFIRM HIGH RISK CAMPAIGN'
    )
    await user.selectOptions(
      screen.getByLabelText(/Apply result mode/i),
      'partial-failure'
    )
    await user.click(
      screen.getByRole('button', { name: /Revalidate dry-run/i })
    )
    await user.click(
      screen.getByRole('button', { name: /Apply bulk campaign/i })
    )

    expect(
      screen.getByText(/Campaign apply result: partial_failure/i)
    ).toBeVisible()
    expect(screen.getAllByText(/Applied 1/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Failed 1/i)[0]).toBeVisible()
    expect(
      screen.getAllByText(/retry with the same idempotency key/i)[0]
    ).toBeVisible()
    expect(screen.getAllByText(/campaign-update-edit/i)[0]).toBeVisible()
    expect(screen.queryByText(/DEMO_REVEAL_VALUE_42/i)).not.toBeInTheDocument()
  })

  it('applies a bulk policy campaign through the same confirmation and revalidation gate', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/secrets')

    await user.selectOptions(screen.getByLabelText(/Campaign operation/i), [
      'apply-policy',
    ])
    await user.click(
      screen.getByLabelText(
        /Select ZITADEL_CLIENT_CREDENTIAL for bulk dry-run/i
      )
    )
    await user.click(
      screen.getByRole('button', { name: /Generate bulk dry-run plan/i })
    )

    expect(
      screen.getByText(/supported: policy dry-run and apply available/i)
    ).toBeVisible()
    expect(screen.getByText(/bulk-campaign-apply/i)).toBeVisible()
    expect(
      screen.getAllByText(/broker campaign API available/i)[0]
    ).toBeVisible()

    await user.type(
      screen.getByLabelText(/Campaign audit reason/i),
      'operator requested least privilege policy campaign'
    )
    await user.type(
      screen.getByLabelText(/Explicit confirmation/i),
      'CONFIRM HIGH RISK CAMPAIGN'
    )
    await user.click(
      screen.getByRole('button', { name: /Revalidate dry-run/i })
    )
    await user.click(
      screen.getByRole('button', { name: /Apply bulk campaign/i })
    )

    expect(screen.getByText(/Campaign apply result: applied/i)).toBeVisible()
    expect(screen.getAllByText(/campaign-apply-policy/i)[0]).toBeVisible()
    expect(
      screen.getByText(
        /reapply the previous policy through a fresh audited campaign/i
      )
    ).toBeVisible()
    expect(screen.queryByText(/DEMO_REVEAL_VALUE_42/i)).not.toBeInTheDocument()
  })

  it('plans and applies provider migration campaigns with typed partial outcomes', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/secrets')

    await user.selectOptions(screen.getByLabelText(/Campaign operation/i), [
      'migrate-provider',
    ])
    await user.click(
      screen.getByLabelText(/Select NODE_REGISTRY_AUTH for bulk dry-run/i)
    )
    await user.click(
      screen.getByLabelText(/Select PAYMENTS_SIGNING_REF for bulk dry-run/i)
    )
    await user.click(
      screen.getByRole('button', { name: /Generate bulk dry-run plan/i })
    )

    expect(
      screen.getByText(/provider migration\/remap dry-run and apply available/i)
    ).toBeVisible()
    expect(
      screen.getByText(
        /auth required: source provider challenge before migration apply/i
      )
    ).toBeVisible()
    expect(
      screen.getByText(/unsupported: file sources migrate outside broker/i)
    ).toBeVisible()
    expect(screen.getByText('missing provider/source')).toBeVisible()
    expect(
      screen.getAllByText(/broker campaign API available/i)[0]
    ).toBeVisible()

    await user.type(
      screen.getByLabelText(/Campaign audit reason/i),
      'operator requested provider migration campaign'
    )
    await user.type(
      screen.getByLabelText(/Explicit confirmation/i),
      'CONFIRM HIGH RISK CAMPAIGN'
    )
    await user.selectOptions(
      screen.getByLabelText(/Apply result mode/i),
      'partial-failure'
    )
    await user.click(
      screen.getByRole('button', { name: /Revalidate dry-run/i })
    )
    await user.click(
      screen.getByRole('button', { name: /Apply bulk campaign/i })
    )

    expect(
      screen.getByText(/Campaign apply result: partial_failure/i)
    ).toBeVisible()
    expect(screen.getAllByText(/Applied 1/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Unsupported 1/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Auth 1/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Denied 1/i)[0]).toBeVisible()
    expect(screen.getAllByText(/campaign-migrate-provider/i)[0]).toBeVisible()
    expect(
      screen.getByText(
        /use source provider as rollback target where supported/i
      )
    ).toBeVisible()
    expect(screen.queryByText(/DEMO_REVEAL_VALUE_42/i)).not.toBeInTheDocument()
  })

  it('covers retryable non-retryable and stale apply result states', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/secrets')

    await user.click(
      screen.getByLabelText(
        /Select ZITADEL_CLIENT_CREDENTIAL for bulk dry-run/i
      )
    )
    await user.click(
      screen.getByRole('button', { name: /Generate bulk dry-run plan/i })
    )
    await user.type(
      screen.getByLabelText(/Campaign audit reason/i),
      'operator requested controlled campaign rotation'
    )
    await user.type(
      screen.getByLabelText(/Explicit confirmation/i),
      'CONFIRM HIGH RISK CAMPAIGN'
    )
    await user.click(
      screen.getByRole('button', { name: /Revalidate dry-run/i })
    )

    await user.selectOptions(
      screen.getByLabelText(/Apply result mode/i),
      'retryable-failure'
    )
    await user.click(
      screen.getByRole('button', { name: /Apply bulk campaign/i })
    )
    expect(screen.getByText(/Campaign apply result: failed/i)).toBeVisible()
    expect(screen.getAllByText(/retry by operation id/i)[0]).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Apply result mode/i),
      'non-retryable-failure'
    )
    await user.click(
      screen.getByRole('button', { name: /Apply bulk campaign/i })
    )
    expect(
      screen.getByText(/manual recovery required; do not replay/i)
    ).toBeVisible()
    expect(screen.getAllByText(/fresh plan required/i)[0]).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Apply result mode/i),
      'stale-plan'
    )
    await user.click(
      screen.getByRole('button', { name: /Apply bulk campaign/i })
    )
    expect(screen.getByText(/Campaign apply result: stale_plan/i)).toBeVisible()
    expect(screen.getAllByText(/create a fresh dry-run plan/i)[0]).toBeVisible()
  })

  it('shows stale plan and revalidation failure states before bulk apply', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/secrets')

    await user.click(
      screen.getByLabelText(
        /Select ZITADEL_CLIENT_CREDENTIAL for bulk dry-run/i
      )
    )
    await user.click(
      screen.getByRole('button', { name: /Generate bulk dry-run plan/i })
    )
    await user.type(
      screen.getByLabelText(/Campaign audit reason/i),
      'operator requested controlled campaign rotation'
    )
    await user.type(
      screen.getByLabelText(/Explicit confirmation/i),
      'CONFIRM HIGH RISK CAMPAIGN'
    )

    await user.selectOptions(
      screen.getByLabelText(/Revalidation outcome/i),
      'stale-plan'
    )
    await user.click(
      screen.getByRole('button', { name: /Revalidate dry-run/i })
    )
    expect(screen.getAllByText(/stale plan/i)[0]).toBeVisible()
    expect(screen.getAllByText(/revalidation blocked/i)[0]).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Revalidation outcome/i),
      'auth-required'
    )
    await user.click(
      screen.getByRole('button', { name: /Revalidate dry-run/i })
    )
    expect(
      screen.getAllByText(
        /provider auth required before revalidation can pass/i
      )[0]
    ).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Revalidation outcome/i),
      'audit-unavailable'
    )
    await user.click(
      screen.getByRole('button', { name: /Revalidate dry-run/i })
    )
    expect(
      screen.getAllByText(/audit unavailable; campaign apply fails closed/i)[0]
    ).toBeVisible()
  })

  it('previews reveal edit reset delete and policy actions behind dry-run or confirmation gates', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/secrets')

    await user.click(
      screen.getAllByRole('button', { name: /Controlled reveal/i })[0]
    )
    expect(
      screen.getByText(/Controlled reveal for SESSION_SIGNING_KEY/i)
    ).toBeVisible()
    expect(
      screen.getByText(/ready for controlled reveal handoff/i)
    ).toBeVisible()
    expect(screen.getByText(/Uses the #38 reveal pattern/i)).toBeVisible()

    await user.click(
      screen.getAllByRole('button', { name: /Edit\/update dry-run/i })[0]
    )
    expect(
      screen.getByText(/Edit\/update dry-run for SESSION_SIGNING_KEY/i)
    ).toBeVisible()
    expect(
      screen.getAllByText(/dry-run required before apply/i)[0]
    ).toBeVisible()

    await user.click(
      screen.getAllByRole('button', { name: /Reset\/rotate dry-run/i })[0]
    )
    expect(
      screen.getByText(/Reset\/rotate dry-run for SESSION_SIGNING_KEY/i)
    ).toBeVisible()
    expect(
      screen.getByText(/rotation preview required before apply/i)
    ).toBeVisible()
    expect(
      screen.getByText(
        /POST \/v1\/management\/secrets\/\{ref\}\/rotate:dry-run/i
      )
    ).toBeVisible()
    expect(screen.getByText(/reset dry-run capability checked/i)).toBeVisible()
    await user.type(
      screen.getByLabelText(/Audit reason for stub preview/i),
      'operator requested rotation preview'
    )
    await user.click(screen.getByLabelText(/I confirm this is a stub preview/i))
    await user.click(
      screen.getByRole('button', { name: /Simulate stub apply/i })
    )
    expect(
      screen.getByText(/Single-secret operation result: submitted/i)
    ).toBeVisible()
    expect(screen.getByText(/raw value was not revealed/i)).toBeVisible()
    expect(
      screen.getByText(/rotation can be requested without controlled reveal/i)
    ).toBeVisible()

    await user.click(
      screen.getAllByRole('button', { name: /Delete dry-run/i })[0]
    )
    expect(
      screen.getByText(/Delete dry-run for SESSION_SIGNING_KEY/i)
    ).toBeVisible()
    expect(
      screen.getByText(/delete preview required before apply/i)
    ).toBeVisible()
    expect(screen.getByText(/recovery guidance/i)).toBeVisible()

    await user.click(
      screen.getAllByRole('button', { name: /Apply policy preview/i })[0]
    )
    expect(
      screen.getByText(/Policy preview for SESSION_SIGNING_KEY/i)
    ).toBeVisible()
    expect(
      screen.getAllByText(/policy preview required before apply/i)[0]
    ).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: /Apply disabled until dry-run preview is accepted/i,
      })
    ).toBeDisabled()
  })

  it('covers stub update reset delete reveal preview states and gated apply readiness', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/secrets')

    expect(screen.getByText(/Single-secret preview gate/i)).toBeVisible()
    expect(screen.getAllByText(/audit reason required/i)[0]).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Simulate stub apply/i })
    ).toBeDisabled()

    await user.type(
      screen.getByLabelText(/Audit reason for stub preview/i),
      'operator requested rotation preview'
    )
    await user.click(screen.getByLabelText(/I confirm this is a stub preview/i))
    expect(screen.getByText(/Stub apply can be simulated/i)).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Simulate stub apply/i })
    ).toBeEnabled()

    await user.selectOptions(screen.getByLabelText(/Stub API state/i), 'denied')
    expect(screen.getAllByText(/Policy denied/i)[0]).toBeVisible()
    expect(
      screen.getByText(/operator lacks single-secret mutation entitlement/i)
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Simulate stub apply/i })
    ).toBeDisabled()

    await user.selectOptions(
      screen.getByLabelText(/Stub API state/i),
      'auth-required'
    )
    expect(screen.getAllByText(/Auth required/i)[0]).toBeVisible()
    expect(screen.getByText(/fresh operator authentication/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Stub API state/i),
      'unavailable'
    )
    expect(screen.getAllByText(/Broker unavailable/i)[0]).toBeVisible()
    expect(screen.getByText(/failed closed/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Stub API state/i),
      'success'
    )
    expect(screen.getAllByText(/Stub apply success/i)[0]).toBeVisible()
    expect(
      screen.getByText(/deterministic fake apply completed/i)
    ).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Stub API state/i),
      'failure'
    )
    expect(screen.getAllByText(/Stub apply failure/i)[0]).toBeVisible()
    expect(screen.getByText(/deterministic fake apply failed/i)).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: /Cancel stub preview/i })
    )
    expect(screen.getAllByText(/Cancelled/i)[0]).toBeVisible()
    expect(screen.getByText(/cancelled by operator/i)).toBeVisible()
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
    expect(rotatePlan.safePayloadFields).toEqual(
      expect.arrayContaining(['ref', 'operationId', 'auditReasonMetadata'])
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
      auditStatus: 'stub audit event recorded with metadata only',
      nextAction:
        'monitor broker rotation outcome and dependent service restart notes',
    })
    expect(rotateResult.safetyRows).toEqual(
      expect.arrayContaining([
        'raw value was not revealed',
        'rotation can be requested without controlled reveal',
      ])
    )

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
