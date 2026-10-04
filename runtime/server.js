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
const SOURCE_UPLOAD_MIME = 'application/vnd.service-lasso.template-project+zip'
const SOURCE_UPLOAD_PATH = /^\/api\/service-source-admission\/stages\/sas_[a-f0-9]{32}\/content$/
const SOURCE_COMMIT_PATH = /^\/api\/service-source-admission\/preflights\/sap_[a-f0-9]{32}\/commit$/

/** Exact source-owned route selection; no decoding or caller-selected limit. */
export function sourceAdmissionProxyPolicy(method, target) {
  if (method === 'PUT' && SOURCE_UPLOAD_PATH.test(target)) {
    return { mediaType: SOURCE_UPLOAD_MIME, maxBytes: 10_485_760, absoluteMs: 40_000, idleMs: 10_000 }
  }
  if (method === 'POST' && SOURCE_COMMIT_PATH.test(target)) {
    return { mediaType: 'application/json', maxBytes: 65_536, absoluteMs: 40_000, idleMs: null }
  }
  if (method === 'POST' && target === '/api/service-source-admission/preflights') {
    return { mediaType: 'application/json', maxBytes: 65_536, absoluteMs: 10_000, idleMs: null }
  }
  if (method === 'POST' && target === '/api/service-source-admission/stages') {
    return { mediaType: 'application/json', maxBytes: 65_536, absoluteMs: 30_000, idleMs: null }
  }
  if (method === 'GET' && /^\/api\/service-source-admission\/operations\/sao_[a-f0-9]{32}$/.test(target)) {
    return { mediaType: null, maxBytes: 0, absoluteMs: 30_000, idleMs: null }
  }
  return null
}

class SourceProxyError extends Error {
  constructor(status, code) {
    super(code)
    this.status = status
    this.code = code
  }
}

function sourceBodyLength(request, policy) {
  const fields = new Map()
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    const name = request.rawHeaders[index].toLowerCase()
    const values = fields.get(name) ?? []
    values.push(request.rawHeaders[index + 1])
    fields.set(name, values)
  }
  if (['transfer-encoding', 'content-encoding', 'trailer'].some((name) => fields.has(name))) {
    throw new SourceProxyError(400, 'invalid_upload_framing')
  }
  const lengths = fields.get('content-length')
  if (!policy.mediaType) {
    if (lengths && (lengths.length !== 1 || lengths[0] !== '0')) {
      throw new SourceProxyError(400, 'invalid_body')
    }
    return 0
  }
  const types = fields.get('content-type')
  if (
    !types || types.length !== 1 ||
    types[0].replace(/^[ \t]+|[ \t]+$/g, '') !== policy.mediaType
  ) {
    throw new SourceProxyError(400, 'invalid_stage_content_type')
  }
  if (!lengths || lengths.length !== 1 || !/^[1-9][0-9]{0,7}$/.test(lengths[0])) {
    throw new SourceProxyError(400, 'invalid_upload_framing')
  }
  const count = Number(lengths[0])
  if (count > policy.maxBytes) {
    throw new SourceProxyError(413, policy.mediaType === SOURCE_UPLOAD_MIME ? 'archive_too_large' : 'invalid_body')
  }
  return count
}

function rejectedFixedBodyLength(request) {
  const lengths = []
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    const name = request.rawHeaders[index].toLowerCase()
    if (['transfer-encoding', 'content-encoding', 'trailer'].includes(name)) return null
    if (name === 'content-length') lengths.push(request.rawHeaders[index + 1])
  }
  if (lengths.length !== 1 || !/^(?:0|[1-9][0-9]{0,7})$/.test(lengths[0])) return null
  const count = Number(lengths[0])
  // Discard availability is finite; this never enlarges the accepted body cap.
  return count <= MAX_REQUEST_BODY_BYTES ? count : null
}

async function settleRejectedSourceBody(request, signal, progress) {
  const count = rejectedFixedBodyLength(request)
  if (count === null || signal.aborted || request.destroyed || request.readableEnded) return
  await new Promise((resolve) => {
    let discarded = 0
    const detach = () => {
      request.off('data', onData)
      request.off('end', finish)
      request.off('error', finish)
      request.off('aborted', finish)
      signal.removeEventListener('abort', finish)
    }
    const finish = () => { detach(); request.pause(); resolve() }
    const onData = (part) => {
      if (!Buffer.isBuffer(part) || discarded + part.length > count) { finish(); return }
      discarded += part.length
      progress()
    }
    request.on('data', onData)
    request.once('end', finish)
    request.once('error', finish)
    request.once('aborted', finish)
    signal.addEventListener('abort', finish, { once: true })
    request.resume()
    if (signal.aborted) finish()
  })
}

function originalBody(request, count, signal, progress) {
  // No chunk inventory or concat copy: allocate only after original headers pass.
  const bytes = Buffer.alloc(count)
  return new Promise((resolve, reject) => {
    let offset = 0
    const detach = () => {
      request.off('data', onData)
      request.off('end', onEnd)
      request.off('aborted', onAborted)
      request.off('error', onError)
      signal.removeEventListener('abort', onAborted)
    }
    const fail = (error) => { detach(); request.pause(); reject(error) }
    const onAborted = () => fail(signal.reason ?? new SourceProxyError(400, 'invalid_upload_framing'))
    const onError = () => fail(new SourceProxyError(400, 'invalid_upload_framing'))
    const onData = (chunk) => {
      if (!Buffer.isBuffer(chunk) || offset + chunk.length > count) {
        fail(new SourceProxyError(400, 'invalid_upload_framing'))
        return
      }
      chunk.copy(bytes, offset)
      offset += chunk.length
      progress()
    }
    const onEnd = () => {
      detach()
      if (!request.complete || request.rawTrailers.length !== 0 || offset !== count) {
        reject(new SourceProxyError(400, 'invalid_upload_framing'))
      } else resolve(bytes)
    }
    request.on('data', onData)
    request.once('end', onEnd)
    request.once('aborted', onAborted)
    request.once('error', onError)
    signal.addEventListener('abort', onAborted, { once: true })
    if (signal.aborted) onAborted()
  })
}

async function forwardSourceBody(target, method, headers, body, signal, progress) {
  // Own the actual original outgoing object. Abort is not a closure receipt.
  const outgoing = http.request(target, {
    method, headers: Object.fromEntries(headers), agent: false,
  })
  const closed = new Promise((resolve) => outgoing.once('close', resolve))
  let incoming
  let incomingClosed
  const abort = () => {
    incoming?.destroy()
    outgoing.destroy()
  }
  signal.addEventListener('abort', abort, { once: true })
  try {
    const result = await new Promise((resolve, reject) => {
      outgoing.once('error', () => reject(new SourceProxyError(502, 'service_lasso_runtime_api_unreachable')))
      outgoing.once('close', () => {
        if (!incoming) reject(signal.reason ?? new SourceProxyError(502, 'service_lasso_runtime_api_unreachable'))
      })
      outgoing.once('response', (upstream) => {
        incoming = upstream
        incomingClosed = new Promise((settle) => upstream.once('close', settle))
        progress()
        const bytes = Buffer.alloc(MAX_UPSTREAM_BODY_BYTES)
        let offset = 0
        const fail = () => {
          reject(signal.reason ?? new SourceProxyError(502, 'service_lasso_runtime_api_unreachable'))
          abort()
        }
        upstream.once('error', fail)
        upstream.once('aborted', fail)
        const declared = upstream.headers['content-length']
        if (declared !== undefined && (!/^[0-9]+$/.test(declared) || Number(declared) > bytes.length)) {
          fail()
          return
        }
        upstream.on('data', (part) => {
          if (!Buffer.isBuffer(part) || offset + part.length > bytes.length) { fail(); return }
          part.copy(bytes, offset)
          offset += part.length
          progress()
        })
        upstream.once('end', () => {
          if (!upstream.complete || (declared !== undefined && offset !== Number(declared))) { fail(); return }
          resolve({ status: upstream.statusCode, contentType: upstream.headers['content-type'], bytes: bytes.subarray(0, offset) })
        })
      })
      if (signal.aborted) abort()
      else outgoing.end(body)
    })
    if (signal.aborted) throw signal.reason
    return result
  } finally {
    // Keep body/capacity owned until the genuine original outgoing and response
    // objects close, including errors and late completion after logical timeout.
    if (!outgoing.destroyed) outgoing.destroy()
    await closed
    if (incomingClosed) await incomingClosed
    signal.removeEventListener('abort', abort)
  }
}

async function proxySourceAdmission(request, response, target, headers, policy, startedAt, downstreamClosed) {
  const controller = new AbortController()
  const absoluteEnd = startedAt + policy.absoluteMs
  let idleEnd = startedAt + (policy.idleMs ?? policy.absoluteMs)
  const expired = () => performance.now() >= absoluteEnd || (policy.idleMs && performance.now() >= idleEnd)
  const progress = () => {
    if (expired()) controller.abort(new SourceProxyError(504, 'service_admin_source_admission_timeout'))
    else idleEnd = performance.now() + (policy.idleMs ?? policy.absoluteMs)
  }
  const disconnect = () => {
    if (!response.writableFinished) controller.abort(new SourceProxyError(502, 'service_admin_client_disconnected'))
  }
  const closeLateDownstream = () => {
    if (response.headersSent) request.socket.destroy()
  }
  controller.signal.addEventListener('abort', closeLateDownstream, { once: true })
  response.once('close', disconnect)
  const timer = setInterval(() => {
    if (expired()) {
      controller.abort(new SourceProxyError(504, 'service_admin_source_admission_timeout'))
    }
  }, 25)
  timer.unref()
  try {
    let count
    try {
      count = sourceBodyLength(request, policy)
    } catch (error) {
      // Closing with unread native input can reset the response before the
      // caller observes400/413. Discard only unambiguous fixed bodies <=1MiB,
      // with zero body allocation, under this SAME original absolute/idle clock.
      // Ambiguous/large/stalled input never grants unlimited draining or forwarding.
      await settleRejectedSourceBody(request, controller.signal, progress)
      if (controller.signal.aborted) throw controller.signal.reason
      throw error
    }
    const body = await originalBody(request, count, controller.signal, progress)
    // Allow the same parser turn's framing failure/close to settle before any
    // upstream effect. Genuine HTTP message EOF is required, not a buffer hash.
    await new Promise((resolve) => setImmediate(resolve))
    if (request.socket.destroyed || controller.signal.aborted || expired()) {
      throw controller.signal.reason ?? new SourceProxyError(400, 'invalid_upload_framing')
    }
    headers.set('content-length', String(count))
    if (policy.mediaType) headers.set('content-type', policy.mediaType)
    const result = await forwardSourceBody(target, request.method, headers, body, controller.signal, progress)
    if (controller.signal.aborted || performance.now() >= absoluteEnd) {
      throw controller.signal.reason ?? new SourceProxyError(504, 'service_admin_source_admission_timeout')
    }
    response.writeHead(result.status, { ...securityHeaders(result.contentType ?? 'application/json; charset=utf-8'), Connection: 'close' })
    response.end(result.bytes)
    await downstreamClosed
  } finally {
    clearInterval(timer)
    response.off('close', disconnect)
    controller.signal.removeEventListener('abort', closeLateDownstream)
  }
}
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

const INTERNAL_PROXY_VALUE = 'serviceadmin'
const TRUSTED_INGRESS_VALUE = 'serviceadmin-loopback'
const TRAEFIK_IDENTITY_HEADERS = [
  'x-service-lasso-user',
  'x-service-lasso-actor',
  'x-service-lasso-workspace',
  'x-service-lasso-roles',
]

/**
 * Fail-closed packaged-proxy rejection. Safe metadata only; never include
 * header values, tokens, or cookies on the error.
 */
export class TrustedIngressProxyError extends Error {
  /**
   * @param {string} code Stable fail-closed reason for tests, not clients.
   */
  constructor(code) {
    super('trusted_ingress_identity_invalid')
    this.name = 'TrustedIngressProxyError'
    this.code = code
  }
}

function isLoopbackHost(host) {
  if (!host) return false
  const normalized = String(host).trim().toLowerCase().replace(/^\[|\]$/g, '')
  return (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '0:0:0:0:0:0:0:1' ||
    normalized.startsWith('127.') ||
    normalized.startsWith('::ffff:127.')
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

/**
 * True when a Traefik identity header was sent, including unsafe values.
 * @param {string | string[] | undefined} value
 */
function headerPresent(value) {
  if (Array.isArray(value)) value = value[0]
  return typeof value === 'string' && value.trim() !== ''
}

/**
 * Build Core-bound proxy headers for one Admin request.
 *
 * Direct-port (no Traefik identity): strip identity, forwarded-client,
 * authorization, and cookies so Core sees loopback local-root.
 * Protected ingress: require user plus original client address, then forward
 * canonical Service Lasso headers. Incomplete or conflicting Traefik claims
 * fail closed and never reach Core.
 *
 * @param {import('node:http').IncomingMessage} request
 * @returns {Headers}
 */
export function resolvePackagedProxyHeaders(request) {
  const headers = new Headers()
  const allowed = ['accept', 'accept-language', 'content-type', 'if-none-match']
  for (const name of allowed) {
    const value = safeHeader(request.headers[name], 1024)
    if (value) headers.set(name, value)
  }

  headers.set('x-service-lasso-internal-proxy', INTERNAL_PROXY_VALUE)
  headers.set('x-service-lasso-proxy', INTERNAL_PROXY_VALUE)

  const peer = request.socket?.remoteAddress
  if (peer && !isLoopbackHost(peer)) {
    throw new TrustedIngressProxyError('untrusted_peer')
  }

  const claimedIngress = TRAEFIK_IDENTITY_HEADERS.some((name) =>
    headerPresent(request.headers[name])
  )
  if (!claimedIngress) {
    return headers
  }

  const userId = safeHeader(request.headers['x-service-lasso-user'])
  const actor = safeHeader(request.headers['x-service-lasso-actor'])
  const workspaceId = safeHeader(request.headers['x-service-lasso-workspace'])
  const roles = trustedRoleClaims(request.headers['x-service-lasso-roles'])
  const clientAddress = forwardedClientAddress(request.headers['x-forwarded-for'])

  if (headerPresent(request.headers['x-service-lasso-user']) && !userId) {
    throw new TrustedIngressProxyError('trusted_ingress_identity_missing')
  }
  if (headerPresent(request.headers['x-service-lasso-actor']) && !actor) {
    throw new TrustedIngressProxyError('trusted_ingress_identity_missing')
  }
  if (headerPresent(request.headers['x-service-lasso-workspace']) && !workspaceId) {
    throw new TrustedIngressProxyError('trusted_ingress_identity_missing')
  }
  if (headerPresent(request.headers['x-service-lasso-roles']) && !roles) {
    throw new TrustedIngressProxyError('trusted_ingress_identity_missing')
  }
  if (!userId || !clientAddress) {
    throw new TrustedIngressProxyError('trusted_ingress_identity_missing')
  }
  if (actor && actor !== userId) {
    throw new TrustedIngressProxyError('trusted_ingress_identity_mismatch')
  }

  const resolvedActor = actor ?? userId
  headers.set('x-service-lasso-trusted-ingress', TRUSTED_INGRESS_VALUE)
  headers.set('x-service-lasso-client-address', clientAddress)
  headers.set('x-service-lasso-user', userId)
  headers.set('x-service-lasso-actor', resolvedActor)
  headers.set('x-service-lasso-zitadel-user-id', userId)
  if (workspaceId) {
    headers.set('x-service-lasso-workspace', workspaceId)
    headers.set('x-service-lasso-workspace-id', workspaceId)
  }
  if (roles) {
    headers.set('x-service-lasso-roles', roles)
    headers.set('x-service-lasso-zitadel-roles', roles)
  }
  return headers
}

export function runtimeApiTimeoutMs(method, pathname) {
  const sourcePolicy = sourceAdmissionProxyPolicy(method, pathname)
  if (sourcePolicy) return sourcePolicy.absoluteMs
  if (method === 'POST' && pathname === '/api/setup/bootstrap') {
    return 180_000
  }
  if (method === 'POST' && pathname === '/api/secrets/rotation/execute') {
    return 300_000
  }
  if (
    method === 'POST' &&
    /^\/api\/services\/[^/]+\/(?:install|config|start|stop|restart|reload)$/.test(pathname)
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
  // Per-server availability ownership, retained until actual HTTP closure.
  let sourceAdmissionActive = false
  const sourceAdmissionSockets = new WeakSet()

  const server = http.createServer(async (request, response) => {
    const requestStartedAt = performance.now()
    const method = request.method ?? 'GET'
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
    if (requestUrl.pathname.startsWith('/api/')) {
      const sourcePolicy = sourceAdmissionProxyPolicy(method, request.url ?? '/')
      if (sourcePolicy) {
        sourceAdmissionSockets.add(request.socket)
        const originalClosed = new Promise((resolve) => request.once('close', resolve))
        const downstreamClosed = new Promise((resolve) => request.socket.once('close', resolve))
        const observeOriginalError = () => {}
        request.on('error', observeOriginalError)
        const ownsCapacity = !sourceAdmissionActive
        if (ownsCapacity) sourceAdmissionActive = true
        // Always close selected downstream connections. Malformed/stalled body
        // failure cannot leave unread bytes or parser state on a reused socket.
        response.once('close', () => {
          if (!request.complete) request.destroy()
        })
        try {
          if (!ownsCapacity) throw new SourceProxyError(503, 'service_admin_source_admission_busy')
          const headers = resolvePackagedProxyHeaders(request)
          const target = new URL(request.url, runtimeApiBaseUrl)
          await proxySourceAdmission(request, response, target, headers, sourcePolicy, requestStartedAt, downstreamClosed)
        } catch (error) {
          if (!response.destroyed && !response.headersSent) {
            const status = error instanceof TrustedIngressProxyError ? 403 : error instanceof SourceProxyError ? error.status : 502
            const code = error instanceof TrustedIngressProxyError ? 'trusted_ingress_identity_invalid' : error instanceof SourceProxyError ? error.code : 'service_lasso_runtime_api_unreachable'
            response.writeHead(status, { ...securityHeaders('application/json; charset=utf-8'), Connection: 'close' })
            response.end(JSON.stringify({ error: code, message: 'Service Admin could not complete the source-admission request.' }))
          }
        } finally {
          await originalClosed
          await downstreamClosed
          request.off('error', observeOriginalError)
          sourceAdmissionSockets.delete(request.socket)
          if (ownsCapacity) sourceAdmissionActive = false
        }
        return
      }
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
          headers: resolvePackagedProxyHeaders(request),
          body,
          redirect: 'manual',
          signal: AbortSignal.timeout(
            sourceAdmissionProxyPolicy(method, requestUrl.pathname)
              ? 30_000 // A query/alternate original target did not select this route.
              : runtimeApiTimeoutMs(method, requestUrl.pathname)
          ),
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
        if (error instanceof TrustedIngressProxyError) {
          response.writeHead(403, securityHeaders('application/json; charset=utf-8'))
          response.end(JSON.stringify({
            error: 'trusted_ingress_identity_invalid',
            message: 'Service Admin rejected untrusted or incomplete ingress identity.',
          }))
          return
        }
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
  server.on('clientError', (error, socket) => {
    if (sourceAdmissionSockets.has(socket)) {
      // The original parser found ambiguous/surplus bytes. Close before the
      // EOF settlement turn can forward an otherwise complete first message.
      socket.destroy()
      return
    }
    // Preserve Node's normal empty parser-error responses for other routes.
    if (error.code === 'ECONNRESET' || !socket.writable) return
    socket.end(error.code === 'HPE_HEADER_OVERFLOW'
      ? 'HTTP/1.1 431 Request Header Fields Too Large\r\nConnection: close\r\n\r\n'
      : 'HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
  })
  return server
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
