// Prospective native HTTP transport evidence. No template/native Core authority.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import http from 'node:http'
import net from 'node:net'

const stage = `/api/service-source-admission/stages/sas_${'a'.repeat(32)}/content`
const mime = 'application/vnd.service-lasso.template-project+zip'
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
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

function send(baseUrl, target, bytes, headers = {}, method = 'PUT') {
  return new Promise((resolve, reject) => {
    let result
    let closed = false
    let finished = false
    let responseSize = 0
    const finish = (error) => {
      if (finished) return
      finished = true
      clearTimeout(ceiling)
      if (error) { request.destroy(); reject(error) } else resolve(result)
    }
    const settle = () => { if (result && closed) finish() }
    const request = http.request(new URL(target, baseUrl), {
      method,
      headers: { 'Content-Type': mime, 'Content-Length': bytes.length, ...headers },
      agent: false,
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => {
        responseSize += chunk.length
        if (responseSize > 65_536) { finish(new Error('fixture response too large')); return }
        chunks.push(chunk)
      })
      response.once('error', finish)
      response.once('end', () => {
        if (!response.complete) { finish(new Error('fixture response missing original EOF')); return }
        result = { status: response.statusCode, body: Buffer.concat(chunks).toString() }
        settle()
      })
    })
    // Fixture ceiling does not extend any product clock. A reset or missing
    // response remains failure; successful status also requires native close.
    const ceiling = setTimeout(() => finish(new Error('fixture HTTP ownership did not close')), 45_000)
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
    assert.match(shared.text, /504/)
    assert.ok(shared.elapsedMs >= 40_000 && shared.elapsedMs < 42_000)
    assert.equal(records.length, beforeShared + 1)
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
    await new Promise((resolve, reject) => {
      const request = http.request(new URL(stage, baseUrl), {
        method: 'PUT', headers: { 'Content-Type': mime, 'Content-Length': 1 }, agent: false,
      }, async (response) => {
        response.on('error', () => {})
        response.pause()
        try {
          assert.equal(response.statusCode, 200)
          assert.equal((await send(baseUrl, stage, Buffer.from('busy'))).status, 503)
          request.destroy()
        } catch (error) { request.destroy(); reject(error) }
      })
      const ceiling = setTimeout(() => { request.destroy(); reject(new Error('paused downstream fixture did not close')) }, 3_000)
      request.on('error', () => {})
      request.once('close', () => { clearTimeout(ceiling); resolve() })
      request.end('x')
    })
    setMode('normal')
    await wait(100)
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
    const code = ['ECONNRESET', 'EPIPE', 'ERR_ASSERTION', 'ERR_STREAM_PREMATURE_CLOSE'].includes(error?.code)
      ? error.code : 'fixture_failure'
    throw new Error(`Source admission fixture failed at ${phase} (${code})`)
  }
}
