import { renderRoute } from '@/test/render-route'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  filterSecretsBrokerAuditEvents,
  secretsBrokerAuditEvents,
} from './audit-events'
import { secretsBrokerDiagnostics, scrubSecretLikeOutput } from './diagnostics'

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

    await user.selectOptions(screen.getByLabelText(/Provider/i), 'local')
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
