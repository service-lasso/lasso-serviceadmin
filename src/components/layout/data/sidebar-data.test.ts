import { describe, expect, it } from 'vitest'
import { sidebarData } from './sidebar-data'

describe('sidebar navigation data', () => {
  it('labels the primary operator section as Service Admin without restoring optional child routes', () => {
    const serviceAdminGroup = sidebarData.navGroups[0]

    expect(serviceAdminGroup.title).toBe('Service Admin')
    expect(serviceAdminGroup.items.map((item) => item.url)).toEqual([
      '/',
      '/services',
      '/dependencies',
      '/service-routes',
      '/logs',
      '/runtime',
      '/installed',
      '/variables',
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
    expect(titles).toContain('Policy Simulation')
  })

  it('links visible Secrets Broker sub-items to route-backed pages only', () => {
    const secretsBrokerGroup = sidebarData.navGroups.find(
      (group) => group.title === 'Secrets Broker'
    )

    expect(secretsBrokerGroup?.items.map((item) => item.url)).toEqual([
      '/secrets-broker',
      '/secrets-broker/secrets',
      '/secrets-broker/configuration',
      '/secrets-broker/sources',
      '/secrets-broker/provider-connections',
      '/secrets-broker/single-reveal',
      '/secrets-broker/backup-keys',
      '/secrets-broker/workflow-boundaries',
      '/secrets-broker/topology',
      '/secrets-broker/audit-events',
      '/secrets-broker/diagnostics',
      '/secrets-broker/secret-inventory',
      '/secrets-broker/policy-simulation',
    ])
    expect(
      secretsBrokerGroup?.items.every((item) => !item.url?.includes('#'))
    ).toBe(true)
  })
})
