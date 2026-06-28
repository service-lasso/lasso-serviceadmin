import { renderRoute } from '@/test/render-route'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('Operations pages', () => {
  it('renders telemetry rows for Service Lasso and Secrets Broker without secret material', async () => {
    const { container } = await renderRoute('/operations/telemetry')

    expect(
      await screen.findByRole('heading', { name: /^Telemetry$/i })
    ).toBeVisible()
    expect(screen.getByText(/Service Lasso runtime/i)).toBeVisible()
    expect(await screen.findByText(/Core telemetry exporter/i)).toBeVisible()
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
    expect(screen.getAllByText(/Service Lasso/i)[0]).toBeVisible()
    expect(screen.getAllByText(/Secrets Broker/i)[0]).toBeVisible()
    expect(screen.getByText(/tamper-evidence status only/i)).toBeVisible()
    expect(container).not.toHaveTextContent(/DEMO_REVEAL_VALUE_42/i)
    expect(container).not.toHaveTextContent(/ACTUAL_SECRET/i)
    expect(container).not.toHaveTextContent(/BOT_TOKEN=/i)
  })
})
