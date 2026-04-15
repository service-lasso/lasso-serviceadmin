import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderRoute } from './render-route'

type ScreenCase = {
  path: string
  marker: RegExp
}

const authScreens: ScreenCase[] = [
  { path: '/sign-in', marker: /^Sign in$/i },
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
