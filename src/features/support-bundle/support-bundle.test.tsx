import { renderRoute } from '@/test/render-route'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  buildSupportBundlePayload,
  redactDiagnosticText,
  supportBundleHasSecretMaterial,
} from './support-bundle'

describe('support bundle export surface', () => {
  it('renders support bundle preview sections and warning before export', async () => {
    await renderRoute('/support-bundle')

    expect(
      await screen.findByRole('heading', { name: /Support bundle export/i })
    ).toBeVisible()
    expect(screen.getByText(/Review before sharing/i)).toBeVisible()
    expect(screen.getByText(/Secret-safe diagnostics/i)).toBeVisible()
    expect(screen.getAllByText(/Service inventory/i)[0]).toBeVisible()
    expect(
      screen.getAllByText(/Runtime and health summaries/i)[0]
    ).toBeVisible()
    expect(
      screen.getAllByText(/Secrets Broker source statuses/i)[0]
    ).toBeVisible()
    expect(screen.getAllByText(/Recent redacted errors/i)[0]).toBeVisible()
    expect(screen.getByText(/Machine-readable manifest/i)).toBeVisible()
    expect(screen.getAllByText(/secret-safe-by-default/i)[0]).toBeVisible()
  })

  it('prepares a local payload without rendering raw secret-like values', async () => {
    const user = userEvent.setup()
    await renderRoute('/support-bundle')

    await user.click(
      screen.getByRole('button', { name: /Prepare export manifest/i })
    )

    const preparedPayload = screen.getByLabelText(/Prepared support bundle/i)
    expect(preparedPayload).toBeVisible()
    expect(
      within(preparedPayload).getByText(/\[REDACTED_SECRET\]/i)
    ).toBeVisible()
    expect(
      within(preparedPayload).getByText(/\[REDACTED_AUTHORIZATION\]/i)
    ).toBeVisible()
    expect(
      screen.queryByText(/provider-login-needed|session-cookie-placeholder/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/bearer\s+[a-z0-9._~+/=-]+\.[a-z0-9._~+/=-]+/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/-----BEGIN PRIVATE KEY-----/i)
    ).not.toBeInTheDocument()
  })

  it('redacts common secret-like diagnostic values', () => {
    const redacted = redactDiagnosticText(
      'authorization=ok bearer abc.def.ghi api_key=sk_test_canary password=hunter2 cookie=session-canary -----BEGIN PRIVATE KEY-----abc-----END PRIVATE KEY-----'
    )

    expect(redacted).toContain('[REDACTED_AUTHORIZATION]')
    expect(redacted).toContain('api_key=[REDACTED_SECRET]')
    expect(redacted).toContain('password=[REDACTED_SECRET]')
    expect(redacted).toContain('cookie=[REDACTED_SECRET]')
    expect(redacted).toContain('[REDACTED_PRIVATE_KEY]')
    expect(redacted).not.toContain('sk_test_canary')
    expect(redacted).not.toContain('hunter2')
    expect(redacted).not.toContain('session-canary')
  })

  it('keeps generated support bundle fixtures free of secret material', () => {
    const payload = buildSupportBundlePayload()

    expect(payload.manifest.sections).toHaveLength(6)
    expect(payload.manifest.redactionPolicy.mode).toBe('secret-safe-by-default')
    expect(supportBundleHasSecretMaterial(payload)).toBe(false)
  })
})
