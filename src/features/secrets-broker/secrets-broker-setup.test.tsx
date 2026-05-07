import { renderRoute } from '@/test/render-route'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  filterSecretsBrokerAuditEvents,
  secretsBrokerAuditEvents,
} from './audit-events'
import { secretsBrokerDiagnostics, scrubSecretLikeOutput } from './diagnostics'
import {
  providerConnectionHasSecretValue,
  secretsBrokerProviderConnections,
} from './provider-connections'
import {
  secretsBrokerSourceBackends,
  sourceBackendHasSecretValue,
} from './source-backends'

describe('Secrets Broker setup wizard', () => {
  it('shows the safe setup contract without plaintext values', async () => {
    await renderRoute('/secrets-broker')

    expect(
      await screen.findByRole('heading', { name: /Secrets Broker setup/i })
    ).toBeVisible()
    expect(screen.getByText(/Values hidden/i)).toBeVisible()
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
  })

  it('renders secret sources and backends with warning states and metadata-only test results', async () => {
    await renderRoute('/secrets-broker')

    expect(screen.getByText(/Secret Sources \/ Backends/i)).toBeVisible()
    expect(screen.getAllByText(/Metadata only/i)[0]).toBeVisible()
    expect(screen.getByText(/Environment provider/i)).toBeVisible()
    expect(screen.getByText(/File provider/i)).toBeVisible()
    expect(screen.getByText(/Exec provider/i)).toBeVisible()
    expect(screen.getByText(/HashiCorp Vault CLI/i)).toBeVisible()
    expect(screen.getAllByText(/AWS Secrets Manager CLI/i)[0]).toBeVisible()
    expect(screen.getAllByText(/1Password CLI/i)[0]).toBeVisible()
    expect(screen.getByText(/Bitwarden \/ BWS CLI/i)).toBeVisible()
    expect(
      screen.getByText(/Docker\/Kubernetes mounted secrets/i)
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
    expect(screen.getByText(/Local default encrypted store/i)).toBeVisible()
    expect(screen.getAllByText(/Vault ops connection/i)[0]).toBeVisible()
    expect(screen.getByText(/AWS backup worker connection/i)).toBeVisible()
    expect(screen.getAllByText(/Healthy/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Reconnect required/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Failing/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Operator action required/i)[0]).toBeVisible()
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
    expect(
      screen.queryByText(/Local default encrypted store/i)
    ).not.toBeInTheDocument()

    await user.selectOptions(
      screen.getByLabelText(/Connection provider/i),
      'all'
    )
    await user.selectOptions(
      screen.getByLabelText(/Connection status/i),
      'missing'
    )
    expect(screen.getByText(/AWS backup worker connection/i)).toBeVisible()
    expect(screen.queryByText(/Vault ops connection/i)).not.toBeInTheDocument()

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

  it('explains degraded and missing provider connection next actions', async () => {
    const degraded = await renderRoute('/secrets-broker/vault-ops')

    expect(screen.getByText(/Authentication required/i)).toBeVisible()
    expect(screen.getAllByText(/source_auth_required/i)[0]).toBeVisible()
    expect(screen.getByText(/Reconnect the Vault CLI session/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /Reconnect/i })).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Replace\/rotate secret material/i })
    ).toBeDisabled()
    expect(
      screen.getByText(/Reconnect before rotating external material/i)
    ).toBeVisible()

    degraded.unmount()
    await renderRoute('/secrets-broker/aws-backup-worker')
    expect(screen.getByText(/Missing credentials/i)).toBeVisible()
    expect(screen.getAllByText(/credential_handle_missing/i)[0]).toBeVisible()
    expect(screen.getByText(/Add a scoped AWS profile/i)).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Clear\/revoke secret material/i })
    ).toBeDisabled()
    expect(screen.getByText(/No material is present/i)).toBeVisible()
  })

  it('keeps provider connection detail fixtures free of secret values', () => {
    expect(
      secretsBrokerProviderConnections.some(providerConnectionHasSecretValue)
    ).toBe(false)
  })

  it('covers audit event types, filtering, and safe detail rendering', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker')

    expect(screen.getAllByText(/resolve granted/i)[0]).toBeVisible()
    expect(screen.getAllByText(/resolve denied/i)[0]).toBeVisible()
    expect(screen.getAllByText(/refresh failure/i)[0]).toBeVisible()
    expect(screen.getAllByText(/session token revoked/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Event detail/i)[0]).toBeVisible()
    expect(
      screen.getByText(/policy\/openclaw\/service-lasso\/read/i)
    ).toBeVisible()
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

    await user.type(screen.getByLabelText(/Source \/ actor/i), '@serviceadmin')
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
