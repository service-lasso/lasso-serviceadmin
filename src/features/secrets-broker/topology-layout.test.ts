import { describe, expect, it } from 'vitest'
import type {
  DashboardService,
  ServiceEnvironmentVariable,
} from '@/lib/service-lasso-dashboard/types'
import {
  buildSecretsBrokerTopology,
  DEFAULT_TOPOLOGY_LAYOUT_BOUNDS,
  layoutSecretsBrokerTopologyPositions,
  toReactFlowSecretsBrokerTopology,
  type SecretsBrokerTopologyNode,
} from './topology'

function mappedVariable(
  key: string,
  serviceId: string
): ServiceEnvironmentVariable {
  return {
    key,
    value: `secret://services/${serviceId}/${key.toLowerCase()}`,
    scope: 'service',
    secret: true,
    source: '@secretsbroker/local/default',
  }
}

function testService(
  id: string,
  variables: ServiceEnvironmentVariable[]
): DashboardService {
  return {
    id,
    name: id,
    status: 'running',
    favorite: false,
    note: '',
    links: [],
    installed: true,
    role: 'test',
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '1m',
      lastCheckAt: '2026-08-19T00:00:00Z',
      summary: 'Healthy',
    },
    endpoints: [],
    metadata: {
      serviceType: 'api',
      runtime: 'node',
      version: 'test',
      build: 'test',
    },
    dependencies: [],
    dependents: [],
    environmentVariables: variables,
    recentLogs: [],
    actions: [],
  }
}

function positionSpan(
  positions: Array<{ x: number; y: number }>,
  axis: 'x' | 'y'
) {
  const values = positions.map((position) => position[axis])
  return Math.max(...values) - Math.min(...values)
}

function nodesOfKind(
  nodes: SecretsBrokerTopologyNode[],
  kind: SecretsBrokerTopologyNode['kind']
) {
  return nodes.filter((node) => node.kind === kind)
}

describe('Mapping graph layout', () => {
  it('spreads same-rank nodes across pane width instead of one X column', () => {
    const services = Array.from({ length: 12 }, (_value, index) => {
      const id = `svc-${String(index + 1).padStart(2, '0')}`
      return testService(id, [mappedVariable('API_TOKEN', id)])
    })
    const topology = buildSecretsBrokerTopology(services)
    const variableNodes = nodesOfKind(topology.nodes, 'variable')
    expect(variableNodes.length).toBeGreaterThan(1)

    const positions = layoutSecretsBrokerTopologyPositions(topology.nodes, {
      bounds: { width: 1400, height: 780 },
      rankdir: 'TB',
    })
    const variableXs = new Set(
      variableNodes.map((node) => {
        const position = positions.get(node.id)
        return position ? position.x : Number.NaN
      })
    )

    expect(variableXs.has(Number.NaN)).toBe(false)
    expect(variableXs.size).toBeGreaterThan(1)
  })

  it('uses a wider X span when the pane is wider', () => {
    const services = Array.from({ length: 10 }, (_value, index) => {
      const id = `wide-${String(index + 1)}`
      return testService(id, [mappedVariable('SECRET_KEY', id)])
    })
    const topology = buildSecretsBrokerTopology(services)

    const narrow = toReactFlowSecretsBrokerTopology(topology, {
      bounds: { width: 480, height: 720 },
    })
    const wide = toReactFlowSecretsBrokerTopology(topology, {
      bounds: { width: 1440, height: 720 },
    })

    const narrowSpan = positionSpan(
      narrow.nodes.map((node) => node.position),
      'x'
    )
    const wideSpan = positionSpan(
      wide.nodes.map((node) => node.position),
      'x'
    )

    expect(wideSpan).toBeGreaterThan(narrowSpan)
    expect(wideSpan).toBeGreaterThan(900)
  })

  it('falls back to the default canvas size before ResizeObserver measures', () => {
    const topology = buildSecretsBrokerTopology([
      testService('admin-api', [
        mappedVariable('ADMIN_API_TOKEN', 'admin-api'),
      ]),
    ])
    const unmeasured = toReactFlowSecretsBrokerTopology(topology, {
      bounds: { width: 0, height: 0 },
    })
    const defaults = toReactFlowSecretsBrokerTopology(topology, {
      bounds: {
        width: DEFAULT_TOPOLOGY_LAYOUT_BOUNDS.width,
        height: DEFAULT_TOPOLOGY_LAYOUT_BOUNDS.height,
      },
    })

    expect(unmeasured.nodes.map((node) => node.position)).toEqual(
      defaults.nodes.map((node) => node.position)
    )
  })

  it('keeps kind on graph node data and omits secret values', () => {
    const topology = buildSecretsBrokerTopology([
      testService('admin-api', [
        mappedVariable('ADMIN_API_TOKEN', 'admin-api'),
        {
          key: 'UNMAPPED_PASSWORD',
          value: 'plain-text-password-value',
          scope: 'service',
          source: 'service.json',
        },
      ]),
    ])
    const graph = toReactFlowSecretsBrokerTopology(topology, {
      bounds: { width: 1200, height: 700 },
    })
    const kinds = graph.nodes.map((node) => node.data.kind)

    expect(kinds.includes('variable')).toBe(true)
    expect(kinds.includes('service')).toBe(true)
    expect(
      graph.nodes.some((node) =>
        node.data.label.includes('plain-text-password-value')
      )
    ).toBe(false)
  })
})
