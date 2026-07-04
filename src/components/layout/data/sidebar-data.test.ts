import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { helpCenterNavigationCoverage } from '@/features/help-center/navigation-coverage'
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

function collectNavRoutes() {
  return sidebarData.navGroups.flatMap((group) =>
    group.items.flatMap((item) => [
      ...(item.url ? [item.url] : []),
      ...(item.items?.flatMap((child) => (child.url ? [child.url] : [])) ?? []),
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
    expect(titles).not.toContain('Operational Controls')
    expect(titles).toContain('Providers')
  })

  it('links visible Secrets Broker sub-items without presenting Backup / Keys as a separate page', () => {
    const secretsBrokerGroup = sidebarData.navGroups.find(
      (group) => group.title === 'Secrets Broker'
    )

    expect(secretsBrokerGroup?.items.map((item) => item.url)).toEqual([
      '/secrets-broker',
      '/secrets-broker/secrets',
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
      'Audit',
    ])
  })
})

describe('Help Center navigation coverage', () => {
  it('keeps every primary navigation route covered by a doc or explicit exception', () => {
    const routes = collectNavRoutes()
    const coverageByRoute = new Map(
      helpCenterNavigationCoverage.map((entry) => [entry.route, entry])
    )

    expect([...coverageByRoute.keys()].sort()).toEqual([...routes].sort())

    for (const route of routes) {
      const coverage = coverageByRoute.get(route)

      expect(coverage).toBeDefined()
      expect(
        Boolean(coverage?.articleId) !== Boolean(coverage?.exception)
      ).toBe(true)

      if (coverage?.articleId) {
        const articlePath = join(process.cwd(), 'docs', coverage.articleId)

        expect(existsSync(articlePath)).toBe(true)
      }

      if (coverage?.exception) {
        expect(coverage.exception.issue).toMatch(
          /^service-lasso\/lasso-serviceadmin#\d+$/
        )
        expect(coverage.exception.reason.trim().length).toBeGreaterThan(24)
      }
    }
  })
})
