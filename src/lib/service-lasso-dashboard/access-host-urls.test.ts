import { describe, expect, it } from 'vitest'
import {
  renderAccessHostUrl,
  renderServiceEndpointUrl,
  renderServiceLinkUrl,
} from './access-host-urls'
import type { ServiceEndpoint, ServiceLink } from './types'

const remoteIp = {
  protocol: 'http:',
  hostname: '192.168.1.53',
  host: '192.168.1.53:17700',
} as Location

const remoteHostname = {
  protocol: 'https:',
  hostname: 'admin.service-lasso.lan',
  host: 'admin.service-lasso.lan',
} as Location

const localHost = {
  protocol: 'http:',
  hostname: 'localhost',
  host: 'localhost:17700',
} as Location

function endpoint(url: string): ServiceEndpoint {
  return {
    label: 'ui',
    url,
    bind: '0.0.0.0',
    port: 17700,
    protocol: 'http',
    exposure: 'local',
  }
}

function link(url: string, kind: ServiceLink['kind'] = 'local'): ServiceLink {
  return {
    label: 'Local',
    url,
    kind,
  }
}

describe('access host URL rendering', () => {
  it('rewrites loopback service endpoints to the browser access IP', () => {
    expect(
      renderServiceEndpointUrl(
        endpoint('http://127.0.0.1:17700/services?tab=all#top'),
        remoteIp
      )
    ).toBe('http://192.168.1.53:17700/services?tab=all#top')
  })

  it('rewrites loopback service links to the browser access hostname', () => {
    expect(
      renderServiceLinkUrl(
        link('http://localhost:17883/api/health'),
        remoteHostname
      )
    ).toBe('http://admin.service-lasso.lan:17883/api/health')
  })

  it('keeps loopback URLs unchanged when Service Admin is opened locally', () => {
    expect(renderAccessHostUrl('http://127.0.0.1:17700', localHost)).toBe(
      'http://127.0.0.1:17700'
    )
  })

  it('does not rewrite external service URLs', () => {
    expect(renderAccessHostUrl('https://traefik.localtest.me', remoteIp)).toBe(
      'https://traefik.localtest.me'
    )
  })

  it('does not rewrite documentation or download links', () => {
    expect(
      renderServiceLinkUrl(
        link('http://127.0.0.1:8080/download.html', 'docs'),
        remoteIp
      )
    ).toBe('http://127.0.0.1:8080/download.html')
  })
})
