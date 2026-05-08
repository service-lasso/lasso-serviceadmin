import { renderRoute } from '@/test/render-route'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  auditEventsContainSecretMaterial,
  filterSecretsBrokerAuditEvents,
  secretsBrokerAuditEvents,
} from './audit-events'

describe('Secrets Broker audit event viewer', () => {
  it('renders audit event metadata, detail, and tamper-evidence status safely', async () => {
    await renderRoute('/secrets-broker')

    expect(
      await screen.findByRole('heading', { name: /Secrets Broker setup/i })
    ).toBeVisible()
    expect(screen.getByText(/Audit and events/i)).toBeVisible()
    expect(screen.getByText(/Values never rendered/i)).toBeVisible()
    expect(screen.getByText(/Tamper evidence verified/i)).toBeVisible()
    expect(screen.getByText(/chain: audit-chain\/openclaw/i)).toBeVisible()
    expect(screen.getAllByText(/Policy decision/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Affected refs/i)[0]).toBeVisible()
    expect(
      screen.getAllByText(/Affected services\/workflows/i)[0]
    ).toBeVisible()
    expect(
      screen.getAllByText(/startup dependency resolution/i)[0]
    ).toBeVisible()
    expect(
      screen.getByText(/Event details use safe identifiers/i)
    ).toBeVisible()
  })

  it('filters by event type, outcome, provider, source, and tamper evidence', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker')

    await user.selectOptions(
      screen.getByLabelText(/Event type/i),
      'migration_completed'
    )
    expect(screen.getAllByText(/migration completed/i)[0]).toBeVisible()
    expect(screen.getAllByText(/approved backend migration/i)[0]).toBeVisible()

    await user.selectOptions(screen.getByLabelText(/Outcome/i), 'success')
    await user.selectOptions(screen.getByLabelText(/Audit provider/i), 'vault')
    expect(screen.getByText(/Local to Vault migration/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Tamper evidence/i),
      'verified'
    )
    expect(
      screen.getByText(/Migration summary and counts were verified/i)
    ).toBeVisible()

    await user.clear(screen.getByLabelText(/Source \/ actor/i))
    await user.type(screen.getByLabelText(/Source \/ actor/i), 'billing-worker')
    expect(screen.getByText(/billing-worker/i)).toBeVisible()
  })

  it('shows broken and unavailable tamper-evidence states without leaking payloads', async () => {
    const user = userEvent.setup()
    await renderRoute('/secrets-broker')

    await user.selectOptions(
      screen.getByLabelText(/Tamper evidence/i),
      'broken'
    )
    expect(screen.getByText(/Tamper evidence broken/i)).toBeVisible()
    expect(screen.getByText(/investigation required/i)).toBeVisible()

    await user.selectOptions(
      screen.getByLabelText(/Tamper evidence/i),
      'unavailable'
    )
    expect(screen.getByText(/Tamper evidence unavailable/i)).toBeVisible()
    expect(screen.getByText(/Provider is auth-required/i)).toBeVisible()
    expect(screen.getByText(/sequence: unavailable/i)).toBeVisible()
  })

  it('keeps audit fixtures and rendered safe surface free of raw secret material', async () => {
    expect(auditEventsContainSecretMaterial()).toBe(false)
    expect(
      filterSecretsBrokerAuditEvents(secretsBrokerAuditEvents, {
        tamperEvidence: 'verified',
      })
    ).toHaveLength(7)
    expect(
      filterSecretsBrokerAuditEvents(secretsBrokerAuditEvents, {
        query: 'STRIPE_API_TOKEN',
      })
    ).toHaveLength(1)

    const { container } = await renderRoute('/secrets-broker')
    expect(container).not.toHaveTextContent(/DEMO_REVEAL_VALUE_42/i)
    expect(container).not.toHaveTextContent(/ACTUAL_SECRET/i)
    expect(container).not.toHaveTextContent(/BEGIN PRIVATE KEY/i)
    expect(container).not.toHaveTextContent(/CLIENT_SECRET=/i)
    expect(container).not.toHaveTextContent(/REFRESH_TOKEN=/i)
  })
})
