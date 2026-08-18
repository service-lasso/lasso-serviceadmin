import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderRoute } from './render-route'

type ScreenCase = {
  path: string
  marker: RegExp
}

const authScreens: ScreenCase[] = [
  { path: '/sign-in', marker: /^Trusted Service Lasso access$/i },
  { path: '/sign-up', marker: /^Create an account$/i },
  { path: '/forgot-password', marker: /^Forgot Password$/i },
  { path: '/otp', marker: /^Two-factor Authentication$/i },
]

describe('auth screens', () => {
  it.each(authScreens)('renders $path', async ({ path, marker }) => {
    await renderRoute(path)

    const matches = await screen.findAllByText(marker)
    expect(matches[0]).toBeVisible()

    await waitFor(() => {
      expect(document.title).not.toContain('404')
    })
  })
})

describe('trusted Service Lasso sign-in boundary', () => {
  it('does not collect a password or create a browser-owned access token', async () => {
    await renderRoute('/sign-in')

    expect(
      await screen.findByText(/^Trusted Service Lasso access$/i)
    ).toBeVisible()
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
    expect(document.cookie).not.toContain('thisisjustarandomstring')
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })
})
