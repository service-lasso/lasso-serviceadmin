import { describe, expect, it } from 'vitest'
import { sidebarData } from './sidebar-data'

describe('sidebar navigation data', () => {
  it('labels the primary operator section as Service Admin without changing child routes', () => {
    const serviceAdminGroup = sidebarData.navGroups[0]

    expect(serviceAdminGroup.title).toBe('Service Admin')
    expect(serviceAdminGroup.items.map((item) => item.url)).toEqual([
      '/',
      '/services',
      '/fleet-overview',
      '/dependencies',
      '/logs',
      '/runtime',
      '/installed',
      '/variables',
      '/auth-session',
      '/support-bundle',
      '/network',
    ])
  })
})

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
