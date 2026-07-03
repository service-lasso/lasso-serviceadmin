import { renderRoute } from '@/test/render-route'
import {
  assertNoSecretMaterial,
  collectBrowserLeakSurfaces,
  serviceLassoSecretLeakSentinels,
} from '@/test/secret-leak-harness'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
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
  buildOperationalLockoutClearPreview,
  buildOperationalLockoutClearResult,
  filterOperationalControlEvents,
  operationalControlEvents,
  operationalControlFixturesHaveSecretMaterial,
  operationalControlLockouts,
} from './operational-controls'
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
  singleSecretRevealScenarios,
} from './single-secret-reveal'
import {
  buildProvidersManagementSummary,
  getAddableSecretsBrokerProviders,
  getConfiguredSecretsBrokerProviders,
  secretsBrokerSourceBackends,
  sourceBackendHasSecretValue,
} from './source-backends'
import {
  buildSecretVariableMappingRows,
  buildSecretsBrokerTopology,
  filterSecretsBrokerTopology,
  topologyHasSecretValue,
} from './topology'
import {
  workflowAuthoringBoundaries,
  workflowAuthoringHasSecretValue,
} from './workflow-authoring'

const topologyTestServices = [
  {
    id: 'admin-api',
    name: 'Admin API',
    status: 'running',
    favorite: false,
    note: 'Test service',
    links: [],
    installed: true,
    role: 'Test service',
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '1m',
      lastCheckAt: '2026-06-06T20:00:00Z',
      summary: 'Healthy',
    },
    endpoints: [],
    metadata: {
      serviceType: 'api',
      runtime: 'node',
      version: 'test',
      build: 'test',
    },
    dependencies: [],
    dependents: [],
    environmentVariables: [
      {
        key: 'ADMIN_API_TOKEN',
        value: 'secret://services/admin/api_token',
        scope: 'service',
        secret: true,
        source: '@secretsbroker/local/default',
      },
      {
        key: 'UNMAPPED_PASSWORD',
        value: 'plain-text-password-value',
        scope: 'service',
        source: 'service.json',
      },
      {
        key: 'LOG_LEVEL',
        value: 'debug',
        scope: 'service',
        source: 'service.json',
      },
    ],
    recentLogs: [],
    actions: [],
  },
] as DashboardService[]

describe('Secrets Broker overview dashboard', () => {
  it('shows the operator overview without setup-wall or plaintext values', async () => {
    await renderRoute('/secrets-broker')

    expect(
      await screen.findByRole('heading', { name: /^Overview$/i })
    ).toBeVisible()
    expect(screen.getAllByText(/Values hidden/i)[0]).toBeVisible()
    expect(screen.getByText(/Broker API is reachable/i)).toBeVisible()
    expect(screen.getByText(/Ready providers/i)).toBeVisible()
    expect(screen.getByText(/Needs operator action/i)).toBeVisible()
    expect(
      screen
        .getAllByRole('link', { name: /^Audit$/i })
        .some(
          (link) => link.getAttribute('href') === '/operations/audit-logging'
        )
    ).toBe(true)
    expect(
      screen.getByRole('link', { name: /View provider status/i })
    ).toHaveAttribute('href', '/secrets-broker/sources')
    expect(
      screen.queryByRole('heading', { name: /Secret Sources \/ Backends/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Source setup paths/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Cancel setup/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', {
        name: /Privileged single-secret reveal/i,
      })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', {
        name: /Backup, restore, and key management/i,
      })
    ).not.toBeInTheDocument()
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
    expect(
      await screen.findByRole('region', {
        name: /Live Secrets Broker status/i,
      })
    ).toBeVisible()
    expect(
      screen.getByText(/Explicit Service Admin stub mode is enabled/i)
    ).toBeVisible()
    expect(screen.getByText(/stub fixture metadata/i)).toBeVisible()
    expect(screen.getByText(/@secretsbroker healthy/i)).toBeVisible()
    expect(screen.getByText(/Broker API is reachable/i)).toBeVisible()
    expect(screen.getByText(/local encrypted store reachable/i)).toBeVisible()
    expect(screen.getByText(/key version v3/i)).toBeVisible()
    expect(screen.getByText(/View providers/i)).toBeVisible()
    expect(screen.getAllByText(/^Audit$/i)[0]).toBeVisible()

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

  it('redirects the removed operational controls route to Audit', async () => {
    const { router } = await renderRoute('/secrets-broker/operational-controls')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/operations/audit-logging')
    })
    expect(screen.getByRole('heading', { name: /^Audit$/i })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: /^Operational Controls$/i })
    ).not.toBeInTheDocument()
    assertNoSecretMaterial(collectBrowserLeakSurfaces())
  })

  it('keeps overview action-oriented and provider setup detail on the providers page', async () => {
    await renderRoute('/secrets-broker')

    expect(screen.getByRole('heading', { name: /^Overview$/i })).toBeVisible()
    expect(screen.getByText(/Reconnect required/i)).toBeVisible()
    expect(screen.getByText(/Recent denied requests/i)).toBeVisible()
    expect(
      screen.queryByText(/Affected refs and services/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Cancel setup/i)).not.toBeInTheDocument()

    await renderRoute('/secrets-broker/sources')

    expect(
      screen.getByRole('heading', { name: /Secrets Broker providers/i })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /^Add provider$/i })
    ).toBeVisible()
    expect(screen.getByPlaceholderText(/Search providers/i)).toBeVisible()
    expect(screen.getAllByText(/Local encrypted store/i)[0]).toBeVisible()
    expect(
      screen.queryByText(/HashiCorp Vault \/ OpenBao provider/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Authentication required/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/correct-horse-battery-staple/i)
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
    await renderRoute('/secrets-broker/backup-keys')

    expect(
      screen.getByRole('heading', {
        name: /Local encrypted store/i,
      })
    ).toBeVisible()
    expect(screen.getAllByText(/Backup and keys/i)[0]).toBeVisible()
    expect(screen.getAllByText(/setup_needed/i)[0]).toBeVisible()
    expect(screen.getAllByText(/reconnect_required/i)[0]).toBeVisible()
    expect(screen.getAllByText(/unlock_or_unseal_source/i)[0]).toBeVisible()
    expect(screen.getByText(/^stale$/i)).toBeVisible()
    expect(
      screen.getByText(/rotation available after fresh backup/i)
    ).toBeVisible()
    expect(screen.getByText(/restore metadata/i)).toBeVisible()
    expect(screen.getByText(/master key status/i)).toBeVisible()
    expect(screen.getByText(/recovery share metadata/i)).toBeVisible()
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
    expect(
      screen.getByText(/SECRETSBROKER_SOURCES_PATH: no external config active/i)
    ).toBeVisible()
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
    expect(operationalControlFixturesHaveSecretMaterial()).toBe(false)
    expect(
      filterOperationalControlEvents(operationalControlEvents, {
        serviceId: 'payments-api',
        providerId: 'vault',
        outcome: 'blocked',
        severity: 'critical',
      })
    ).toHaveLength(1)

    const supportedLockout = operationalControlLockouts.find(
      (lockout) => lockout.auditedClearSupported
    )
    expect(supportedLockout).toBeDefined()
    const blockedPreview = buildOperationalLockoutClearPreview(
      supportedLockout!,
      'short',
      supportedLockout!.scope
    )
    expect(blockedPreview.canSubmit).toBe(false)
    const readyPreview = buildOperationalLockoutClearPreview(
      supportedLockout!,
      'operator reauthenticated source and verified audit availability',
      supportedLockout!.scope
    )
    expect(readyPreview).toMatchObject({
      canSubmit: true,
      outcome: 'clear_ready',
      auditStatus: 'audit_ready',
    })
    const clearResult = buildOperationalLockoutClearResult(
      supportedLockout!,
      'operator reauthenticated source and verified audit availability',
      supportedLockout!.scope
    )
    expect(clearResult).toMatchObject({
      endpoint: 'POST /v1/management/lockouts/clear',
      request: { scope: supportedLockout!.scope },
      response: { outcome: 'cleared', auditStatus: 'audit_recorded' },
    })
  })

  it('renders Providers management as one enabled-provider table', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/sources')

    expect(
      screen.getByRole('heading', { name: /Secrets Broker providers/i })
    ).toBeVisible()
    expect(
      await screen.findByRole('region', {
        name: /Live provider source metadata/i,
      })
    ).toBeVisible()
    expect(
      screen.getByText(/Explicit Service Admin stub mode is enabled/i)
    ).toBeVisible()
    expect(screen.getByText(/stub fixture metadata/i)).toBeVisible()
    expect(screen.getAllByText(/Metadata only/i)[0]).toBeVisible()
    expect(
      screen.getByRole('button', { name: /^Add provider$/i })
    ).toBeVisible()
    expect(
      screen.getByRole('columnheader', { name: /Provider/i })
    ).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /Enabled/i })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /Health/i })).toBeVisible()
    expect(screen.getAllByText(/Local encrypted store/i)[0]).toBeVisible()
    expect(screen.getAllByText(/local-encrypted-store/i)[0]).toBeVisible()
    expect(screen.getByText(/^0$/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /^Actions$/i }))
    expect(
      screen.getByRole('menuitem', { name: /View\/Edit configuration/i })
    ).toBeVisible()
    expect(
      screen.getByRole('menuitem', { name: /Test connection/i })
    ).toBeVisible()
    expect(
      screen.getByRole('menuitem', { name: /Reconnect \/ reauth/i })
    ).toBeVisible()
    expect(
      screen.getByRole('menuitem', { name: /Disable provider/i })
    ).toBeVisible()
    expect(
      screen.getByRole('menuitem', { name: /Remove provider/i })
    ).toBeVisible()
    await user.click(screen.getByRole('menuitem', { name: /Test connection/i }))
    expect(screen.getByLabelText(/Provider action detail/i)).toBeVisible()
    expect(screen.getByText(/Provider connection test/i)).toBeVisible()
    expect(
      screen.getByText(/latest metadata test failed closed/i)
    ).toBeVisible()
    expect(
      screen.getByText(/refs, namespaces, state, and audit metadata only/i)
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: /^Actions$/i }))
    await user.click(screen.getByRole('menuitem', { name: /Reconnect/i }))
    expect(screen.getByText(/Provider reconnect workflow/i)).toBeVisible()
    expect(
      screen.getByText(/reconnect required before provider-backed actions/i)
    ).toBeVisible()
    expect(
      screen.getByText(/raw provider credentials are never entered here/i)
    ).toBeVisible()
    expect(screen.getAllByText(/reconnect_required/i)[0]).toBeVisible()
    expect(screen.getAllByText(/locked/i)[0]).toBeVisible()
    expect(screen.getAllByText(/unlock_or_unseal_source/i)[0]).toBeVisible()
    expect(
      screen.queryByText(/Local bootstrap providers/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Environment provider/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/HashiCorp Vault CLI/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Broad env allowlist/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Insecure path override/i)
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Add provider$/i }))
    expect(
      screen.getByRole('dialog', { name: /^Add provider$/i })
    ).toBeVisible()
    expect(screen.getByText(/Choose a provider setup path/i)).toBeVisible()
    expect(screen.getByText(/Environment provider/i)).toBeVisible()
    expect(screen.getByText(/AWS Secrets Manager CLI/i)).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: /Environment provider/i })
    )
    expect(screen.queryByRole('dialog', { name: /^Add provider$/i })).toBeNull()
    expect(screen.getByText(/Add provider metadata setup/i)).toBeVisible()
    expect(screen.getByText(/setup preview ready/i)).toBeVisible()
    expect(
      screen.getByText(/provider credentials stay outside Service Admin/i)
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: /^Clear$/i }))

    await user.type(screen.getByPlaceholderText(/Search providers/i), 'aws')
    expect(screen.getByText(/No configured providers match/i)).toBeVisible()
    expect(
      screen.queryByText(/AWS Secrets Manager CLI/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Environment provider/i)).not.toBeInTheDocument()
  })

  it('keeps addable provider details off the focused providers page', async () => {
    await renderRoute('/secrets-broker/sources')

    expect(screen.queryByText(/Local bootstrap providers/i)).toBeNull()
    expect(screen.queryByText(/Environment provider/i)).toBeNull()
    expect(screen.queryByText(/File provider/i)).toBeNull()
    expect(screen.queryByText(/Exec provider/i)).toBeNull()
    expect(screen.queryByText(/narrow_allowlist_before_production/i)).toBeNull()
    expect(screen.queryByText(/fix_path_scope_and_symlink_policy/i)).toBeNull()
    expect(
      screen.queryByText(/configure_trusted_command_timeout_and_output_limits/i)
    ).toBeNull()
    expect(screen.queryByText(/correct-horse-battery-staple/i)).toBeNull()
    expect(screen.queryByText(/fixture-provider-credential-value/i)).toBeNull()
    assertNoSecretMaterial(collectBrowserLeakSurfaces())
  })

  it('keeps Vault OpenBao addable metadata safe but off the table page', async () => {
    await renderRoute('/secrets-broker/sources')

    const vaultProvider = secretsBrokerSourceBackends.find(
      (source) => source.id === 'vault-cli'
    )
    expect(vaultProvider).toMatchObject({
      configured: false,
      enabled: false,
      defaultRole: 'addable',
      lifecycle: 'setup-needed',
      brokerState: 'auth_required',
      kind: 'vault/openbao',
    })
    expect(vaultProvider?.supportedActions).toEqual(
      expect.arrayContaining([
        'test-source',
        'view-diagnostics',
        'edit-configuration',
        'view-examples',
      ])
    )

    expect(
      screen.queryByText(/HashiCorp Vault \/ OpenBao provider/i)
    ).toBeNull()
    expect(
      screen.queryByText(/secret:\/\/providers\/vault\/payments\/STRIPE_KEY/i)
    ).toBeNull()

    expect(screen.queryByText(/fixture-provider-credential-value/i)).toBeNull()
    expect(screen.queryByText(/correct-horse-battery-staple/i)).toBeNull()
    expect(screen.queryByText(/SERVICE_LASSO_FAKE_SECRET_SENTINEL/i)).toBeNull()
    assertNoSecretMaterial(collectBrowserLeakSurfaces())
  })

  it('keeps AWS Secrets Manager addable metadata safe but off the table page', async () => {
    await renderRoute('/secrets-broker/sources')

    const awsProvider = secretsBrokerSourceBackends.find(
      (source) => source.id === 'aws-secrets-manager-cli'
    )
    expect(awsProvider).toMatchObject({
      configured: false,
      enabled: false,
      defaultRole: 'addable',
      lifecycle: 'setup-needed',
      brokerState: 'auth_required',
      kind: 'aws-secrets-manager',
    })
    expect(awsProvider?.supportedActions).toEqual(
      expect.arrayContaining([
        'test-source',
        'view-diagnostics',
        'edit-configuration',
        'view-examples',
      ])
    )

    expect(screen.queryByText(/AWS Secrets Manager CLI provider/i)).toBeNull()
    expect(
      screen.queryByText(/secret:\/\/providers\/aws\/default\/backup-worker/i)
    ).toBeNull()

    expect(screen.queryByText(/fixture-provider-credential-value/i)).toBeNull()
    expect(screen.queryByText(/correct-horse-battery-staple/i)).toBeNull()
    expect(screen.queryByText(/SERVICE_LASSO_FAKE_SECRET_SENTINEL/i)).toBeNull()
    expect(screen.queryByText(/AKIA[0-9A-Z]{16}/i)).toBeNull()
    assertNoSecretMaterial(collectBrowserLeakSurfaces())
  })

  it('keeps 1Password CLI addable metadata safe but off the table page', async () => {
    await renderRoute('/secrets-broker/sources')

    const onePasswordProvider = secretsBrokerSourceBackends.find(
      (source) => source.id === 'onepassword-cli'
    )
    expect(onePasswordProvider).toMatchObject({
      configured: false,
      enabled: false,
      defaultRole: 'addable',
      lifecycle: 'setup-needed',
      brokerState: 'auth_required',
    })
    expect(onePasswordProvider?.supportedActions).toContain(
      'edit-configuration'
    )

    expect(screen.queryByText(/1Password CLI provider/i)).toBeNull()
    expect(
      screen.queryByText(
        /secret:\/\/providers\/onepassword\/default\/OPENCLAW_API_KEY/i
      )
    ).toBeNull()
    expect(screen.queryByText(/fixture-provider-credential-value/i)).toBeNull()
    expect(screen.queryByText(/correct-horse-battery-staple/i)).toBeNull()
    assertNoSecretMaterial(collectBrowserLeakSurfaces())
  })

  it('keeps Bitwarden BWS addable metadata safe but off the table page', async () => {
    await renderRoute('/secrets-broker/sources')

    const bitwardenProvider = secretsBrokerSourceBackends.find(
      (source) => source.id === 'bitwarden-bws-cli'
    )
    expect(bitwardenProvider).toMatchObject({
      configured: false,
      enabled: false,
      defaultRole: 'addable',
      lifecycle: 'setup-needed',
      brokerState: 'auth_required',
      kind: 'bitwarden-bws',
    })
    expect(bitwardenProvider?.supportedActions).toEqual(
      expect.arrayContaining([
        'test-source',
        'view-diagnostics',
        'edit-configuration',
        'view-examples',
      ])
    )

    expect(screen.queryByText(/Bitwarden \/ BWS CLI provider/i)).toBeNull()
    expect(
      screen.queryByText(
        /secret:\/\/providers\/bitwarden\/default\/OPENCLAW_API_KEY/i
      )
    ).toBeNull()

    expect(screen.queryByText(/fixture-provider-credential-value/i)).toBeNull()
    expect(screen.queryByText(/correct-horse-battery-staple/i)).toBeNull()
    expect(screen.queryByText(/SERVICE_LASSO_FAKE_SECRET_SENTINEL/i)).toBeNull()
    assertNoSecretMaterial(collectBrowserLeakSurfaces())
  })

  it('keeps mounted secrets addable metadata safe but off the table page', async () => {
    await renderRoute('/secrets-broker/sources')

    const mountedProvider = secretsBrokerSourceBackends.find(
      (source) => source.id === 'mounted-secrets'
    )
    expect(mountedProvider).toMatchObject({
      configured: false,
      enabled: false,
      defaultRole: 'addable',
      lifecycle: 'setup-needed',
      brokerState: 'not_configured',
      kind: 'mounted-secrets',
    })
    expect(mountedProvider?.supportedActions).toEqual(
      expect.arrayContaining([
        'test-source',
        'view-diagnostics',
        'edit-configuration',
        'view-examples',
      ])
    )

    expect(screen.queryByText(/Docker\/Kubernetes mounted secrets/i)).toBeNull()
    expect(
      screen.queryByText(/mounted:\/\/run-secrets\/postgres-password/i)
    ).toBeNull()

    expect(screen.queryByText(/fixture-provider-credential-value/i)).toBeNull()
    expect(screen.queryByText(/correct-horse-battery-staple/i)).toBeNull()
    expect(screen.queryByText(/SERVICE_LASSO_FAKE_SECRET_SENTINEL/i)).toBeNull()
    assertNoSecretMaterial(collectBrowserLeakSurfaces())
  })

  it('routes the legacy secret-sources hash to the canonical sources page', async () => {
    const { router } = await renderRoute('/secrets-broker#secret-sources')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Secrets Broker providers$/i })
      ).toBeVisible()
    })

    expect(router.state.location.pathname).toBe('/secrets-broker/sources')
    expect(
      screen.queryByRole('heading', { name: /^Secrets Broker setup$/i })
    ).not.toBeInTheDocument()
  })

  it.each([
    ['operational-controls', '/operations/audit-logging'],
    ['provider-connections', '/secrets-broker/sources'],
    ['single-secret-reveal', '/secrets-broker/secrets'],
    ['backup-keys', '/secrets-broker/backup-keys'],
    ['workflow-authoring-boundary', '/secrets-broker/sources'],
    ['secrets-topology', '/secrets-broker/topology'],
    ['audit-events', '/operations/audit-logging'],
    ['diagnostics', '/secrets-broker/sources'],
  ])('routes legacy #%s hash to %s', async (hash, path) => {
    const { router } = await renderRoute(`/secrets-broker#${hash}`)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(path)
    })
  })

  it('keeps provider management fixtures scoped to one configured default', async () => {
    await renderRoute('/secrets-broker/sources')

    expect(getConfiguredSecretsBrokerProviders()).toHaveLength(1)
    expect(getConfiguredSecretsBrokerProviders()[0]).toMatchObject({
      id: 'local-encrypted-store',
      configured: true,
      defaultRole: 'default',
    })
    expect(getAddableSecretsBrokerProviders().length).toBeGreaterThan(1)
    expect(buildProvidersManagementSummary()).toMatchObject({
      configuredCount: 1,
      readyCount: 0,
      needsActionCount: 1,
      defaultProvider: 'Local encrypted store',
    })

    expect(
      screen.getByRole('button', { name: /^Add provider$/i })
    ).toBeVisible()
    expect(screen.queryByText(/AWS Secrets Manager CLI/i)).toBeNull()
  })

  it('blocks local fallback provider remove and disable from the row action menu', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/sources')

    expect(screen.getByText(/Fallback\/default/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: /^Actions$/i }))

    const disableItem = await screen.findByRole('menuitem', {
      name: /Disable provider/i,
    })
    const removeItem = screen.getByRole('menuitem', {
      name: /Remove provider/i,
    })

    expect(disableItem).toHaveAttribute('aria-disabled', 'true')
    expect(removeItem).toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.getAllByText(
        /Local encrypted store is the fallback provider and cannot be removed/i
      ).length
    ).toBeGreaterThanOrEqual(2)

    await user.click(screen.getByRole('menuitem', { name: /Test connection/i }))

    expect(
      await screen.findByRole('region', { name: /Provider action detail/i })
    ).toBeVisible()
    expect(
      screen.getByText(/latest metadata test failed closed/i)
    ).toBeVisible()
    expect(screen.getAllByText(/Local encrypted store/i)[0]).toBeVisible()
    assertNoSecretMaterial(collectBrowserLeakSurfaces())
  })

  it('keeps source backend fixtures free of secret values', () => {
    expect(secretsBrokerSourceBackends.some(sourceBackendHasSecretValue)).toBe(
      false
    )
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

  it('renders Secrets Broker topology graph and variable mapping table', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker/topology')

    expect(
      screen.getByRole('heading', { name: /Secrets Broker topology/i })
    ).toBeVisible()
    expect(await screen.findByText(/Runtime inventory source/i)).toBeVisible()
    expect(screen.getByText(/Derived from table rows/i)).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /service/i })).toBeVisible()
    expect(
      screen.getByRole('columnheader', { name: /variable/i })
    ).toBeVisible()
    expect(
      screen.getByRole('columnheader', { name: /SecretRef/i })
    ).toBeVisible()
    expect(screen.getByText('SESSION_SECRET')).toBeVisible()
    expect(
      screen.getByText('secret://@serviceadmin/SESSION_SECRET')
    ).toBeVisible()
    expect(screen.getByText('POSTGRES_ADMIN_PASSWORD')).toBeVisible()
    expect(screen.getAllByRole('link', { name: /^Service$/i })[0]).toBeVisible()
    expect(
      screen.getAllByRole('link', { name: /^Provider status$/i })[0]
    ).toBeVisible()

    const graphSearch = screen.getByLabelText(/Search topology/i)
    expect(graphSearch).toBeVisible()
    expect(
      screen.getByText(/Showing \d+ of \d+ nodes and \d+ of \d+ relationships/i)
    ).toBeVisible()

    await user.type(graphSearch, 'telegram')
    expect(graphSearch).toHaveValue('telegram')
    expect(screen.getByText('TELEGRAM_BOT_TOKEN')).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Clear topology search/i })
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: /Clear topology search/i })
    )
    expect(graphSearch).toHaveValue('')
    expect(screen.getByText('SESSION_SECRET')).toBeVisible()

    await user.type(graphSearch, 'zz-no-match')
    expect(
      screen.getByText(/No topology nodes or relationships match/i)
    ).toBeVisible()
    expect(
      screen.getByText(/No secret variable mappings match the current filters/i)
    ).toBeVisible()

    await user.keyboard('{Escape}')
    expect(graphSearch).toHaveValue('')
    expect(screen.getByText('SESSION_SECRET')).toBeVisible()

    const tableSearch = screen.getByPlaceholderText(
      /Search services, variables, refs, sources, and status/i
    )
    await user.type(tableSearch, 'telegram')
    expect(tableSearch).toHaveValue('telegram')
    expect(screen.getByText('TELEGRAM_BOT_TOKEN')).toBeVisible()
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

  it('filters topology search results without orphaning visible edges', () => {
    const topology = buildSecretsBrokerTopology(topologyTestServices)
    const filteredTopology = filterSecretsBrokerTopology(topology, 'admin')
    const filteredNodeIds = new Set(
      filteredTopology.nodes.map((node) => node.id)
    )

    expect(filteredTopology.nodes.length).toBeGreaterThan(0)
    expect(filteredTopology.nodes.length).toBeLessThan(topology.nodes.length)
    expect(filteredTopology.edges.length).toBeGreaterThan(0)
    expect(
      filteredTopology.nodes.some((node) => node.label === 'Admin API')
    ).toBe(true)
    expect(
      filteredTopology.edges.every(
        (edge) =>
          filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
      )
    ).toBe(true)
    expect(topologyHasSecretValue(filteredTopology)).toBe(false)
  })

  it('builds topology from runtime service variables without raw values or sample defaults', () => {
    const topology = buildSecretsBrokerTopology(topologyTestServices)
    const rows = buildSecretVariableMappingRows(topologyTestServices)
    const edgeNodeIds = new Set(
      topology.edges.flatMap((edge) => [edge.source, edge.target])
    )
    const topologyNodeIds = new Set(topology.nodes.map((node) => node.id))

    expect(rows.map((row) => row.variableName)).toEqual([
      'ADMIN_API_TOKEN',
      'UNMAPPED_PASSWORD',
    ])
    expect(
      rows.find((row) => row.variableName === 'ADMIN_API_TOKEN')
    ).toMatchObject({
      secretRef: 'secret://services/admin/api_token',
      status: 'mapped',
    })
    expect(
      rows.find((row) => row.variableName === 'UNMAPPED_PASSWORD')
    ).toMatchObject({
      secretRef: 'Not mapped',
      status: 'unmapped',
    })
    expect(topologyHasSecretValue(topology)).toBe(false)
    expect([...edgeNodeIds].every((id) => topologyNodeIds.has(id))).toBe(true)
    expect(topology.edges.some((edge) => edge.status === 'ok')).toBe(true)
    expect(topology.edges.some((edge) => edge.status === 'missing')).toBe(true)
    expect(
      topology.nodes.some((node) => node.label === 'run-20260507-190144')
    ).toBe(false)
    expect(topology.nodes.some((node) => node.label === 'service-start')).toBe(
      false
    )
  })

  it('covers audit event types, filtering, and safe detail rendering', async () => {
    await renderRoute('/operations/audit-logging')

    expect(screen.getByRole('heading', { name: /^Audit$/i })).toBeVisible()
    expect(screen.getAllByText(/resolve granted/i)[0]).toBeVisible()
    expect(screen.getAllByText(/resolve denied/i)[0]).toBeVisible()

    expect(screen.getAllByText(/write back denied/i)[0]).toBeVisible()

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

  it('scrubs secret-like diagnostic output before rendering', () => {
    const fakeAwsAccessKey = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('')

    expect(
      scrubSecretLikeOutput(
        `password=hunter2 token=ghp_secretValue api_key=sk-exampleSecret123456 ${fakeAwsAccessKey}`
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

  it('keeps provider refs and warning detail off the focused providers table', async () => {
    await renderRoute('/secrets-broker/sources')

    expect(
      screen.queryByText(/secret:\/\/providers\/vault\/payments\/STRIPE_KEY/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/secret:\/\/providers\/aws\/default\/backup-worker/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Sealed, locked, auth_required/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/fixture-provider-credential-value/i)
    ).not.toBeInTheDocument()
  })
})
