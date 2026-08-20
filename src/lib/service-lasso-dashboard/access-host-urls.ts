import type { ServiceEndpoint, ServiceLink } from './types'

type AccessLocation = Pick<Location, 'protocol' | 'hostname' | 'host'>

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function currentAccessLocation(): AccessLocation | undefined {
  if (typeof window === 'undefined') return undefined
  return window.location
}

function normalizeHostname(hostname: string) {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, '$1')
}

function isLoopbackHost(hostname: string) {
  return loopbackHosts.has(normalizeHostname(hostname))
}

function isHttpUrl(url: URL) {
  return url.protocol === 'http:' || url.protocol === 'https:'
}

function shouldRewriteAccessHost(
  url: URL,
  accessLocation: AccessLocation | undefined
) {
  if (!accessLocation) return false
  if (!isHttpUrl(url)) return false
  if (!isLoopbackHost(url.hostname)) return false
  return !isLoopbackHost(accessLocation.hostname)
}

export function renderAccessHostUrl(
  url: string,
  accessLocation = currentAccessLocation()
) {
  try {
    const parsed = new URL(url)

    if (!accessLocation || !shouldRewriteAccessHost(parsed, accessLocation)) {
      return url
    }

    parsed.hostname = accessLocation.hostname
    return parsed.toString()
  } catch {
    return url
  }
}

function isServiceLink(link: ServiceLink) {
  return link.kind !== 'docs'
}

export function renderServiceLinkUrl(
  link: ServiceLink,
  accessLocation = currentAccessLocation()
) {
  if (!isServiceLink(link)) return link.url
  return renderAccessHostUrl(link.url, accessLocation)
}

export function renderServiceEndpointUrl(
  endpoint: ServiceEndpoint,
  accessLocation = currentAccessLocation()
) {
  return renderAccessHostUrl(endpoint.url, accessLocation)
}
