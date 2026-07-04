import { renderRoute } from '@/test/render-route'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAuditSummary } from './index'

describe('Operations pages', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('renders telemetry rows for Service Lasso and Secrets Broker without secret material', async () => {
    const { container } = await renderRoute('/operations/telemetry')

    expect(
      await screen.findByRole('heading', { name: /^Telemetry$/i })
    ).toBeVisible()
    expect(screen.getAllByText(/Service Lasso runtime/i)[0]).toBeVisible()
    const telemetryState = await screen.findByText(
      /Core telemetry (exporter|preview)/i
    )
    expect(telemetryState).toBeVisible()

    if (/exporter/i.test(telemetryState.textContent ?? '')) {
      expect(screen.getByText(/otlp-http disabled/i)).toBeVisible()
      expect(screen.getByText(/endpoint hidden=true/i)).toBeVisible()
      expect(screen.getByText(/API request buffer safety/i)).toBeVisible()
      expect(screen.getByText(/route templates only=true/i)).toBeVisible()
      expect(screen.getByText(/API request summary/i)).toBeVisible()
      expect(screen.getByText(/21 observed/i)).toBeVisible()
      expect(screen.getByText(/Core trace propagation/i)).toBeVisible()
      expect(screen.getByText(/raw headers returned=false/i)).toBeVisible()
      expect(screen.getByText(/Core-to-broker correlation/i)).toBeVisible()
      expect(screen.getByText(/broker trace context=true/i)).toBeVisible()
      expect(
        await screen.findByText(/Secrets Broker service trace context/i)
      ).toBeVisible()
      expect(await screen.findByText(/w3c traceparent=true/i)).toBeVisible()
      expect(
        await screen.findByText(/Secrets Broker telemetry safe envelope/i)
      ).toBeVisible()
      expect(screen.getByText(/unsafe keys returned=false/i)).toBeVisible()
      const [hiddenBoundary] = screen.getAllByText(/Hidden/i)
      expect(hiddenBoundary).toBeVisible()
    } else {
      expect(
        screen.getAllByText(/Verify the Service Lasso runtime/i)[0]
      ).toBeVisible()
    }
    expect(container).not.toHaveTextContent(/BEGIN PRIVATE KEY/i)
    expect(container).not.toHaveTextContent(/CLIENT_SECRET=/i)
    expect(container).not.toHaveTextContent(/REFRESH_TOKEN=/i)
    expect(container).not.toHaveTextContent(/OTEL_EXPORTER_OTLP_HEADERS/i)
    expect(container).not.toHaveTextContent(/Authorization/i)
    expect(container).not.toHaveTextContent(/http:\/\/otel-collector/i)
    expect(container).not.toHaveTextContent(/ACTUAL_SECRET/i)
    expect(container).not.toHaveTextContent(/BOT_TOKEN=/i)
  })

  it('renders audit rows from both operation sources without secret payloads', async () => {
    const { container } = await renderRoute('/operations/audit-logging')

    expect(
      await screen.findByRole('heading', { name: /^Audit$/i })
    ).toBeVisible()
    expect(container).not.toHaveTextContent(/Audit Logging/i)
    expect(screen.getByText(/runtime health checked/i)).toBeVisible()
    expect(screen.getByText(/resolve granted/i)).toBeVisible()
    expect(screen.getByText(/Fixture preview/i)).toBeVisible()
    expect(screen.getAllByText(/audit events/i)[0]).toBeVisible()
    expect(screen.getByText(/Durable operator actions/i)).toBeVisible()
    expect(screen.getByText(/rawMaterialReturned=false/i)).toBeVisible()
    expect(screen.getAllByText(/mixed/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Service Lasso/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Secrets Broker/i)[0]).toBeVisible()
    expect(screen.getByText(/tamper-evidence status only/i)).toBeVisible()
    expect(container).not.toHaveTextContent(/DEMO_REVEAL_VALUE_42/i)
    expect(container).not.toHaveTextContent(/ACTUAL_SECRET/i)
    expect(container).not.toHaveTextContent(/BOT_TOKEN=/i)
  })

  it('prefers live Secrets Broker audit rows and drops unsafe payload fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/services/%40secretsbroker/proxy/v1/audit/events') {
          return new Response(
            JSON.stringify({
              state: 'ready',
              summary: 'Live broker audit metadata available.',
              rawMaterialReturned: false,
              events: [
                {
                  id: 'audit-live-secret-rotation',
                  eventType: 'secret_rotated',
                  actorType: 'operator',
                  actorId: 'serviceadmin',
                  outcome: 'success',
                  policyDecision: 'allow: audited rotation metadata only',
                  chainStatus: 'verified',
                  recordedAt: '2026-07-05T06:31:00Z',
                  summary: 'Rotation completed with safe audit metadata.',
                  rawValue: 'DEMO_REVEAL_VALUE_42',
                  providerToken: 'provider-token-must-not-render',
                },
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      })
    )

    const { container } = await renderRoute('/operations/audit-logging', {
      stubData: false,
    })

    expect(await screen.findByText(/Live runtime audit/i)).toBeVisible()
    expect(screen.getByText(/secret rotated/i)).toBeVisible()
    expect(
      screen.getByText(/allow: audited rotation metadata only/i)
    ).toBeVisible()
    expect(screen.queryByText(/resolve granted/i)).not.toBeInTheDocument()
    expect(container).not.toHaveTextContent(/DEMO_REVEAL_VALUE_42/i)
    expect(container).not.toHaveTextContent(/provider-token-must-not-render/i)
  })

  it('summarizes live audit card state from safe metadata', () => {
    const summary = buildAuditSummary(
      [
        {
          id: 'audit-live-1',
          event: 'policy changed',
          source: 'Service Lasso',
          actor: 'operator: serviceadmin',
          outcome: 'success',
          policy: 'metadata-only policy changed',
          tamperEvidence: 'verified',
          recordedAt: '2026-05-07T18:20:00Z',
          safeSummary: 'Policy metadata changed without raw material.',
        },
      ],
      'live'
    )

    expect(summary).toMatchObject({
      sourceLabel: 'Live runtime audit',
      eventCount: 1,
      mutatingActionCount: 1,
      chainStatus: 'verified',
      rawMaterialLabel: 'Hidden',
      rawMaterialReturned: false,
    })
  })

  it('summarizes unavailable and empty audit states without claiming coverage', () => {
    expect(buildAuditSummary([], 'unavailable')).toMatchObject({
      sourceLabel: 'Unavailable',
      eventCount: 0,
      mutatingActionCount: 0,
      chainStatus: 'unavailable',
      rawMaterialLabel: 'Hidden',
    })

    expect(buildAuditSummary([], 'fixture')).toMatchObject({
      sourceLabel: 'Fixture preview',
      eventCount: 0,
      mutatingActionCount: 0,
      chainStatus: 'unavailable',
    })
  })

  it('summarizes fixture chain states as mixed when proofs differ', () => {
    const summary = buildAuditSummary([
      {
        id: 'audit-fixture-1',
        event: 'runtime health checked',
        source: 'Service Lasso',
        actor: 'serviceadmin:operator-view',
        outcome: 'success',
        policy: 'metadata-only runtime status read',
        tamperEvidence: 'verified',
        recordedAt: '2026-05-07T18:20:00Z',
        safeSummary: 'Runtime health was viewed without raw material.',
      },
      {
        id: 'audit-fixture-2',
        event: 'session token revoked',
        source: 'Secrets Broker',
        actor: 'cli-session: rotated',
        outcome: 'revoked',
        policy: 'metadata-only session revoked',
        tamperEvidence: 'broken',
        recordedAt: '2026-05-07T18:21:00Z',
        safeSummary: 'Session credential metadata was retained for review.',
      },
    ])

    expect(summary).toMatchObject({
      sourceLabel: 'Fixture preview',
      eventCount: 2,
      mutatingActionCount: 1,
      chainStatus: 'mixed',
      rawMaterialReturned: false,
    })
  })
})
