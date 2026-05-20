import { renderRoute } from '@/test/render-route'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('service routes page', () => {
  it('renders service endpoint inventory without secret material', async () => {
    await renderRoute('/service-routes')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service routes$/i })
      ).toBeVisible()
    })

    expect(await screen.findByText('Route inventory')).toBeVisible()
    expect(screen.getAllByText('Traefik')[0]).toBeVisible()
    expect(screen.getByText('Local dashboard')).toBeVisible()
    expect(screen.getByText('https://traefik.localtest.me')).toBeVisible()
    expect(screen.queryByText(/secret:\/\//i)).not.toBeInTheDocument()
    expect(screen.queryByText(/SESSION_SECRET/i)).not.toBeInTheDocument()
  })
})
