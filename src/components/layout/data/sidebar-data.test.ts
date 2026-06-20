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

    expect(titles).not.toContain('Support Bundle')
    expect(titles).not.toContain('Fleet Overview')
    expect(titles).not.toContain('ZITADEL Session')
    expect(titles).not.toContain('Provider Connections')
    expect(titles).not.toContain('Single Reveal')
    expect(titles).not.toContain('Configuration')
    expect(titles).not.toContain('Workflow Boundaries')
    expect(titles).not.toContain('Diagnostics')
    expect(titles).not.toContain('Secret Inventory')
    expect(titles).not.toContain('Policy Simulation')
    expect(titles).not.toContain('Backup / Keys')
    expect(titles).not.toContain('Audit / Events')
    expect(titles).toContain('Providers')
  })

  it('links visible Secrets Broker sub-items without presenting Backup / Keys as a separate page', () => {
    const secretsBrokerGroup = sidebarData.navGroups.find(
      (group) => group.title === 'Secrets Broker'
    )

    expect(secretsBrokerGroup?.items.map((item) => item.url)).toEqual([
      '/secrets-broker',
      '/secrets-broker/secrets',
      '/secrets-broker/operational-controls',
      '/secrets-broker/sources',
      '/secrets-broker/topology',
    ])
    expect(
      secretsBrokerGroup?.items.every((item) => !item.url?.includes('#'))
    ).toBe(true)
  })

  it('exposes Operations telemetry and audit pages as first-class routes', () => {
    const operationsGroup = sidebarData.navGroups.find(
      (group) => group.title === 'Operations'
    )

    expect(operationsGroup?.items.map((item) => item.url)).toEqual([
      '/operations/telemetry',
      '/operations/audit-logging',
    ])
    expect(operationsGroup?.items.map((item) => item.title)).toEqual([
      'Telemetry',
      'Audit Logging',
    ])
  })
})
