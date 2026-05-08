import { renderRoute } from '@/test/render-route'
import { screen } from '@testing-library/react'
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

  it('filters by event type, outcome, provider, source, and tamper evidence', () => {
    const filtered = filterSecretsBrokerAuditEvents(secretsBrokerAuditEvents, {
      type: 'migration_completed',
      outcome: 'success',
      provider: 'vault',
      tamperEvidence: 'verified',
      query: 'billing-worker',
      since: '2026-05-07T18:00:00Z',
      until: '2026-05-07T18:30:00Z',
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0]).toMatchObject({
      type: 'migration_completed',
      outcome: 'success',
      provider: 'vault',
      auditReason: 'approved backend migration',
    })
  })

  it('models broken and unavailable tamper-evidence states without payloads', () => {
    expect(
      filterSecretsBrokerAuditEvents(secretsBrokerAuditEvents, {
        tamperEvidence: 'broken',
      })[0].tamperEvidence.note
    ).toMatch(/investigation required/i)

    const unavailable = filterSecretsBrokerAuditEvents(
      secretsBrokerAuditEvents,
      {
        tamperEvidence: 'unavailable',
      }
    )[0]
    expect(unavailable.tamperEvidence.sequence).toBeNull()
    expect(unavailable.tamperEvidence.note).toMatch(/auth-required/i)
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
