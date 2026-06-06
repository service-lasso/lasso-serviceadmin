import { renderRoute } from '@/test/render-route'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { secretsBrokerDiagnostics } from '../secrets-broker/diagnostics'
import {
  buildSupportBundleReview,
  redactDiagnosticText,
  supportBundleReviewHasSecretMaterial,
} from './support-bundle'

describe('support bundle diagnostics action', () => {
  it('renders as a compact diagnostics action instead of a standalone export page', async () => {
    await renderRoute('/secrets-broker/diagnostics')

    expect(
      await screen.findByRole('heading', {
        name: /Secrets Broker diagnostics/i,
      })
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: /Support bundle export action/i })
    ).toBeVisible()
    expect(screen.getByText(/Export endpoint unavailable/i)).toBeVisible()
    expect(
      screen.getByText(/No sample bundle or fixture payload is generated here/i)
    ).toBeVisible()
    expect(screen.getByText(/Configuration diagnostics/i)).toBeVisible()
    expect(screen.getByText(/Runtime diagnostics/i)).toBeVisible()
    expect(screen.getByText(/Authentication diagnostics/i)).toBeVisible()
    expect(screen.getByText(/Permission diagnostics/i)).toBeVisible()
    expect(screen.getByText(/Redaction policy/i)).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: /Download support bundle unavailable/i,
      })
    ).toBeDisabled()
    expect(
      screen.queryByText(/Machine-readable manifest/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/Prepared support bundle payload/i)
    ).not.toBeInTheDocument()
  })

  it('redirects the legacy standalone route to diagnostics', async () => {
    await renderRoute('/support-bundle')

    expect(
      await screen.findByRole('heading', {
        name: /Secrets Broker diagnostics/i,
      })
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: /Support bundle export action/i })
    ).toBeVisible()
    expect(
      screen.queryByText(/Machine-readable manifest/i)
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

  it('keeps the diagnostics review free of secret material', () => {
    const review = buildSupportBundleReview(
      secretsBrokerDiagnostics.map((diagnostic) => ({
        category: diagnostic.category,
        status: diagnostic.status,
      }))
    )

    expect(review.exportAvailability.state).toBe('unavailable')
    expect(review.sections.some((section) => section.id === 'redaction')).toBe(
      true
    )
    expect(supportBundleReviewHasSecretMaterial(review)).toBe(false)
  })
})
