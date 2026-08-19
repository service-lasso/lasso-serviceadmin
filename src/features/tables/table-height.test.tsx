import { renderRoute } from '@/test/render-route'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

/**
 * Operator tables should fill remaining page height and keep pagination
 * outside the scroll region so the body scrollbar sits above it.
 */
const tablePages = [
  { path: '/services', identity: 'Services' },
  { path: '/installed', identity: 'Installed' },
  { path: '/runtime', identity: 'Runtime' },
  { path: '/network', identity: 'Network' },
  { path: '/variables', identity: 'Variables' },
  { path: '/secrets-broker/review', identity: 'Review' },
  { path: '/secrets-broker/sources', identity: 'Providers' },
] as const

describe('full-height table layout', () => {
  it.each(tablePages)(
    'scrolls $identity table body above pagination',
    async ({ path }) => {
      await renderRoute(path)

      await waitFor(() => {
        expect(
          screen.getByTestId(
            path === '/variables'
              ? 'variables-table-scroll-region'
              : 'data-table-scroll-region'
          )
        ).toBeVisible()
      })

      const scrollRegion = screen.getByTestId(
        path === '/variables'
          ? 'variables-table-scroll-region'
          : 'data-table-scroll-region'
      )
      expect(scrollRegion).toHaveClass('flex-1')
      expect(scrollRegion).toHaveClass('overflow-auto')
      expect(scrollRegion).toHaveClass('min-h-[320px]')
      expect(screen.getByRole('button', { name: /next page/i })).toBeVisible()
      expect(
        scrollRegion.contains(
          screen.getByRole('button', { name: /next page/i })
        )
      ).toBe(false)
    }
  )
})
