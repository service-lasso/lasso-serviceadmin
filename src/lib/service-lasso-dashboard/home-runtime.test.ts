import { describe, expect, it } from 'vitest'
import {
  parseFleetMetricsPayload,
  parseNetworkHomePayload,
  parseRuntimeInstanceHome,
} from './home-runtime'

describe('home runtime parsers', () => {
  it('parses fleet metrics without echoing secret-looking fields', () => {
    const parsed = parseFleetMetricsPayload({
      services: [
        {
          serviceId: '@serviceadmin',
          process: {
            running: false,
            crashCount: 1,
            lastTermination: 'crashed',
          },
          logs: {
            current: {
              stdoutLines: 1,
              stderrLines: 0,
            },
          },
        },
      ],
    })

    expect(parsed).toEqual([
      {
        serviceId: '@serviceadmin',
        running: false,
        crashCount: 1,
        lastTermination: 'crashed',
        stdoutLines: 1,
        stderrLines: 0,
      },
    ])
  })

  it('drops malformed metrics rows instead of throwing', () => {
    expect(parseFleetMetricsPayload({ services: [{ serviceId: 1 }] })).toEqual(
      []
    )
    expect(parseFleetMetricsPayload(null)).toBeNull()
  })

  it('parses generation lane fields from the instance snapshot', () => {
    const parsed = parseRuntimeInstanceHome({
      instance: { phase: 'running' },
      registry: { staleCount: 96 },
      generations: { activeGenerationId: 'abc123def456' },
      selection: { classification: 'selected' },
    })

    expect(parsed).toEqual({
      phase: 'running',
      activeGenerationId: 'abc123def456',
      classification: 'selected',
      staleCount: 96,
    })
  })

  it('parses network endpoints for Traefik reserved-route counting', () => {
    const parsed = parseNetworkHomePayload({
      services: [
        {
          serviceId: '@traefik',
          endpoints: [
            { label: 'web', port: 19080, bind: '0.0.0.0', kind: 'http' },
            { label: 'reserved CMS', port: 18443 },
          ],
        },
      ],
    })

    expect(parsed).toEqual([
      {
        serviceId: '@traefik',
        label: 'web',
        port: 19080,
        bind: '0.0.0.0',
        kind: 'http',
      },
      {
        serviceId: '@traefik',
        label: 'reserved CMS',
        port: 18443,
        bind: null,
        kind: null,
      },
    ])
  })
})
