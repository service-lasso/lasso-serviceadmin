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
