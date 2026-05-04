import { describe, expect, it } from 'vitest'
import {
  buildApiUsageEdge,
  buildDependencyEdge,
  buildServiceNodeStyle,
  categoryNodeColor,
  getGraphCategory,
  getServiceNodeImage,
} from './service-graph'
import type { DashboardService } from './service-lasso-dashboard/types'

describe('service graph helpers', () => {
  it.each([
    ['ui-admin', 'app'],
    ['node-runtime', 'runtime'],
    ['core-platform', 'infrastructure'],
    ['utility-tool', 'utility'],
    ['identity-provider', 'security'],
    ['workflow-engine', 'workflow'],
    ['unknown', 'other'],
  ] as const)('maps %s to %s', (serviceType, category) => {
    expect(getGraphCategory(serviceType)).toBe(category)
  })

  it('provides stable category colors for graph legends', () => {
    expect(categoryNodeColor('app')).toBe('#0ea5e9')
    expect(categoryNodeColor('security')).toBe('#d97706')
    expect(categoryNodeColor('other')).toBe('#6b7280')
  })

  it('builds selected and unselected node styles for light and dark themes', () => {
    expect(
      buildServiceNodeStyle({ selected: true, isDark: false })
    ).toMatchObject({
      border: '2px solid #16a34a',
      background: '#dcfce7',
    })
    expect(
      buildServiceNodeStyle({ selected: false, isDark: true })
    ).toMatchObject({
      border: '1px solid #334155',
      background: '#0f172a',
    })
  })

  it('builds dependency and api usage edges with expected direction and labels', () => {
    expect(
      buildDependencyEdge({
        id: 'traefik->serviceadmin',
        source: 'traefik',
        target: '@serviceadmin',
        selected: true,
        isDark: false,
      })
    ).toMatchObject({
      id: 'traefik->serviceadmin',
      source: 'traefik',
      target: '@serviceadmin',
      label: 'depends_on',
      animated: true,
    })

    expect(
      buildApiUsageEdge({
        id: 'serviceadmin->ui',
        source: '@serviceadmin',
        target: 'ui',
        isDark: true,
        label: 'child_of',
      })
    ).toMatchObject({
      id: 'serviceadmin->ui',
      source: '@serviceadmin',
      target: 'ui',
      label: 'child_of',
      animated: true,
    })
  })

  it('resolves public service icon URLs without importing from the public directory', () => {
    const service = {
      id: '@serviceadmin',
      name: 'Service Admin UI',
      metadata: {},
    } as DashboardService

    expect(getServiceNodeImage(service, false)).toBe(
      '/images/services/service-admin.svg'
    )
    expect(
      getServiceNodeImage(
        {
          ...service,
          id: 'zitadel',
          name: 'ZITADEL',
        },
        true
      )
    ).toBe('/images/services/zitadel_dark.svg')
  })
})
