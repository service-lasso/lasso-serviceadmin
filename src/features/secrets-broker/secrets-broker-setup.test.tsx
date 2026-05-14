import { renderRoute } from '@/test/render-route'
import {
  assertNoSecretMaterial,
  collectBrowserLeakSurfaces,
  serviceLassoSecretLeakSentinels,
} from '@/test/secret-leak-harness'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  filterSecretsBrokerAuditEvents,
  secretsBrokerAuditEvents,
} from './audit-events'
import {
  backupKeyStatusHasSecretMaterial,
  secretsBrokerBackupKeyStatus,
} from './backup-key-management'
import { secretsBrokerDiagnostics, scrubSecretLikeOutput } from './diagnostics'
import {
  buildProviderReconnectPlan,
  providerConnectionHasSecretValue,
  providerReconnectPlanHasSecretValue,
  providerReconnectWorkflowStates,
  secretsBrokerProviderConnections,
} from './provider-connections'
import {
  buildSingleConnectionRotationPlan,
  singleConnectionRotationPlanHasSecretValue,
} from './single-connection-rotation'
import {
  revealFixtureLooksLikeProviderCredential,
  revealSafeSurfacesIncludeRawValue,
  singleSecretRevealReference,
  singleSecretRevealScenarios,
} from './single-secret-reveal'
import {
  secretsBrokerSourceBackends,
  sourceBackendHasSecretValue,
} from './source-backends'
import { buildSecretsBrokerTopology, topologyHasSecretValue } from './topology'
import {
  workflowAuthoringBoundaries,
  workflowAuthoringHasSecretValue,
} from './workflow-authoring'

describe('Secrets Broker setup wizard', () => {
  it('shows the safe setup contract without plaintext values', async () => {
    await renderRoute('/secrets-broker')

    expect(
      await screen.findByRole('heading', { name: /Secrets Broker setup/i })
    ).toBeVisible()
    expect(screen.getAllByText(/Values hidden/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Local encrypted vault/i)[0]).toBeVisible()
    expect(screen.getAllByText(/OpenClaw exec adapter/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Generated secret write-back/i)[0]).toBeVisible()
    expect(screen.getByText(/SecretRef:/i)).toBeVisible()
    expect(screen.getAllByText(/value hidden/i)[0]).toBeVisible()
    expect(screen.getByText(/Audit and events/i)).toBeVisible()
    expect(screen.getByText(/Values never rendered/i)).toBeVisible()
    expect(screen.getByText(/Diagnostics and troubleshooting/i)).toBeVisible()
    expect(screen.getByText(/Raw output scrubbed/i)).toBeVisible()
    expect(screen.queryByText('supersecret')).not.toBeInTheDocument()
    expect(screen.queryByText('plaintext secret')).not.toBeInTheDocument()
    assertNoSecretMaterial(collectBrowserLeakSurfaces())
    expect(() =>
      assertNoSecretMaterial({
        fixture: serviceLassoSecretLeakSentinels[0].value,
      })
    ).toThrow(/Secret material leak detected/)
  })

  it('renders broker overview healthy degraded offline and unconfigured states', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker')

    expect(screen.getByText(/@secretsbroker overview/i)).toBeVisible()
    expect(screen.getByText(/@secretsbroker healthy/i)).toBeVisible()
    expect(screen.getByText(/Broker API is reachable/i)).toBeVisible()
    expect(screen.getByText(/local encrypted store reachable/i)).toBeVisible()
    expect(screen.getByText(/key version v3/i)).toBeVisible()
    expect(screen.getByText(/View provider connections/i)).toBeVisible()
    expect(screen.getByText(/View audit\/events/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Preview state/i),
      'degraded'
    )
    expect(screen.getByText(/@secretsbroker degraded/i)).toBeVisible()
    expect(screen.getAllByText(/source_auth_required/i)[0]).toBeVisible()
    expect(screen.getByText(/Recent resolve failures/i)).toBeVisible()
    expect(screen.getByText(/refresh failure · vault/i)).toBeVisible()

    await user.selectOptions(screen.getByLabelText(/Preview state/i), 'offline')
    expect(screen.getByText(/@secretsbroker offline/i)).toBeVisible()
    expect(screen.getAllByText(/API reachable/i)[0]).toBeVisible()
    expect(screen.getByText(/^no$/i)).toBeVisible()
    expect(screen.getByText(/live backend state unavailable/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Preview state/i),
      'unconfigured'
    )
    expect(screen.getByText(/@secretsbroker setup needed/i)).toBeVisible()
    expect(screen.getAllByText(/setup_needed/i)[0]).toBeVisible()
    expect(
      screen.getByText(
        /Add a local encrypted store or connect an external source/i
      )
    ).toBeVisible()
    expect(
      screen.queryByText(/correct-horse-battery-staple/i)
    ).not.toBeInTheDocument()
  })

  it('covers locked, auth-required, degraded, policy-denied, cancel, and ready states', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker')

    expect(screen.getAllByText(/Locked/i)[0]).toBeVisible()
    expect(screen.getByText(/import portable master key/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: /File source/i }))
    expect(screen.getAllByText(/Degraded/i)[0]).toBeVisible()
    expect(screen.getByText(/Risky broad paths are rejected/i)).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: /OpenClaw exec adapter/i })
    )
    expect(screen.getAllByText(/Policy denied/i)[0]).toBeVisible()
    expect(screen.getByText(/namespace allowlist/i)).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: /External source auth/i })
    )
    expect(screen.getAllByText(/Auth required/i)[0]).toBeVisible()
    expect(
      screen.getAllByText(/Authenticate the external source/i)[0]
    ).toBeVisible()
    expect(screen.getByText(/payments-api:STRIPE_KEY/i)).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: /Generated secret write-back/i })
    )
    expect(screen.getAllByText(/Generated secret write-back/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Ready/i)[0]).toBeVisible()
    expect(
      screen.getByText(/Confirm operation, policy decision, and audit reason/i)
    ).toBeVisible()
    expect(screen.getByRole('button', { name: /Cancel setup/i })).toBeVisible()
  }, 30000)

  it('renders privileged single-secret reveal default and fail-closed states without raw material', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker')

    expect(screen.getByText(/Privileged single-secret reveal/i)).toBeVisible()
    expect(screen.getByText(/Selected safe metadata/i)).toBeVisible()
    expect(screen.getByText(singleSecretRevealReference.ref)).toBeVisible()
    expect(screen.getByText(singleSecretRevealReference.name)).toBeVisible()
    expect(
      screen.getAllByText(singleSecretRevealReference.owningService)[0]
    ).toBeVisible()
    expect(screen.getByText(/Value hidden by default/i)).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Reveal secret value/i })
    ).toBeDisabled()
    expect(screen.getByText(/Bulk reveal disabled/i)).toBeVisible()
    expect(screen.getByText(/Copy disabled/i)).toBeVisible()
    expect(screen.getByText(/No route\/query value material/i)).toBeVisible()
    expect(
      screen.queryByText(singleSecretRevealReference.fakeRawValue)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Copy secret/i })
    ).not.toBeInTheDocument()

    const blockedStates = [
      [
        'auth-required',
        /Reveal blocked until operator authorization completes/i,
      ],
      ['policy-denied', /Reveal denied by policy/i],
      [
        'broker-offline',
        /Reveal unavailable because @secretsbroker is offline/i,
      ],
      [
        'unconfigured',
        /Reveal unavailable until a source\/backend is configured/i,
      ],
      [
        'audit-unavailable',
        /Reveal blocked because audit recording is unavailable/i,
      ],
    ] as const

    for (const [state, status] of blockedStates) {
      await user.selectOptions(
        screen.getByLabelText(/Reveal workflow state/i),
        state
      )
      expect(screen.getByText(status)).toBeVisible()
      expect(
        screen.getByRole('button', { name: /Reveal secret value/i })
      ).toBeDisabled()
      expect(
        screen.queryByText(singleSecretRevealReference.fakeRawValue)
      ).not.toBeInTheDocument()
    }
  }, 30000)

  it('reveals deterministic fake material only after explicit action and re-hides on cancel or expiry', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker')

    await user.selectOptions(
      screen.getByLabelText(/Reveal workflow state/i),
      'allowed'
    )
    expect(
      screen.getByText(/Ready for explicit, time-limited reveal/i)
    ).toBeVisible()
    expect(
      screen.queryByText(singleSecretRevealReference.fakeRawValue)
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /Reveal secret value/i })
    )
    expect(
      screen.getByText(singleSecretRevealReference.fakeRawValue)
    ).toBeVisible()
    expect(
      screen.getByText(/Audit event recorded: audit-reveal-001/i)
    ).toBeVisible()
    expect(
      screen.getByText(/Reveal window expires in 60 seconds/i)
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Copy secret/i })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Cancel reveal/i }))
    expect(
      screen.getByText(/Reveal cancelled; value remains hidden/i)
    ).toBeVisible()
    expect(
      screen.queryByText(singleSecretRevealReference.fakeRawValue)
    ).not.toBeInTheDocument()

    await user.selectOptions(
      screen.getByLabelText(/Reveal workflow state/i),
      'allowed'
    )
    await user.click(
      screen.getByRole('button', { name: /Reveal secret value/i })
    )
    expect(
      screen.getByText(singleSecretRevealReference.fakeRawValue)
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: /Expire reveal window/i })
    )
    expect(
      screen.getByText(/Reveal window expired; value re-hidden/i)
    ).toBeVisible()
    expect(
      screen.queryByText(singleSecretRevealReference.fakeRawValue)
    ).not.toBeInTheDocument()
  }, 30000)

  it('keeps single-secret reveal safe surfaces free of raw material', () => {
    expect(singleSecretRevealScenarios.map((scenario) => scenario.id)).toEqual([
      'hidden',
      'auth-required',
      'policy-denied',
      'broker-offline',
      'unconfigured',
      'audit-unavailable',
      'allowed',
      'cancelled',
      'expired',
    ])
    expect(revealSafeSurfacesIncludeRawValue()).toBe(false)
    expect(revealFixtureLooksLikeProviderCredential()).toBe(false)
  })

  it('renders backup restore and key-management metadata without raw material', async () => {
    await renderRoute('/secrets-broker')

    expect(
      screen.getByText(/Backup, restore, and key management/i)
    ).toBeVisible()
    expect(screen.getByText(/Backup stale/i)).toBeVisible()
    expect(screen.getByText(/Recovery risk/i)).toBeVisible()
    expect(screen.getByText(/Last backup/i)).toBeVisible()
    expect(screen.getAllByText(/Restore readiness/i)[0]).toBeVisible()
    expect(screen.getByText(/key version v4/i)).toBeVisible()
    expect(screen.getByText(/mkid_7f3a…9c21/i)).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Create encrypted backup/i })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Verify restore readiness/i })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Restore from backup/i })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Rotate master key/i })
    ).toBeVisible()
    expect(screen.getByText(/Confirm artifact path/i)).toBeVisible()
    expect(screen.getByText(/never paste key material/i)).toBeVisible()
    expect(screen.getByText(/Recent backup\/key audit metadata/i)).toBeVisible()
    expect(
      screen.queryByText(/correct-horse-battery-staple/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/portable-master-key-value/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/generated-secret-value/i)
    ).not.toBeInTheDocument()
  })

  it('keeps backup and key-management fixtures free of secret material', () => {
    expect(backupKeyStatusHasSecretMaterial(secretsBrokerBackupKeyStatus)).toBe(
      false
    )
  })

  it('renders secret sources and backends with warning states and metadata-only test results', async () => {
    await renderRoute('/secrets-broker')

    expect(screen.getByText(/Secret Sources \/ Backends/i)).toBeVisible()
    expect(screen.getAllByText(/Metadata only/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Environment provider/i)[0]).toBeVisible()
    expect(screen.getAllByText(/File provider/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Exec provider/i)[0]).toBeVisible()
    expect(screen.getAllByText(/HashiCorp Vault CLI/i)[0]).toBeVisible()
    expect(screen.getAllByText(/AWS Secrets Manager CLI/i)[0]).toBeVisible()
    expect(screen.getAllByText(/1Password CLI/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Bitwarden \/ BWS CLI/i)[0]).toBeVisible()
    expect(
      screen.getAllByText(/Docker\/Kubernetes mounted secrets/i)[0]
    ).toBeVisible()
    expect(screen.getByText(/Broad env allowlist/i)).toBeVisible()
    expect(screen.getByText(/Insecure path override/i)).toBeVisible()
    expect(screen.getByText(/Untrusted command path/i)).toBeVisible()
    expect(screen.getByText(/Missing timeout\/output limits/i)).toBeVisible()
    expect(
      screen.getAllByRole('button', { name: /Test source/i })[0]
    ).toBeVisible()
    expect(
      screen.getAllByRole('button', { name: /View diagnostics/i })[0]
    ).toBeVisible()
    expect(
      screen.getAllByRole('button', { name: /Edit configuration/i })[0]
    ).toBeVisible()
    expect(screen.getByText(/3 keys matched allowlist/i)).toBeVisible()
    expect(screen.getByText(/path policy denied/i)).toBeVisible()
    expect(screen.getByText(/command not executed/i)).toBeVisible()
    expect(screen.getAllByText(/value=hidden/i)[0]).toBeVisible()
  })

  it('keeps source backend fixtures free of secret values', () => {
    expect(secretsBrokerSourceBackends.some(sourceBackendHasSecretValue)).toBe(
      false
    )
  })

  it('renders provider connections list with status badges and safe material state', async () => {
    await renderRoute('/secrets-broker')

    expect(screen.getAllByText(/Provider Connections/i)[0]).toBeVisible()
    expect(
      screen.getAllByText(/Local default encrypted store/i)[0]
    ).toBeVisible()
    expect(screen.getAllByText(/Vault ops connection/i)[0]).toBeVisible()
    expect(
      screen.getAllByText(/AWS backup worker connection/i)[0]
    ).toBeVisible()
    expect(screen.getAllByText(/Healthy/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Reconnect required/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Auth required/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Revoked/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Permission changed/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Degraded/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Failing/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Operator action required/i)[0]).toBeVisible()
    expect(screen.getAllByText(/source_auth_required/i)[0]).toBeVisible()
    expect(screen.getAllByText(/credential_handle_missing/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Audit evt-connection/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Diagnostics diag-/i)[0]).toBeVisible()
    expect(
      screen.getAllByText(/Reconnect unavailable: Reconnect is unavailable/i)[0]
    ).toBeVisible()
    expect(screen.getAllByText(/value hidden/i)[0]).toBeVisible()
    expect(
      screen.getAllByRole('link', { name: /View details/i })[0]
    ).toHaveAttribute('href', '/secrets-broker/local-default')
    expect(
      screen.queryByRole('button', { name: /Copy secret/i })
    ).not.toBeInTheDocument()
  })

  it('filters provider connections by provider status and label with empty state', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker')

    await user.selectOptions(
      screen.getByLabelText(/Connection provider/i),
      'vault'
    )
    expect(screen.getAllByText(/Vault ops connection/i)[0]).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Connection provider/i),
      'all'
    )
    await user.selectOptions(
      screen.getByLabelText(/Connection status/i),
      'missing'
    )
    expect(
      screen.getAllByText(/AWS backup worker connection/i)[0]
    ).toBeVisible()

    await user.selectOptions(screen.getByLabelText(/Connection status/i), 'all')
    await user.type(screen.getByLabelText(/Search label/i), 'does-not-exist')
    expect(
      screen.getByText(/No provider connections match these filters/i)
    ).toBeVisible()
    expect(screen.getByText(/Add a source or connection/i)).toBeVisible()
  })

  it('renders safe provider connection detail without raw secret values', async () => {
    await renderRoute('/secrets-broker/local-default')

    expect(
      await screen.findByRole('heading', {
        name: /Local default encrypted store/i,
      })
    ).toBeVisible()
    expect(screen.getByText(/Safe metadata summary/i)).toBeVisible()
    expect(screen.getByText(/Status and health/i)).toBeVisible()
    expect(screen.getByText(/Secret material state/i)).toBeVisible()
    expect(screen.getByText(/Lifecycle status/i)).toBeVisible()
    expect(screen.getByText(/Connected/i)).toBeVisible()
    expect(
      screen.getByText(/Metadata checks and test resolve are current/i)
    ).toBeVisible()
    expect(screen.getByText(/Audit evt-connection-001/i)).toBeVisible()
    expect(screen.getByText(/Diagnostics diag-broker-api/i)).toBeVisible()
    expect(screen.getByText(/Presence: Present/i)).toBeVisible()
    expect(screen.getByText(/Raw value: hidden/i)).toBeVisible()
    expect(screen.getByText(/Copy value: unavailable/i)).toBeVisible()
    expect(screen.getByText(/Key version/i)).toBeVisible()
    expect(screen.getByText(/Expiry/i)).toBeVisible()
    expect(screen.getByText(/Last successful resolve\/use/i)).toBeVisible()
    expect(screen.getByText(/Recent audit events/i)).toBeVisible()
    expect(screen.getByText(/Connection actions/i)).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Replace\/rotate secret material/i })
    ).toBeVisible()
    expect(
      screen.getByText(/Existing services may need restart/i)
    ).toBeVisible()
    expect(
      screen.getByText(/Single-connection edit and rotation workflow/i)
    ).toBeVisible()
    expect(screen.getAllByText(/Dry-run preview ready/i)[0]).toBeVisible()
    expect(
      screen.getByText(/single-rotation-preview-2026-05-08-ready/i)
    ).toBeVisible()
    expect(screen.getByText(/Dry-run before apply/i)).toBeVisible()
    expect(screen.getByText(/No bulk mutation/i)).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Delete connection/i })
    ).toBeVisible()
    expect(screen.queryByText(/supersecret/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/correct-horse-battery-staple/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/ghp_examplePlaintextToken/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/sk-this-value-must-not-render/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Copy secret/i })
    ).not.toBeInTheDocument()
  })

  it('covers single-connection edit rotation dry-run and apply states safely', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/local-default')

    expect(screen.getAllByText(/Dry-run preview ready/i)[0]).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: /Apply blocked until dry-run, audit reason, and exact connection confirmation/i,
      })
    ).toBeDisabled()

    await user.selectOptions(
      screen.getByLabelText(/Workflow state/i),
      'dry-run-denied'
    )
    expect(screen.getByText(/Dry-run denied by policy/i)).toBeVisible()
    expect(screen.getByText(/Policy denied the proposed/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Workflow state/i),
      'auth-required'
    )
    expect(screen.getByText(/Provider auth required/i)).toBeVisible()
    expect(
      screen.getByText(/Reconnect provider through a safe credential ref/i)
    ).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Workflow state/i),
      'backend-unavailable'
    )
    expect(
      screen.getByText(/Backend unavailable or unsupported/i)
    ).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Workflow state/i),
      'audit-unavailable'
    )
    expect(
      screen.getAllByText(/Audit unavailable \/ apply blocked/i)[0]
    ).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Workflow state/i),
      'apply-ready'
    )
    await user.type(
      screen.getByLabelText(/Audit reason/i),
      'rotate after approval'
    )
    await user.type(
      screen.getByLabelText(/Confirm connection id/i),
      'local-default'
    )
    expect(
      screen.getByRole('button', { name: /Apply single-connection rotation/i })
    ).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /Cancel operation/i }))
    expect(screen.getByText(/Operation cancelled/i)).toBeVisible()
    expect(screen.getByText(/no provider metadata changed/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Workflow state/i),
      'apply-success'
    )
    expect(screen.getAllByText(/Apply success/i)[0]).toBeVisible()
    await user.selectOptions(
      screen.getByLabelText(/Workflow state/i),
      'apply-failed'
    )
    expect(
      screen.getAllByText(/Apply failure status feedback/i)[0]
    ).toBeVisible()
    expect(
      screen.queryByText(/DETERMINISTIC_FAKE_ROTATION_VALUE_81/i)
    ).not.toBeInTheDocument()
  })

  it('keeps single-connection rotation plans free of raw material', () => {
    const connection = secretsBrokerProviderConnections[0]
    for (const state of [
      'dry-run-ready',
      'dry-run-denied',
      'auth-required',
      'backend-unavailable',
      'audit-unavailable',
      'cancelled',
      'apply-ready',
      'apply-success',
      'apply-failed',
    ] as const) {
      expect(
        singleConnectionRotationPlanHasSecretValue(
          buildSingleConnectionRotationPlan(connection, state)
        )
      ).toBe(false)
    }
  })

  it('explains degraded and missing provider connection next actions', async () => {
    const degraded = await renderRoute('/secrets-broker/vault-ops')

    expect(screen.getByText(/Authentication required/i)).toBeVisible()
    expect(screen.getAllByText(/source_auth_required/i)[0]).toBeVisible()
    expect(screen.getByText(/Reconnect the Vault CLI session/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /^Reconnect$/i })).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Replace\/rotate secret material/i })
    ).toBeDisabled()
    expect(
      screen.getByText(/Reconnect before rotating external material/i)
    ).toBeVisible()

    degraded.unmount()
    await renderRoute('/secrets-broker/aws-backup-worker')
    expect(screen.getByText(/Missing credentials/i)).toBeVisible()
    expect(screen.getAllByText(/Reconnect required/i)[0]).toBeVisible()
    expect(screen.getAllByText(/credential_handle_missing/i)[0]).toBeVisible()
    expect(screen.getByText(/Add a scoped AWS profile/i)).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Clear\/revoke secret material/i })
    ).toBeDisabled()
    expect(screen.getByText(/No material is present/i)).toBeVisible()
  })

  it('covers provider reconnect workflow states and safe affected metadata', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/github-actions-refresh-failed')

    expect(screen.getByText(/Provider reconnect workflow/i)).toBeVisible()
    expect(
      screen.getByText(/Metadata-only reconnect entry point/i)
    ).toBeVisible()
    expect(screen.getAllByText(/Refresh failed/i)[0]).toBeVisible()
    expect(screen.getAllByText(/provider_refresh_failed/i)[0]).toBeVisible()
    expect(screen.getAllByText(/release-serviceadmin/i)[0]).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Retry reconnect/i })
    ).toBeEnabled()

    const scenarios = [
      ['healthy', /No reconnect required/i, /Reconnect disabled/i, false],
      [
        'auth-required',
        /Provider authorization required/i,
        /Start reconnect/i,
        true,
      ],
      ['expired', /Provider handle expired/i, /Start reconnect/i, true],
      [
        'refresh-failed',
        /The last refresh\/test failed/i,
        /Retry reconnect/i,
        true,
      ],
      [
        'revoked',
        /Provider grant revoked/i,
        /Reconnect with replacement grant/i,
        true,
      ],
      [
        'unsupported',
        /Provider capability unsupported/i,
        /Reconnect unsupported/i,
        false,
      ],
      ['pending', /Reconnect pending/i, /Reconnect pending/i, false],
      ['success', /Reconnect success/i, /Reconnect complete/i, false],
      [
        'failure',
        /Reconnect failure/i,
        /Retry reconnect after diagnostics/i,
        true,
      ],
    ] as const

    for (const [state, statusCopy, buttonName, enabled] of scenarios) {
      await user.selectOptions(
        screen.getByLabelText(/Reconnect scenario/i),
        state
      )
      expect(screen.getAllByText(statusCopy)[0]).toBeVisible()
      const button = screen.getByRole('button', { name: buttonName })
      if (enabled) expect(button).toBeEnabled()
      else expect(button).toBeDisabled()
      expect(screen.getByText(/No credential input/i)).toBeVisible()
      expect(
        screen.getByText(/Fail closed unsupported providers/i)
      ).toBeVisible()
      expect(
        screen.queryByText(/fixture-provider-credential-value/i)
      ).not.toBeInTheDocument()
    }
  }, 30000)

  it('keeps provider reconnect plans free of raw credential material', () => {
    const connection =
      secretsBrokerProviderConnections.find(
        (item) => item.id === 'github-actions-refresh-failed'
      ) ?? secretsBrokerProviderConnections[0]

    for (const { value } of providerReconnectWorkflowStates) {
      expect(
        providerReconnectPlanHasSecretValue(
          buildProviderReconnectPlan(connection, value)
        )
      ).toBe(false)
    }
  })

  it('keeps provider connection detail fixtures free of secret values', () => {
    expect(
      secretsBrokerProviderConnections.some(providerConnectionHasSecretValue)
    ).toBe(false)
  })

  it('renders workflow authoring boundary with safe validation and snippets', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker')

    expect(screen.getByText(/Workflow authoring boundary/i)).toBeVisible()
    expect(screen.getByText(/No runner editor/i)).toBeVisible()
    expect(screen.getByText(/SecretRefs only/i)).toBeVisible()
    expect(screen.getByText(/metadata-only validation/i)).toBeVisible()
    expect(screen.getAllByText(/Service start bootstrap/i)[0]).toBeVisible()
    expect(
      screen.getByText(/Service Admin session signing secret/i)
    ).toBeVisible()
    expect(
      screen.getAllByText(/secret:\/\/local\/default\/.*SESSION_SECRET/i)[0]
    ).toBeVisible()
    expect(screen.getByText(/Generated safe snippet/i)).toBeVisible()
    expect(screen.getAllByText(/values hidden/i)[0]).toBeVisible()
    expect(screen.getByText(/revealValues: false/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Authoring scenario/i),
      'deploy-payments-api'
    )

    expect(screen.getAllByText(/Deploy payments API/i)[0]).toBeVisible()
    expect(
      screen.getByText(/policy denies this workflow identity/i)
    ).toBeVisible()
    expect(screen.getByText(/Ref metadata is missing/i)).toBeVisible()
    expect(screen.getAllByText(/Denied/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Missing/i)[0]).toBeVisible()
    expect(screen.getByText(/blockOn: \[missing, denied\]/i)).toBeVisible()
    expect(
      screen.getByText(/Missing or denied refs should block save\/run handoff/i)
    ).toBeVisible()
    expect(
      screen.queryByText(/correct-horse-battery-staple/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/ghp_ex…oken/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sk-thi…nder/i)).not.toBeInTheDocument()
  })

  it('keeps workflow authoring fixtures and generated snippets secret-safe', () => {
    expect(workflowAuthoringHasSecretValue()).toBe(false)
    expect(
      workflowAuthoringBoundaries.every((workflow) =>
        workflow.snippet.includes('revealValues: false')
      )
    ).toBe(true)
    expect(
      workflowAuthoringBoundaries.some((workflow) =>
        workflow.refs.some((ref) => ref.status === 'denied')
      )
    ).toBe(true)
    expect(
      workflowAuthoringBoundaries.some((workflow) =>
        workflow.refs.some((ref) => ref.status === 'missing')
      )
    ).toBe(true)
    expect(
      workflowAuthoringBoundaries
        .flatMap((workflow) => workflow.refs)
        .every((ref) => ref.ref.startsWith('secret://'))
    ).toBe(true)
  })

  it('renders Secrets Broker topology graph and accessible relationship fallback', async () => {
    await renderRoute('/secrets-broker')

    const topology = buildSecretsBrokerTopology()

    expect(screen.getByText(/Secrets Broker topology/i)).toBeVisible()
    expect(screen.getAllByText(/Safe metadata only/i)[0]).toBeVisible()
    expect(screen.getByText(/List fallback included/i)).toBeVisible()
    expect(screen.getByText(/Actionable relationship fallback/i)).toBeVisible()
    expect(screen.getAllByText(/provider\/source ownership/i)[0]).toBeVisible()
    expect(screen.getAllByText(/missing\/denied resolution/i)[0]).toBeVisible()
    expect(screen.getAllByRole('link', { name: /Detail/i })[0]).toBeVisible()
    expect(screen.getAllByRole('link', { name: /Audit/i })[0]).toBeVisible()
    expect(
      screen.getAllByRole('link', { name: /Diagnostics/i })[0]
    ).toBeVisible()
    expect(
      screen.queryByText(/correct-horse-battery-staple/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/ghp_examplePlaintextToken/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/sk-this-value-must-not-render/i)
    ).not.toBeInTheDocument()
    expect(topology.edges.length).toBeGreaterThan(0)
  })

  it('builds topology from the same safe metadata used by list and audit views', () => {
    const topology = buildSecretsBrokerTopology()
    const edgeNodeIds = new Set(
      topology.edges.flatMap((edge) => [edge.source, edge.target])
    )
    const topologyNodeIds = new Set(topology.nodes.map((node) => node.id))

    expect(topologyHasSecretValue(topology)).toBe(false)
    expect(
      secretsBrokerProviderConnections.every((connection) =>
        topology.nodes.some((node) => node.id === `connection:${connection.id}`)
      )
    ).toBe(true)
    expect(
      secretsBrokerSourceBackends.every((source) =>
        topology.nodes.some((node) => node.id === `source:${source.id}`)
      )
    ).toBe(true)
    expect(
      secretsBrokerAuditEvents.every((event) =>
        topology.edges.some((edge) => edge.id === `audit:${event.id}`)
      )
    ).toBe(true)
    expect([...edgeNodeIds].every((id) => topologyNodeIds.has(id))).toBe(true)
    expect(topology.edges.some((edge) => edge.status === 'denied')).toBe(true)
    expect(topology.edges.some((edge) => edge.status === 'failed')).toBe(true)
  })

  it('covers audit event types, filtering, and safe detail rendering', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker')

    expect(screen.getAllByText(/resolve granted/i)[0]).toBeVisible()
    expect(screen.getAllByText(/resolve denied/i)[0]).toBeVisible()
    expect(screen.getAllByText(/refresh failure/i)[0]).toBeVisible()
    expect(screen.getAllByText(/session token revoked/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Event detail/i)[0]).toBeVisible()
    expect(screen.getByText('policy/openclaw/service-lasso/read')).toBeVisible()
    expect(screen.getByText(/Resolver granted access/i)).toBeVisible()

    await user.selectOptions(screen.getByLabelText(/Outcome/i), 'denied')
    expect(screen.getAllByText(/resolve denied/i)[0]).toBeVisible()
    expect(screen.getAllByText(/write back denied/i)[0]).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /session token revoked/i })
    ).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Audit provider/i), 'local')
    expect(screen.getAllByText(/resolve denied/i)[0]).toBeVisible()
    expect(screen.getAllByText(/write back denied/i)[0]).toBeVisible()

    fireEvent.change(screen.getByLabelText(/Source \/ actor/i), {
      target: { value: '@serviceadmin' },
    })
    expect(screen.getAllByText(/write back denied/i)[0]).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /resolve denied/i })
    ).not.toBeInTheDocument()

    expect(
      screen.queryByText(/correct-horse-battery-staple/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/ghp_examplePlaintextToken/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/sk-this-value-must-not-render/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText('plaintext secret')).not.toBeInTheDocument()
  })

  it('filters audit events by type outcome provider and time range', () => {
    expect(
      filterSecretsBrokerAuditEvents(secretsBrokerAuditEvents, {
        type: 'resolve_denied',
        outcome: 'denied',
        provider: 'local',
        query: 'postgres',
      }).map((event) => event.id)
    ).toEqual(['evt-20260507-002'])

    expect(
      filterSecretsBrokerAuditEvents(secretsBrokerAuditEvents, {
        outcome: 'revoked',
      })[0]
    ).toMatchObject({ type: 'session_token_revoked' })

    const rangedEvents = filterSecretsBrokerAuditEvents(
      secretsBrokerAuditEvents,
      {
        since: '2026-05-07T18:16:00Z',
        until: '2026-05-07T18:19:00Z',
      }
    )
    expect(rangedEvents.map((event) => event.id)).toEqual([
      'evt-20260507-003',
      'evt-20260507-004',
      'evt-20260507-005',
    ])
  })

  it('covers diagnostic failure categories and suggested fixes without raw secret output', async () => {
    await renderRoute('/secrets-broker')

    expect(screen.getByText(/Broker API reachable/i)).toBeVisible()
    expect(screen.getByText(/Local vault readable/i)).toBeVisible()
    expect(screen.getByText(/External source authentication/i)).toBeVisible()
    expect(screen.getByText(/OpenClaw SecretRef exec adapter/i)).toBeVisible()
    expect(screen.getByText(/Workflow runtime integration/i)).toBeVisible()
    expect(screen.getAllByText(/locked/i)[0]).toBeVisible()
    expect(screen.getAllByText(/source_auth_required/i)[0]).toBeVisible()
    expect(screen.getAllByText(/policy_denied/i)[0]).toBeVisible()
    expect(screen.getByText(/runtime_integration_degraded/i)).toBeVisible()
    expect(screen.getByText(/Unlock the local store/i)).toBeVisible()
    expect(
      screen.getByText(/Re-authenticate the external source/i)
    ).toBeVisible()
    expect(
      screen.getByText(/Review namespace\/action allowlist/i)
    ).toBeVisible()
    expect(
      screen.getByText(/Refresh the workflow launch identity/i)
    ).toBeVisible()
    expect(screen.getAllByText(/Open diagnostics logs/i)[0]).toBeVisible()
    expect(
      screen.queryByText(/correct-horse-battery-staple/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/ghp_examplePlaintextToken/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/sk-this-value-must-not-render/i)
    ).not.toBeInTheDocument()
  })

  it('scrubs secret-like diagnostic output before rendering', () => {
    expect(
      scrubSecretLikeOutput(
        'password=hunter2 token=ghp_secretValue api_key=sk-exampleSecret123456 AKIAABCDEFGHIJKLMNOP'
      )
    ).toBe('[redacted] [redacted] [redacted] [redacted]')
    expect(
      secretsBrokerDiagnostics.every(
        (diagnostic) =>
          !/hunter2|correct-horse|ghp_example|sk-this-value/i.test(
            diagnostic.normalizedMessage
          )
      )
    ).toBe(true)
  })

  it('shows affected refs before unlock or auth prompts', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker')

    const affectedSection = screen.getByText(
      /Affected refs and services/i
    ).parentElement
    expect(affectedSection).toBeTruthy()
    expect(
      within(affectedSection!).getByText(/echo-service:DB_PASSWORD/i)
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: /External source auth/i })
    )
    const updatedSection = screen.getByText(
      /Affected refs and services/i
    ).parentElement
    expect(updatedSection).toBeTruthy()
    expect(
      within(updatedSection!).getByText(/backup-worker:AWS_SECRET_ACCESS_KEY/i)
    ).toBeVisible()
  })
})
