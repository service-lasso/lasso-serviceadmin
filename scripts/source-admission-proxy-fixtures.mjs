// Prospective native HTTP transport evidence. No template/native Core authority.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import http from 'node:http'
import net from 'node:net'

const stage = `/api/service-source-admission/stages/sas_${'a'.repeat(32)}/content`
const mime = 'application/vnd.service-lasso.template-project+zip'
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
class FixtureError extends Error {
  constructor(code) { super(code); this.code = code }
}
const fixtureErrorCodes = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ERR_ASSERTION', 'ERR_STREAM_PREMATURE_CLOSE', 'ABORT_ERR',
  'FIXTURE_HTTP_RESPONSE_CAP', 'FIXTURE_HTTP_RESPONSE_EOF', 'FIXTURE_HTTP_CLOSE_CEILING',
  'FIXTURE_PAUSED_HEADER_CAP', 'FIXTURE_PAUSED_CLOSE_CEILING', 'FIXTURE_PAUSED_EARLY_CLOSE',
])
const operationProjection = {
  operation: {
    id: `sao_${'c'.repeat(32)}`, kind: 'source_admission', status: 'accepted', replayed: false,
    serviceId: 'fixture-service', template: { templateId: 'fixture', templateCommit: 'a'.repeat(40), templateVersion: '1.0.0', contractDigest: 'a'.repeat(64) },
    candidateRevision: 'b'.repeat(64), stagedDigest: 'c'.repeat(64), materializationDigest: 'd'.repeat(64), inventoryCount: 1,
    createdAt: '2026-10-05T00:00:00.000Z', completedAt: null, errorCode: null,
  },
}

/** Used by both original source and extracted package native HTTP servers. */
export function sourceAdmissionFixtureUpstream(request, response, record, mode) {
  const chunks = []
  let size = 0
  request.on('data', (chunk) => { size += chunk.length; chunks.push(chunk) })
  request.on('error', () => {})
  request.on('end', () => {
    const bytes = Buffer.concat(chunks, size)
    record({ headers: request.headers, rawHeaders: request.rawHeaders, url: request.url, bytes, complete: request.complete, rawTrailers: request.rawTrailers })
    if (mode() === 'disconnect') { response.destroy(); return }
    if (mode() === 'stall') return
    if (mode() === 'oversize') {
      response.writeHead(200, { 'Content-Length': 8 * 1024 * 1024 + 1 })
      response.end()
      return
    }
    if (mode() === 'stream-oversize') {
      response.writeHead(200)
      response.end(Buffer.alloc(8 * 1024 * 1024 + 1))
      return
    }
    if (mode() === 'bounded-response') {
      response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': 8 * 1024 * 1024 })
      response.end(Buffer.alloc(8 * 1024 * 1024))
      return
    }
    if (mode() === 'truncated') {
      response.writeHead(200, { 'Content-Length': 50 })
      response.write('short')
      response.destroy()
      return
    }
    if (request.method === 'PUT' && request.url === stage) {
      response.writeHead(204)
      response.end()
      return
    }
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(request.url.startsWith('/api/service-source-admission/operations/')
      ? operationProjection : { contractVersion: 'service-lasso.auth-status.v1', ok: true }))
  })
}

function send(baseUrl, target, bytes, headers = {}, method = 'PUT', signal = undefined, observeResponse = undefined) {
  return new Promise((resolve, reject) => {
    let result
    let closed = false
    let finished = false
    let failure
    let responseSize = 0
    const finish = (error) => {
      if (finished) return
      if (error) {
        failure ??= error
        request.destroy()
      }
      if (closed && (result || failure)) {
        finished = true
        clearTimeout(ceiling)
        if (failure) reject(failure)
        else resolve(result)
      }
    }
    const settle = () => finish()
    const request = http.request(new URL(target, baseUrl), {
      method,
      headers: { 'Content-Type': mime, 'Content-Length': bytes.length, ...headers },
      agent: false,
      signal,
    }, (response) => {
      try { observeResponse?.(response.statusCode) } catch (error) { finish(error); return }
      const chunks = []
      response.on('data', (chunk) => {
        responseSize += chunk.length
        if (responseSize > 65_536) { finish(new FixtureError('FIXTURE_HTTP_RESPONSE_CAP')); return }
        chunks.push(chunk)
      })
      response.once('error', finish)
      response.once('end', () => {
        if (!response.complete) { finish(new FixtureError('FIXTURE_HTTP_RESPONSE_EOF')); return }
        result = { status: response.statusCode, body: Buffer.concat(chunks).toString() }
        settle()
      })
    })
    // Fixture ceiling does not extend any product clock. A reset or missing
    // response remains failure; successful status also requires native close.
    const ceiling = setTimeout(() => finish(new FixtureError('FIXTURE_HTTP_CLOSE_CEILING')), 45_000)
    request.once('error', finish)
    request.once('close', () => { closed = true; settle() })
    request.end(bytes)
  })
}

function raw(baseUrl, fields, body, { keepOpen = false, everyMs = null, durationMs = null, writes = Infinity, target = stage, method = 'PUT' } = {}) {
  const url = new URL(baseUrl)
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: url.hostname, port: Number(url.port) })
    let text = ''
    const started = performance.now()
    let ticker
    let finalTimer
    const ceiling = setTimeout(() => { socket.destroy(); reject(new Error('original fixture socket did not close')) }, 50_000)
    socket.once('connect', () => {
      // Latin-1 preserves the original HTTP obs-text octet0xA0. UTF-8 would
      // produce0xC2,0xA0 and fail to exercise the original-header defect.
      socket.write(Buffer.from(`${method} ${target} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n${fields.join('\r\n')}\r\n\r\n`, 'latin1'))
      if (body.length) socket.write(body)
      if (everyMs) ticker = setInterval(() => {
        socket.write(Buffer.from([1]))
        writes--
        if (writes === 0) clearInterval(ticker)
      }, everyMs)
      if (durationMs) finalTimer = setTimeout(() => socket.end(), durationMs)
      else if (!keepOpen) socket.end()
    })
    socket.on('data', (chunk) => {
      text += chunk.toString('utf8')
      assert.ok(text.length <= 65_536, 'fixture response bounded')
    })
    // Parser rejection / early EOF can close without a response; original close
    // plus unchanged upstream observation is the negative assertion.
    socket.on('error', () => {})
    socket.once('close', () => {
      clearInterval(ticker)
      clearTimeout(finalTimer)
      clearTimeout(ceiling)
      resolve({ text, elapsedMs: performance.now() - started })
    })
  })
}

async function pausedDownstreamCapacity(baseUrl, records, setPhase) {
  const url = new URL(baseUrl)
  const socket = new net.Socket()
  const controller = new AbortController()
  const originalRecordCount = records.length
  let originalClientClosed = false
  let intentionalClose = false
  let failure
  let rejectHeaders
  let onReadable
  const fail = (error) => {
    failure ??= error
    controller.abort(failure)
    socket.destroy()
    rejectHeaders?.(failure)
  }
  const closed = new Promise((resolve) => socket.once('close', () => {
    originalClientClosed = true
    if (!intentionalClose) fail(new FixtureError('FIXTURE_PAUSED_EARLY_CLOSE'))
    resolve()
  }))
  socket.on('error', fail)
  // Own the native read side before connecting. Read ONLY bounded headers;
  // no HTTP client/parser can resume the paused8MiB response behind this owner.
  socket.pause()
  const headers = new Promise((resolve, reject) => {
    rejectHeaders = reject
    let text = ''
    onReadable = () => {
      let byte
      while ((byte = socket.read(1)) !== null) {
        text += byte.toString('latin1')
        if (text.length > 8_192) { fail(new FixtureError('FIXTURE_PAUSED_HEADER_CAP')); return }
        if (text.endsWith('\r\n\r\n')) {
          socket.off('readable', onReadable)
          socket.pause()
          resolve(text)
          return
        }
      }
    }
    socket.on('readable', onReadable)
  })
  const ceiling = setTimeout(() => fail(new FixtureError('FIXTURE_PAUSED_CLOSE_CEILING')), 3_000)
  socket.once('connect', () => {
    socket.write(`PUT ${stage} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\nContent-Length: 1\r\nContent-Type: ${mime}\r\n\r\nx`)
  })
  socket.connect({ host: url.hostname, port: Number(url.port) })
  try {
    setPhase('paused-original-response-headers')
    const originalHeaders = await headers
    setPhase('paused-original-response-status')
    assert.match(originalHeaders, /^HTTP\/1\.1 200 /)
    if (failure) throw failure
    setPhase('paused-original-native-open')
    assert.equal(socket.destroyed, false)
    assert.equal(socket.readableEnded, false)
    setPhase('paused-busy-original-response')
    const beforeBusyRecords = records.length
    const busy = await send(baseUrl, stage, Buffer.from('busy'), {}, 'PUT', controller.signal, (status) => {
      // Only closed classes leave this fixture; no response/header/error values.
      // Client-close is an actual local receipt, NEVER a server-close inference.
      const statusClass = status === 503 ? '503' : status === 200 ? '200' : status === 502 ? '502' : status === 504 ? '504' : 'other'
      const originalClass = beforeBusyRecords === originalRecordCount + 1 ? 'one-original-record' : 'original-record-count-other'
      const forwardClass = records.length === beforeBusyRecords ? 'no-new-upstream-record' : records.length === beforeBusyRecords + 1 ? 'one-new-upstream-record' : 'upstream-record-count-other'
      const closeClass = originalClientClosed ? 'client-close-observed' : 'client-close-not-observed'
      setPhase(`paused-busy-header-${statusClass}-${originalClass}-${forwardClass}-${closeClass}`)
      assert.equal(status, 503)
      assert.equal(records.length, beforeBusyRecords, 'busy original must not forward')
    })
    setPhase('paused-busy-original-status')
    assert.equal(busy.status, 503)
    if (failure) throw failure
    setPhase('paused-original-native-close')
    intentionalClose = true
    socket.destroy()
    await closed
    if (failure) throw failure
  } catch (error) {
    intentionalClose = true
    fail(error)
    throw failure
  } finally {
    intentionalClose = true
    socket.destroy()
    await closed
    clearTimeout(ceiling)
    socket.off('readable', onReadable)
    socket.off('error', fail)
  }
}

/** All cases run on genuine HTTP sockets, including original 10s/40s timers. */
export async function verifySourceAdmissionProxy({ baseUrl, records, setMode }) {
  // Source-owned fixed labels expose the failing phase without request/header
  // values or credentials. All original assertions remain authoritative.
  let phase = 'full-upload'
  try {
    const full = Buffer.alloc(10_485_760)
    for (let index = 0; index < full.length; index++) full[index] = index % 251
    const secretHeaders = {
      authorization: 'Bearer browser-secret-must-not-forward',
      cookie: 'session=browser-secret-must-not-forward',
      'x-forwarded-for': '192.0.2.51',
      'x-service-lasso-user': 'usr_release_operator',
      'x-service-lasso-workspace': 'workspace-release',
      'x-service-lasso-roles': 'admin',
    }
    const beforeFull = records.length
    assert.equal((await send(baseUrl, stage, full, secretHeaders)).status, 204)
    const forwarded = records[beforeFull]
    assert.deepEqual(forwarded.bytes, full, 'whole original 10MiB byte equality')
    assert.equal(hash(forwarded.bytes), hash(full))
    assert.equal(forwarded.complete, true)
    assert.deepEqual(forwarded.rawTrailers, [])
    assert.equal(forwarded.headers['content-type'], mime)
    assert.equal(forwarded.headers['content-length'], String(full.length))
    assert.equal(forwarded.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === 'content-length').length, 1)
    assert.equal(forwarded.headers.authorization, undefined)
    assert.equal(forwarded.headers.cookie, undefined)
    assert.equal(forwarded.headers['x-service-lasso-trusted-ingress'], 'serviceadmin-loopback')
    assert.equal(forwarded.headers['x-service-lasso-zitadel-user-id'], 'usr_release_operator')
    assert.equal(forwarded.headers['x-service-lasso-zitadel-roles'], 'admin')
    assert.equal(forwarded.headers['x-service-lasso-workspace-id'], 'workspace-release')
    assert.equal(forwarded.headers['x-service-lasso-client-id'], undefined)

    // F1: exact media types allow only original HTTP outer SP/HTAB, never
    // ECMAScript Unicode whitespace. Exercise both edges on all selected bodies.
    for (const route of [
      { target: stage, method: 'PUT', mediaType: mime, body: Buffer.from('original-upload') },
      ...[
        '/api/service-source-admission/stages',
        '/api/service-source-admission/preflights',
        `/api/service-source-admission/preflights/sap_${'b'.repeat(32)}/commit`,
      ].map((target) => ({ target, method: 'POST', mediaType: 'application/json', body: Buffer.from('{"original":true}') })),
    ]) {
      phase = 'mime-original-nbsp'
      for (const value of [`\u00a0${route.mediaType}`, `${route.mediaType}\u00a0`, `\u00a0${route.mediaType}\u00a0`]) {
        const before = records.length
        const rejectedType = await raw(baseUrl, [`Content-Length: ${route.body.length}`, `Content-Type: ${value}`], route.body, { ...route, keepOpen: true })
        assert.match(rejectedType.text, /^HTTP\/1\.1 400 /)
        await wait(50)
        assert.equal(records.length, before, 'original0xA0 MIME whitespace must never forward')
      }
      phase = 'mime-http-ows'
      for (const value of [` ${route.mediaType} `, `\t${route.mediaType}\t`, ` \t${route.mediaType}\t `]) {
        const before = records.length
        const allowedType = await raw(baseUrl, [`Content-Length: ${route.body.length}`, `Content-Type: ${value}`], route.body, { ...route, keepOpen: true })
        assert.match(allowedType.text, route.method === 'PUT' ? /^HTTP\/1\.1 204 / : /^HTTP\/1\.1 200 /)
        assert.equal(records.length, before + 1)
        assert.deepEqual(records[before].bytes, route.body)
        assert.equal(records[before].complete, true)
        assert.deepEqual(records[before].rawTrailers, [])
        assert.equal(records[before].headers['content-type'], route.mediaType)
        assert.equal(records[before].headers['content-length'], String(route.body.length))
      }
    }

    for (const target of [
      '/api/service-source-admission/stages',
      '/api/service-source-admission/preflights',
      `/api/service-source-admission/preflights/sap_${'b'.repeat(32)}/commit`,
    ]) {
      phase = 'json-65536-positive'
      const json = Buffer.from(`{"value":"${'x'.repeat(65_524)}"}`)
      assert.equal(json.length, 65_536)
      const previous = records.length
      assert.equal((await send(baseUrl, target, json, { 'Content-Type': 'application/json' }, 'POST')).status, 200)
      assert.deepEqual(records[previous].bytes, json)
      phase = 'json-65537-denial'
      assert.equal((await send(baseUrl, target, Buffer.alloc(65_537), { 'Content-Type': 'application/json' }, 'POST')).status, 413)
      assert.equal(records.length, previous + 1)
    }
    phase = 'operation-projection'
    const operation = `/api/service-source-admission/operations/sao_${'c'.repeat(32)}`
    const operationReply = await send(baseUrl, operation, Buffer.alloc(0), {}, 'GET')
    assert.equal(operationReply.status, 200)
    assert.deepEqual(JSON.parse(operationReply.body), operationProjection)

    phase = 'original-framing-denials'
    const rejected = [
      [`Content-Type: ${mime}`],
      ['Content-Length: 1'],
      ['Content-Length: 0', `Content-Type: ${mime}`],
      ['Content-Length: 1', 'Content-Length: 1', `Content-Type: ${mime}`],
      ['Content-Length: 1', 'Content-Length: 2', `Content-Type: ${mime}`],
      ['Content-Length: 1', `Content-Type: ${mime}`, `Content-Type: ${mime}`],
      ['Content-Length: 01', `Content-Type: ${mime}`],
      ['Content-Length: +1', `Content-Type: ${mime}`],
      ['Content-Length: 1,1', `Content-Type: ${mime}`],
      ['Content-Length: 10485761', `Content-Type: ${mime}`],
      ['Content-Length: 1', `Content-Type: ${mime}; charset=utf-8`],
      ['Content-Length: 1', 'Content-Type: application/octet-stream'],
      ['Content-Length: 1', `Content-Type: ${mime}`, 'Content-Encoding: identity'],
      ['Transfer-Encoding: chunked', `Content-Type: ${mime}`],
      ['Content-Length: 1', `Content-Type: ${mime}`, 'Trailer: x-extra'],
    ]
    for (const fields of rejected) {
      const before = records.length
      await raw(baseUrl, fields, Buffer.from('x'))
      await wait(50)
      assert.equal(records.length, before, `no upstream request for ${fields[0]}`)
    }
    phase = 'original-truncated-eof'
    for (const body of [Buffer.from('short'), Buffer.alloc(0)]) {
      const before = records.length
      await raw(baseUrl, ['Content-Length: 10', `Content-Type: ${mime}`], body)
      await wait(50)
      assert.equal(records.length, before, 'truncated original request never forwards')
    }
    phase = 'original-surplus'
    const beforeExtra = records.length
    await raw(baseUrl, ['Content-Length: 1', `Content-Type: ${mime}`], Buffer.from('xy'))
    await wait(50)
    assert.equal(records.length, beforeExtra, 'same-parser-turn surplus bytes never forward')

    // Capacity occupied by genuine incomplete original body, released after close.
    phase = 'original-idle-capacity'
    const beforeIdle = records.length
    const idle = raw(baseUrl, ['Content-Length: 2', `Content-Type: ${mime}`], Buffer.from('x'), { keepOpen: true })
    await wait(100)
    assert.equal((await send(baseUrl, stage, Buffer.from('x'))).status, 503)
    const idleClosed = await idle
    assert.match(idleClosed.text, /504/)
    assert.ok(idleClosed.elapsedMs >= 10_000 && idleClosed.elapsedMs < 12_000)
    assert.equal(records.length, beforeIdle)
    await wait(50)
    assert.equal((await send(baseUrl, stage, Buffer.from('x'))).status, 204, 'capacity after actual ingress close')

    phase = 'original-absolute-deadline'
    const beforeAbsolute = records.length
    const absolute = await raw(baseUrl, ['Content-Length: 100', `Content-Type: ${mime}`], Buffer.from('x'), { keepOpen: true, everyMs: 1_000 })
    assert.match(absolute.text, /504/)
    assert.ok(absolute.elapsedMs >= 40_000 && absolute.elapsedMs < 42_000)
    assert.equal(records.length, beforeAbsolute, 'continued ingress cannot reset absolute deadline')
    await wait(50)

    // Original ingress lasts32s. Upstream then stalls: the remaining8s absolute
    // budget, not a new40s or renewed10s window, must end this same transaction.
    setMode('stall')
    phase = 'shared-ingress-upstream-deadline'
    const beforeShared = records.length
    const shared = await raw(baseUrl, ['Content-Length: 5', `Content-Type: ${mime}`], Buffer.from('x'), { keepOpen: true, everyMs: 8_000, writes: 4 })
    setMode('normal')
    phase = 'shared-ingress-upstream-status'
    assert.match(shared.text, /504/)
    phase = 'shared-ingress-upstream-original-time'
    assert.ok(shared.elapsedMs >= 40_000 && shared.elapsedMs < 42_000)
    phase = 'shared-ingress-upstream-forward-count'
    assert.equal(records.length, beforeShared + 1)
    phase = 'shared-ingress-upstream-body-count'
    assert.equal(records[beforeShared].bytes.length, 5)
    await wait(50)

    // Caller disappears after the entire original request reached upstream.
    setMode('stall')
    phase = 'caller-disconnect-cleanup'
    const beforeDisconnect = records.length
    await new Promise((resolve, reject) => {
      const url = new URL(baseUrl)
      const socket = net.createConnection({ host: url.hostname, port: Number(url.port) })
      const ceiling = setTimeout(() => { socket.destroy(); reject(new Error('disconnect fixture did not close')) }, 2_000)
      socket.once('connect', () => {
        socket.write(`PUT ${stage} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 1\r\nContent-Type: ${mime}\r\n\r\nx`)
        setTimeout(() => socket.destroy(), 200)
      })
      socket.on('error', () => {})
      socket.once('close', () => { clearTimeout(ceiling); resolve() })
    })
    setMode('normal')
    await wait(100)
    assert.equal(records.length, beforeDisconnect + 1)
    assert.equal((await send(baseUrl, stage, Buffer.from('after-disconnect'))).status, 204, 'original upstream closure frees disconnected capacity')

    // A completed incoming message is not downstream transfer closure. Hold the
    // actual client's read side while an8MiB response is still owned.
    phase = 'paused-downstream-capacity'
    setMode('bounded-response')
    await pausedDownstreamCapacity(baseUrl, records, (value) => { phase = value })
    setMode('normal')
    await wait(100)
    phase = 'paused-capacity-recovery-status'
    assert.equal((await send(baseUrl, stage, Buffer.from('after-response-close'))).status, 204)

    for (const mode of ['disconnect', 'oversize', 'stream-oversize', 'truncated', 'stall']) {
      phase = 'upstream-failure-cleanup'
      setMode(mode)
      const failed = await send(baseUrl, stage, Buffer.from('original'))
      assert.equal(failed.status, mode === 'stall' ? 504 : 502)
      setMode('normal')
      await wait(50)
      assert.equal((await send(baseUrl, stage, Buffer.from('next'))).status, 204, `capacity after actual outgoing closure: ${mode}`)
    }
    // Existing generic 1MiB ceiling and path-selection boundaries stay strict.
    phase = 'generic-1048577-denial'
    for (const target of ['/api/ordinary', `${stage}?offset=0`, stage.replace('sas_', 'SAS_'), `${stage}/extra`]) {
      const before = records.length
      assert.equal((await send(baseUrl, target, Buffer.alloc(1_048_577))).status, 413)
      assert.equal(records.length, before)
    }
    phase = 'generic-1048576-positive'
    assert.equal((await send(baseUrl, '/api/ordinary', Buffer.alloc(1_048_576))).status, 200)
  } catch (error) {
    const code = fixtureErrorCodes.has(error?.code)
      ? error.code : 'fixture_failure'
    throw new Error(`Source admission fixture failed at ${phase} (${code})`)
  }
}

/** New generic clocks are a separate bounded source case, not another30s
 * inside the protected150s original selected/native contract wrapper. */
export async function verifyGenericBodyProxy({ baseUrl, records }) {
  let phase = 'generic-chunked-1048576-positive'
  try {
    phase = 'generic-chunked-1048576-positive'
    const genericBytes = Buffer.alloc(1_048_576, 7)
    const beforeChunked = records.length
    const chunked = await raw(baseUrl, ['Transfer-Encoding: chunked', `Content-Type: ${mime}`],
      Buffer.concat([Buffer.from('100000\r\n'), genericBytes, Buffer.from('\r\n0\r\n\r\n')]),
      { target: '/api/ordinary', keepOpen: true })
    assert.match(chunked.text, /^HTTP\/1\.1 200 /)
    assert.equal(records.length, beforeChunked + 1)
    assert.deepEqual(records[beforeChunked].bytes, genericBytes)
    assert.equal(records[beforeChunked].complete, true)
    phase = 'generic-original-clock-capacity'
    const beforeGenericIdle = records.length
    const genericIdle = Array.from({ length: 8 }, () => raw(baseUrl,
      ['Content-Length: 2', `Content-Type: ${mime}`], Buffer.from('x'),
      { target: '/api/ordinary', keepOpen: true }))
    await wait(100)
    assert.equal((await send(baseUrl, '/api/ordinary', Buffer.from('busy'))).status, 503)
    for (const closed of await Promise.all(genericIdle)) {
      assert.match(closed.text, /^HTTP\/1\.1 502 /)
      assert.ok(closed.elapsedMs >= 30_000 && closed.elapsedMs < 32_000)
    }
    assert.equal(records.length, beforeGenericIdle, 'generic timeout/busy never forwards')
    await wait(50)
    assert.equal((await send(baseUrl, '/api/ordinary', Buffer.from('after-original-close'))).status, 200)
  } catch (error) {
    const code = fixtureErrorCodes.has(error?.code)
      ? error.code : 'fixture_failure'
    throw new Error(`Source admission fixture failed at ${phase} (${code})`)
  }
}
