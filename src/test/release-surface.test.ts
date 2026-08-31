import { describe, expect, it } from 'vitest'
import { sidebarData } from '@/components/layout/data/sidebar-data'

function navigationTitles() {
  return sidebarData.navGroups.flatMap((group) =>
    group.items.flatMap((item) => [
      item.title,
      ...('items' in item && item.items
        ? item.items.map((child) => child.title)
        : []),
    ])
  )
}

describe('Release 1 Admin product surface', () => {
  it('keeps retired and preview-only decisions out of shipped navigation', () => {
    expect(navigationTitles()).not.toEqual(
      expect.arrayContaining([
        'Fleet',
        'Sessions',
        'Policy Simulation',
        'Support Bundle',
      ])
    )
  })

  it('ships the enforced security surface', () => {
    expect(navigationTitles()).toContain('Security')
  })
})
