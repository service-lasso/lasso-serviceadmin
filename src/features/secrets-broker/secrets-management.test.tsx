import { renderRoute } from '@/test/render-route'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  buildBulkSecretCampaignPlan,
  buildBulkSecretCampaignApplyGate,
  buildBulkSecretCampaignApplyResult,
  buildManagedSecretActionReadiness,
  buildSingleSecretDecommissionPreview,
  buildSingleSecretOperationAuditTrail,
  buildSingleSecretOperationHistoryEntry,
  buildSingleSecretPolicyPreview,
  buildSingleSecretRevealPreview,
  buildSingleSecretOperationResult,
  buildSingleSecretOperationPlan,
  buildSingleSecretStatusMonitor,
  buildSingleSecretSubmitEnvelope,
  buildStubSecretMutationPreview,
  filterManagedSecrets,
  managedSecretBulkApplyResultHasSecretMaterial,
  managedSecretBulkPlanHasSecretMaterial,
  managedSecretActionReadinessHasSecretMaterial,
  managedSecretDecommissionPreviewHasSecretMaterial,
  managedSecretPolicyPreviewHasSecretMaterial,
  managedSecretRevealPreviewHasSecretMaterial,
  managedSecretSingleAuditTrailHasSecretMaterial,
  managedSecretStatusMonitorHasSecretMaterial,
  managedSecretSubmitEnvelopeHasSecretMaterial,
  managedSecretRows,
  managedSecretSafeSurfacesIncludeSecretMaterial,
  managedSecretSingleHistoryHasSecretMaterial,
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
    expect(screen.getByText(/Preview actions/i)).toBeVisible()
    expect(screen.getAllByText(/^5$/)[0]).toBeVisible()
    expect(screen.getByText(/Visible values/i)).toBeVisible()
    expect(screen.getByText(/Stub preview · values hidden/i)).toBeVisible()
    expect(screen.getByText(/Single-secret preview gate/i)).toBeVisible()
    expect(screen.getAllByText(/Stub API · preview only/i)[0]).toBeVisible()
    expect(screen.getByText(/Single-secret operation history/i)).toBeVisible()
    expect(screen.getByText(/0 submitted/i)).toBeVisible()
    expect(
      screen.getAllByText(/Readiness: 5 ready \/ 0 blocked/i)[0]
    ).toBeVisible()
    expect(screen.getAllByText(/Reveal: preview ready/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Delete: preview ready/i)[0]).toBeVisible()
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
      screen.getAllByText(
        /GET \/v1\/management\/secrets\/\{ref\}\/metadata/i
      )[0]
    ).toBeVisible()
    expect(screen.getByText(/Metadata-only submit envelope/i)).toBeVisible()
    expect(screen.getByText(/Submit blocked/i)).toBeVisible()
    expect(screen.getByText(/No raw payload/i)).toBeVisible()
    expect(screen.getByText(/Omitted unsafe fields/i)).toBeVisible()
    expect(
      screen.getByText(/no local storage or session storage/i)
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
    expect(screen.getByText(/Readiness: 0 ready \/ 5 blocked/i)).toBeVisible()
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
    expect(
      screen.getByText(/Controlled reveal challenge preview/i)
    ).toBeVisible()
    expect(screen.getByText(/reveal challenge blocked/i)).toBeVisible()
    expect(
      screen.getByText(
        /challenge-reveal-serviceadmin-session-signing-metadata/i
      )
    ).toBeVisible()
    expect(
      screen.getByText(/audit-reveal-serviceadmin-session-signing-preview/i)
    ).toBeVisible()
    expect(
      screen.getByText(/no reveal window is opened while blocked/i)
    ).toBeVisible()
    expect(
      screen.getByText(/value stays hidden until the broker returns/i)
    ).toBeVisible()
    expect(
      screen.getByText(
        /raw secret value is not fetched during preview generation/i
      )
    ).toBeVisible()

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
      screen.getAllByText(
        /POST \/v1\/management\/secrets\/\{ref\}\/rotate:dry-run/i
      )[0]
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
    expect(screen.getByText(/Single-secret operation history/i)).toBeVisible()
    expect(screen.getByText(/1 submitted/i)).toBeVisible()
    expect(screen.getByText(/Operation audit timeline/i)).toBeVisible()
    expect(screen.getByText(/Dry-run preview recorded/i)).toBeVisible()
    expect(screen.getByText(/Apply gate evaluated/i)).toBeVisible()
    expect(screen.getByText(/Broker status callback/i)).toBeVisible()
    expect(screen.getByText(/Audit sink retention/i)).toBeVisible()
    expect(screen.getByText(/serviceadmin-ui/i)).toBeVisible()
    expect(screen.getAllByText(/@secretsbroker/i)[0]).toBeVisible()
    expect(
      screen.getByText(/callback evidence stores typed outcome/i)
    ).toBeVisible()
    expect(screen.getAllByText(/audit-reset-serviceadmin/i)[0]).toBeVisible()
    expect(screen.getAllByText(/submitted to broker/i)[0]).toBeVisible()
    expect(screen.getByText(/raw value was not revealed/i)).toBeVisible()
    expect(
      screen.getByText(/rotation can be requested without controlled reveal/i)
    ).toBeVisible()
    expect(screen.getAllByText(/Audit event/i)[0]).toBeVisible()
    expect(
      screen.getAllByText(
        /audit-reset-serviceadmin-session-signing-preview/i
      )[0]
    ).toBeVisible()
    expect(
      screen.getAllByText(
        /corr-reset-serviceadmin-session-signing-submitted/i
      )[0]
    ).toBeVisible()
    expect(
      screen.getAllByText(/recorded and waiting for broker terminal status/i)[0]
    ).toBeVisible()
    expect(
      screen.getByText(/allowlisted fields only: ref, action/i)
    ).toBeVisible()
    expect(
      screen.getAllByText(/dependent service restart remains pending/i)[0]
    ).toBeVisible()
    expect(
      screen.getAllByText(/rotation retry is operation-id scoped/i)[0]
    ).toBeVisible()
    expect(screen.getAllByText(/retry only by operation id/i)[0]).toBeVisible()
    expect(
      screen.getByText(/track rotation operation id until provider status/i)
    ).toBeVisible()

    await user.selectOptions(screen.getByLabelText(/Result status/i), 'applied')
    await user.selectOptions(screen.getByLabelText(/Stub API state/i), 'ready')
    await user.click(
      screen.getByRole('button', { name: /Simulate stub apply/i })
    )
    expect(
      screen.getByText(/Single-secret operation result: applied/i)
    ).toBeVisible()
    expect(screen.getAllByText(/broker applied/i)[0]).toBeVisible()
    expect(
      screen.getAllByText(/operation settled with broker success metadata/i)[0]
    ).toBeVisible()
    expect(
      screen.getAllByText(/no retry needed after broker success/i)[0]
    ).toBeVisible()
    expect(screen.getByText(/2 submitted/i)).toBeVisible()

    await user.click(
      screen.getAllByRole('button', { name: /Delete dry-run/i })[0]
    )
    expect(
      screen.getByText(/Delete dry-run for SESSION_SIGNING_KEY/i)
    ).toBeVisible()
    expect(
      screen.getByText(/delete preview required before apply/i)
    ).toBeVisible()
    expect(screen.getAllByText(/recovery guidance/i)[0]).toBeVisible()
    expect(screen.getByText(/dependent service references/i)).toBeVisible()
    expect(screen.getAllByText(/recoveryPlanRef/i)[0]).toBeVisible()
    expect(
      screen.getByText(/Delete\/decommission safety preview/i)
    ).toBeVisible()
    expect(screen.getByText(/decommission preview ready/i)).toBeVisible()
    expect(
      screen.getByText(/recovery-delete-serviceadmin-session-signing-metadata/i)
    ).toBeVisible()
    expect(
      screen.getByText(
        /tombstone-delete-serviceadmin-session-signing-metadata/i
      )
    ).toBeVisible()
    expect(
      screen.getByText(/@serviceadmin runtime session loader/i)
    ).toBeVisible()
    expect(screen.getByText(/current secret value is not read/i)).toBeVisible()

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
      screen.getAllByText(/target policy assignment diff checked/i)[0]
    ).toBeVisible()
    expect(
      screen.getAllByText('targetPolicyRef', { exact: true })[0]
    ).toBeVisible()
    expect(screen.getByText(/Policy assignment safety preview/i)).toBeVisible()
    expect(screen.getByText(/policy preview ready/i)).toBeVisible()
    expect(
      screen.getByText(
        'policy/openclaw/service-lasso/serviceadmin/least-privilege-single-ref',
        { exact: true }
      )
    ).toBeVisible()
    expect(
      screen.getByText(/rollback-policy-serviceadmin-session-signing-metadata/i)
    ).toBeVisible()
    expect(screen.getByText(/@serviceadmin operator API/i)).toBeVisible()
    expect(
      screen.getByText(
        /policy preview never reads or writes the current secret value/i
      )
    ).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: /Apply disabled until dry-run preview is accepted/i,
      })
    ).toBeDisabled()

    await user.type(
      screen.getByPlaceholderText(/Search secret metadata/i),
      'payments'
    )
    await user.click(screen.getByRole('button', { name: /Delete dry-run/i }))
    expect(screen.getByText(/Selected action readiness/i)).toBeVisible()
    expect(screen.getAllByText(/blocked fail closed/i)[0]).toBeVisible()
    expect(screen.getAllByText(/ref unavailable/i)[0]).toBeVisible()
    expect(screen.getAllByText(/delete dry-run unsupported/i)[0]).toBeVisible()
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

    await user.selectOptions(
      screen.getByLabelText(/Result status/i),
      'policy-denied'
    )
    await user.selectOptions(screen.getByLabelText(/Stub API state/i), 'ready')
    await user.click(
      screen.getByRole('button', { name: /Simulate stub apply/i })
    )
    expect(
      screen.getByText(/Single-secret operation result: policy-denied/i)
    ).toBeVisible()
    expect(screen.getAllByText(/policy denied/i)[0]).toBeVisible()
    expect(screen.getByText(/no value was read or written/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Result status/i),
      'provider-unavailable'
    )
    await user.selectOptions(screen.getByLabelText(/Stub API state/i), 'ready')
    await user.click(
      screen.getByRole('button', { name: /Simulate stub apply/i })
    )
    expect(
      screen.getByText(/Single-secret operation result: provider-unavailable/i)
    ).toBeVisible()
    expect(screen.getAllByText(/provider unavailable/i)[0]).toBeVisible()
    expect(
      screen.getByText(/provider connector is unavailable or unsupported/i)
    ).toBeVisible()
    expect(
      screen.getAllByText(/terminal provider unavailable/i)[0]
    ).toBeVisible()
    expect(screen.getAllByText(/provider outage/i)[0]).toBeVisible()
    expect(screen.getByText(/connector status metadata only/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Result status/i),
      'stale-plan'
    )
    await user.selectOptions(screen.getByLabelText(/Stub API state/i), 'ready')
    await user.click(
      screen.getByRole('button', { name: /Simulate stub apply/i })
    )
    expect(
      screen.getByText(/Single-secret operation result: stale-plan/i)
    ).toBeVisible()
    expect(screen.getAllByText(/stale plan/i)[0]).toBeVisible()
    expect(
      screen.getByText(/dry-run plan token expired before final broker/i)
    ).toBeVisible()
    expect(screen.getByText(/stale preview: broker rejected/i)).toBeVisible()
    expect(
      screen.getByText(/stale-plan recovery creates a new dry-run/i)
    ).toBeVisible()

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
