import { renderRoute } from '@/test/render-route'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('Operations pages', () => {
  it('renders telemetry rows for Service Lasso and Secrets Broker with explicit unavailable state', async () => {
    const { container } = await renderRoute('/operations/telemetry')

    expect(
      await screen.findByRole('heading', { name: /^Telemetry$/i })
    ).toBeVisible()
    expect(screen.getByText(/Service Lasso runtime/i)).toBeVisible()
    expect(
      await screen.findByText(/Secrets Broker telemetry endpoint/i)
    ).toBeVisible()
    expect(
      await screen.findByText(/not configured in the current demo/i)
    ).toBeVisible()
    expect(screen.getByText(/No values/i)).toBeVisible()
    expect(container).not.toHaveTextContent(/BEGIN PRIVATE KEY/i)
    expect(container).not.toHaveTextContent(/CLIENT_SECRET=/i)
    expect(container).not.toHaveTextContent(/REFRESH_TOKEN=/i)
  })

  it('renders audit logging rows from both operation sources without secret payloads', async () => {
    const { container } = await renderRoute('/operations/audit-logging')

    expect(
      await screen.findByRole('heading', { name: /Audit Logging/i })
    ).toBeVisible()
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
