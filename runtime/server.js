import http from 'node:http'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const modulePath = fileURLToPath(import.meta.url)
const moduleDir = path.dirname(modulePath)
const packageRoot = path.resolve(moduleDir, '..')
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 17700
const MAX_REQUEST_BODY_BYTES = 1024 * 1024
const MAX_UPSTREAM_BODY_BYTES = 8 * 1024 * 1024
const ROTATION_PROXY_LIFECYCLE_SCHEMA =
  'service-admin.rotation-proxy-lifecycle.v1'
const rotationProxyLifecyclePhases = new Set([
  'upstream_started',
  'headers_received',
  'body_received',
  'downstream_closed',
])

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
])

function isLoopbackHost(host) {
  const normalized = String(host).trim().toLowerCase().replace(/^\[|\]$/g, '')
  return (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '0:0:0:0:0:0:0:1' ||
    normalized.startsWith('127.')
  )
}

function requiredLoopbackUrl(value) {
  const parsed = new URL(value)
  if (
    parsed.protocol !== 'http:' ||
    !isLoopbackHost(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    (parsed.pathname !== '/' && parsed.pathname !== '') ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Service Lasso runtime API must be an HTTP loopback origin.')
  }
  return parsed.origin
}

function safeHeader(value, maxLength = 256) {
  if (Array.isArray(value)) value = value[0]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return null
  if (Array.from(trimmed).some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })) return null
  return trimmed
}

function forwardedClientAddress(value) {
  const first = safeHeader(value)?.split(',')[0]?.trim()
  return first && net.isIP(first) !== 0 ? first : null
}

function trustedRoleClaims(value) {
  const raw = safeHeader(value, 1024)
  if (!raw) return null
  const roles = raw
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter((role) => /^[a-z][a-z0-9-]{0,63}$/.test(role))
  const unique = [...new Set(roles)].slice(0, 20)
  return unique.length > 0 ? unique.join(',') : null
}

function proxyHeaders(request) {
  const headers = new Headers()
  const allowed = ['accept', 'accept-language', 'content-type', 'if-none-match']
  for (const name of allowed) {
    const value = safeHeader(request.headers[name], 1024)
    if (value) headers.set(name, value)
  }

  headers.set('x-service-lasso-internal-proxy', 'serviceadmin')
  headers.set('x-service-lasso-proxy', 'serviceadmin')
  const clientAddress = forwardedClientAddress(request.headers['x-forwarded-for'])
  if (clientAddress) {
    headers.set('x-service-lasso-client-address', clientAddress)
  }
  const userId = safeHeader(request.headers['x-service-lasso-user'])
  if (userId) {
    headers.set('x-service-lasso-zitadel-user-id', userId)
    if (clientAddress) {
      headers.set('x-service-lasso-trusted-ingress', 'serviceadmin-loopback')
    }
  }
  const roles = trustedRoleClaims(request.headers['x-service-lasso-roles'])
  if (roles) {
    headers.set('x-service-lasso-zitadel-roles', roles)
  }
  const workspaceId = safeHeader(request.headers['x-service-lasso-workspace'])
  if (workspaceId) {
    headers.set('x-service-lasso-workspace-id', workspaceId)
  }
  return headers
}

export function runtimeApiTimeoutMs(method, pathname) {
  if (method === 'POST' && pathname === '/api/setup/bootstrap') {
    return 180_000
  }
  if (method === 'POST' && pathname === '/api/secrets/rotation/execute') {
    return 300_000
  }
  if (
    method === 'POST' &&
    /^\/api\/services\/[^/]+\/(?:install|config|start|stop|restart)$/.test(pathname)
  ) {
    return 120_000
  }
  return 30_000
}

export function rotationProxyLifecycleEvidence(phase, status) {
  if (!rotationProxyLifecyclePhases.has(phase)) return null
  const evidence = {
    schema: ROTATION_PROXY_LIFECYCLE_SCHEMA,
    phase,
  }
  if (Number.isInteger(status) && status >= 100 && status <= 599) {
    evidence.status = status
  }
  return evidence
}

function emitRotationProxyLifecycle(phase, status) {
  const evidence = rotationProxyLifecycleEvidence(phase, status)
  if (!evidence) return
  try {
    process.stderr.write(`${JSON.stringify(evidence)}\n`)
  } catch {
    // Diagnostics must never change the proxy outcome.
  }
}

function securityHeaders(contentType) {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  }
}

async function readBoundedUpstream(response) {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPSTREAM_BODY_BYTES) {
    await response.body?.cancel()
    throw new Error('upstream_body_too_large')
  }
  if (!response.body) return Buffer.alloc(0)

  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_UPSTREAM_BODY_BYTES) {
        await reader.cancel()
        throw new Error('upstream_body_too_large')
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, size)
}

async function readBoundedBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_REQUEST_BODY_BYTES) {
      throw new Error('request_body_too_large')
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function resolveStaticFile(distDir, requestPath) {
  let decoded
  try {
    decoded = decodeURIComponent(requestPath)
  } catch {
    return null
  }
  if (decoded.includes('\0')) return null
  let realDistDir
  try {
    realDistDir = fs.realpathSync(distDir)
  } catch {
    return null
  }
  const relative = decoded.replace(/^[/\\]+/, '')
  const candidate = path.resolve(realDistDir, relative)
  const prefix = `${realDistDir}${path.sep}`
  if (candidate !== realDistDir && !candidate.startsWith(prefix)) {
    return null
  }

  try {
    const realCandidate = fs.realpathSync(candidate)
    if (realCandidate !== realDistDir && !realCandidate.startsWith(prefix)) return null
    const info = fs.statSync(realCandidate)
    if (info.isFile()) return realCandidate
    if (info.isDirectory()) {
      const indexPath = fs.realpathSync(path.join(realCandidate, 'index.html'))
      if (indexPath.startsWith(prefix) && fs.statSync(indexPath).isFile()) return indexPath
    }
  } catch {
    // SPA fallback follows.
  }
  try {
    const fallback = fs.realpathSync(path.join(realDistDir, 'index.html'))
    return fallback.startsWith(prefix) && fs.statSync(fallback).isFile() ? fallback : null
  } catch {
    return null
  }
}

export function createServiceAdminServer(options = {}) {
  const distDir = path.resolve(options.distDir ?? path.join(packageRoot, 'dist'))
  const runtimeApiBaseUrl = requiredLoopbackUrl(options.runtimeApiBaseUrl)
  const rotationProxyLifecycleDiagnostics =
    options.rotationProxyLifecycleDiagnostics === true

  return http.createServer(async (request, response) => {
    const method = request.method ?? 'GET'
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
    if (requestUrl.pathname.startsWith('/api/')) {
      const tracksRotationLifecycle =
        rotationProxyLifecycleDiagnostics &&
        method === 'POST' &&
        requestUrl.pathname === '/api/secrets/rotation/execute'
      if (tracksRotationLifecycle) {
        response.once('close', () => {
          emitRotationProxyLifecycle('downstream_closed')
        })
      }
      try {
        const targetUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, runtimeApiBaseUrl)
        const body = ['GET', 'HEAD'].includes(method)
          ? undefined
          : await readBoundedBody(request)
        if (tracksRotationLifecycle) {
          emitRotationProxyLifecycle('upstream_started')
        }
        const upstream = await fetch(targetUrl, {
          method,
          headers: proxyHeaders(request),
          body,
          redirect: 'manual',
          signal: AbortSignal.timeout(runtimeApiTimeoutMs(method, requestUrl.pathname)),
        })
        if (tracksRotationLifecycle) {
          emitRotationProxyLifecycle('headers_received', upstream.status)
        }
        const bytes = await readBoundedUpstream(upstream)
        if (tracksRotationLifecycle) {
          emitRotationProxyLifecycle('body_received', upstream.status)
        }
        response.writeHead(upstream.status, {
          ...securityHeaders(
            upstream.headers.get('content-type') ?? 'application/json; charset=utf-8'
          ),
        })
        response.end(method === 'HEAD' ? undefined : bytes)
      } catch (error) {
        const statusCode = error instanceof Error && error.message === 'request_body_too_large'
          ? 413
          : 502
        response.writeHead(statusCode, securityHeaders('application/json; charset=utf-8'))
        response.end(JSON.stringify({
          error: statusCode === 413
            ? 'service_admin_request_too_large'
            : 'service_lasso_runtime_api_unreachable',
          message: statusCode === 413
            ? 'The Service Admin request exceeded the proxy limit.'
            : 'Service Admin could not reach the local Service Lasso runtime.',
        }))
      }
      return
    }

    if (method !== 'GET' && method !== 'HEAD') {
      response.writeHead(405, securityHeaders('text/plain; charset=utf-8'))
      response.end('Method Not Allowed')
      return
    }
    const filePath = resolveStaticFile(distDir, requestUrl.pathname)
    if (!filePath) {
      response.writeHead(500, securityHeaders('text/plain; charset=utf-8'))
      response.end('Built Service Admin assets are unavailable.')
      return
    }
    const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream'
    response.writeHead(200, securityHeaders(contentType))
    if (method === 'HEAD') response.end()
    else fs.createReadStream(filePath).pipe(response)
  })
}

export async function startServiceAdminServer(options = {}) {
  const host = options.host ?? process.env.SERVICE_HOST ?? DEFAULT_HOST
  if (!isLoopbackHost(host)) {
    throw new Error('Service Admin must bind to a loopback host.')
  }
  const port = Number(options.port ?? process.env.SERVICE_PORT ?? DEFAULT_PORT)
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new Error('Service Admin port is invalid.')
  }
  const runtimeApiBaseUrl = options.runtimeApiBaseUrl ??
    process.env.SERVICE_LASSO_API_BASE_URL ??
    process.env.SERVICE_LASSO_RUNTIME_API_BASE_URL
  if (!runtimeApiBaseUrl) {
    throw new Error('Service Lasso runtime API is not configured.')
  }
  const server = createServiceAdminServer({
    distDir: options.distDir,
    runtimeApiBaseUrl,
    rotationProxyLifecycleDiagnostics:
      options.rotationProxyLifecycleDiagnostics ??
      process.env.SERVICE_LASSO_TEST_ROTATION_PROXY_LIFECYCLE === '1',
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, resolve)
  })
  return server
}

function isMainModule() {
  if (!process.argv[1]) return false
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(modulePath)
  } catch {
    return false
  }
}

if (isMainModule()) {
  startServiceAdminServer()
    .then((server) => {
      const address = server.address()
      const port = address && typeof address === 'object' ? address.port : DEFAULT_PORT
      console.log(`@serviceadmin listening on http://${DEFAULT_HOST}:${port}`)
    })
    .catch(() => {
      console.error('@serviceadmin failed to start securely')
      process.exitCode = 1
    })
}
