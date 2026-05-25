import { describe, expect, it } from 'vitest'
import { sidebarData } from './sidebar-data'

function collectNavTitles() {
  return sidebarData.navGroups.flatMap((group) =>
    group.items.flatMap((item) => [
      item.title,
      ...(item.items?.map((child) => child.title) ?? []),
    ])
  )
}

describe('sidebar optional page classification', () => {
  it('keeps only current optional pages in primary navigation', () => {
    const titles = collectNavTitles()

    expect(titles).toContain('Support Bundle')
    expect(titles).not.toContain('Fleet Overview')
    expect(titles).not.toContain('ZITADEL Session')
    expect(titles).not.toContain('Policy Simulation')
  })
})
