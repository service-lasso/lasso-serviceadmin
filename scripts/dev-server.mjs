#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')

const args = new Set(process.argv.slice(2))
const verifyMode = args.has('--verify')
const keepRoot = args.has('--keep') || process.env.SERVICEADMIN_DEV_SERVER_KEEP === 'true'
const serviceAdminArtifactPath = process.env.SERVICEADMIN_ARTIFACT_PATH
  ? path.resolve(process.env.SERVICEADMIN_ARTIFACT_PATH)
  : null

const serviceLassoCliPath = fileURLToPath(await import.meta.resolve('@service-lasso/service-lasso/cli'))

function log(message) {
  console.log(`[serviceadmin dev:server] ${message}`)
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function reserveLoopbackPort() {
  return await new Promise((resolve, reject) => {
    const server = http.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : null
      server.close(() => {
        if (!port) {
          reject(new Error('Failed to reserve loopback port.'))
          return
        }
        resolve(port)
      })
    })
  })
}

async function startLocalArtifactServer(filePath) {
  const fileStat = await stat(filePath)
  if (!fileStat.isFile()) {
    throw new Error(`SERVICEADMIN_ARTIFACT_PATH must point at a packaged artifact file: ${filePath}`)
  }

  const assetName = path.basename(filePath)
  const archiveType = assetName.endsWith('.zip') ? 'zip' : 'tar.gz'
  const port = await reserveLoopbackPort()
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', `http://127.0.0.1:${port}`)
    if (url.pathname !== `/${assetName}`) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not Found')
      return
    }

    response.writeHead(200, {
      'Content-Length': String(fileStat.size),
      'Content-Type': 'application/octet-stream',
    })
    createReadStream(filePath).pipe(response)
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })

  return {
    server,
    assetName,
    archiveType,
    assetUrl: `http://127.0.0.1:${port}/${assetName}`,
  }
}

async function closeServer(server) {
  if (!server) {
    return
  }

  await new Promise((resolve) => server.close(resolve))
}

async function fetchJson(url, init) {
  const response = await fetch(url, init)
  const text = await response.text()
  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`)
  }

  return body
}

async function waitForJson(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  let lastError = null

  while (Date.now() < deadline) {
    try {
      return await fetchJson(url)
    } catch (error) {
      lastError = error
      await sleep(500)
    }
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

async function waitForOk(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  let lastStatus = null

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      lastStatus = response.status
      if (response.ok) {
        return response
      }
    } catch {}
    await sleep(500)
  }

  throw new Error(`Timed out waiting for ${url}; last status: ${lastStatus ?? 'unreachable'}`)
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function serviceManifestPath(servicesRoot, serviceId) {
  return path.join(servicesRoot, serviceId, 'service.json')
}

async function writeNodeProvider(servicesRoot) {
  await writeJson(serviceManifestPath(servicesRoot, '@node'), {
    id: '@node',
    name: 'Node Runtime',
    description: 'Release-backed Node.js runtime provider for the Service Admin dev server.',
    version: 'v24.15.0',
    role: 'provider',
    enabled: true,
    executable: 'node',
    args: ['--version'],
    globalenv: {
      NODE: '${SERVICE_ARTIFACT_COMMAND}',
      NODE_HOME: '${SERVICE_ARTIFACT_ROOT}',
    },
    artifact: {
      kind: 'archive',
      source: {
        type: 'github-release',
        repo: 'service-lasso/lasso-node',
        channel: 'latest',
      },
      platforms: {
        win32: {
          assetName: 'lasso-node-v24.15.0-win32.zip',
          archiveType: 'zip',
          command: '.\\node.exe',
          args: ['--version'],
        },
        linux: {
          assetName: 'lasso-node-v24.15.0-linux.tar.gz',
          archiveType: 'tar.gz',
          command: './bin/node',
          args: ['--version'],
        },
        darwin: {
          assetName: 'lasso-node-v24.15.0-darwin.tar.gz',
          archiveType: 'tar.gz',
          command: './bin/node',
          args: ['--version'],
        },
      },
    },
  })
}

async function writeTraefikService(servicesRoot, ports) {
  await writeJson(serviceManifestPath(servicesRoot, '@traefik'), {
    id: '@traefik',
    name: 'Traefik Router',
    description: 'Release-backed Traefik router for the Service Admin dev server.',
    version: 'dev-latest',
    enabled: true,
    ports: {
      web: ports.traefikWeb,
      admin: ports.traefikAdmin,
    },
    env: {
      TRAEFIK_DASHBOARD_URL: 'http://127.0.0.1:${ADMIN_PORT}/dashboard/',
      TRAEFIK_PING_URL: 'http://127.0.0.1:${ADMIN_PORT}/ping',
    },
    urls: [
      {
        label: 'dashboard',
        url: 'http://127.0.0.1:${ADMIN_PORT}/dashboard/',
        kind: 'local',
      },
      {
        label: 'ping',
        url: 'http://127.0.0.1:${ADMIN_PORT}/ping',
        kind: 'local',
      },
    ],
    artifact: {
      kind: 'archive',
      source: {
        type: 'github-release',
        repo: 'service-lasso/lasso-traefik',
        channel: 'latest',
      },
      platforms: {
        win32: {
          assetName: 'lasso-traefik-win32.zip',
          archiveType: 'zip',
          command: '.\\traefik.exe',
          args: ['--configFile=./runtime/traefik.yml'],
        },
        linux: {
          assetName: 'lasso-traefik-linux.tar.gz',
          archiveType: 'tar.gz',
          command: './traefik',
          args: ['--configFile=./runtime/traefik.yml'],
        },
        darwin: {
          assetName: 'lasso-traefik-darwin.tar.gz',
          archiveType: 'tar.gz',
          command: './traefik',
          args: ['--configFile=./runtime/traefik.yml'],
        },
      },
    },
    install: {
      files: [
        {
          path: './runtime/dynamic.yml',
          content: 'http:\n  routers: {}\n  services: {}\n',
        },
      ],
    },
    config: {
      files: [
        {
          path: './runtime/traefik.yml',
          content: `entryPoints:\n  web:\n    address: "127.0.0.1:${ports.traefikWeb}"\n  traefik:\n    address: "127.0.0.1:${ports.traefikAdmin}"\napi:\n  dashboard: true\nping:\n  entryPoint: traefik\nproviders:\n  file:\n    filename: "./runtime/dynamic.yml"\n    watch: true\nlog:\n  level: INFO\n`,
        },
      ],
    },
    healthcheck: {
      type: 'http',
      url: 'http://127.0.0.1:${ADMIN_PORT}/ping',
      expected_status: 200,
      retries: 80,
      interval: 250,
    },
  })
}

function buildServiceAdminArtifact(serviceAdminArtifact) {
  const platforms = {
    win32: {
      assetName: '@serviceadmin-win32.zip',
      archiveType: 'zip',
      command: 'node',
      args: ['runtime/server.js'],
    },
    linux: {
      assetName: '@serviceadmin-linux.tar.gz',
      archiveType: 'tar.gz',
      command: 'node',
      args: ['runtime/server.js'],
    },
    darwin: {
      assetName: '@serviceadmin-darwin.tar.gz',
      archiveType: 'tar.gz',
      command: 'node',
      args: ['runtime/server.js'],
    },
  }

  if (serviceAdminArtifact) {
    platforms[process.platform] = {
      ...platforms[process.platform],
      assetName: serviceAdminArtifact.assetName,
      archiveType: serviceAdminArtifact.archiveType,
      assetUrl: serviceAdminArtifact.assetUrl,
    }
  }

  return {
    kind: 'archive',
    source: {
      type: 'github-release',
      repo: 'service-lasso/lasso-serviceadmin',
      channel: 'latest',
    },
    platforms,
  }
}

async function writeServiceAdmin(servicesRoot, ports, serviceAdminArtifact = null) {
  await writeJson(serviceManifestPath(servicesRoot, '@serviceadmin'), {
    id: '@serviceadmin',
    name: 'Service Admin UI',
    description: 'Published Service Admin UI release started by Service Lasso dev:server.',
    enabled: true,
    version: 'dev-latest',
    depend_on: ['@node', '@traefik'],
    ports: {
      ui: ports.serviceAdmin,
    },
    env: {
      SERVICE_HOST: '127.0.0.1',
      SERVICE_PORT: '${UI_PORT}',
    },
    urls: [
      {
        label: 'ui',
        url: 'http://127.0.0.1:${UI_PORT}/',
        kind: 'local',
      },
    ],
    artifact: buildServiceAdminArtifact(serviceAdminArtifact),
    healthcheck: {
      type: 'http',
      url: 'http://127.0.0.1:${UI_PORT}/',
      expected_status: 200,
      retries: 80,
      interval: 250,
    },
  })
}

async function prepareRuntimeRoots(serviceAdminArtifact = null) {
  const defaultRoot = verifyMode
    ? await import('node:fs/promises').then(({ mkdtemp }) => mkdtemp(path.join(os.tmpdir(), 'serviceadmin-dev-server-')))
    : path.join(repoRoot, '.tmp', 'dev-server')
  const root = path.resolve(process.env.SERVICEADMIN_DEV_SERVER_ROOT || defaultRoot)

  if (!keepRoot) {
    await rm(root, { recursive: true, force: true })
  }

  const servicesRoot = path.join(root, 'services')
  const workspaceRoot = path.join(root, 'workspace')
  await mkdir(servicesRoot, { recursive: true })
  await mkdir(workspaceRoot, { recursive: true })

  const ports = {
    api: Number(process.env.SERVICE_LASSO_PORT || (await reserveLoopbackPort())),
    traefikWeb: Number(process.env.SERVICEADMIN_TRAEFIK_WEB_PORT || (await reserveLoopbackPort())),
    traefikAdmin: Number(process.env.SERVICEADMIN_TRAEFIK_ADMIN_PORT || (await reserveLoopbackPort())),
    serviceAdmin: Number(process.env.SERVICEADMIN_UI_PORT || (await reserveLoopbackPort())),
  }

  await writeNodeProvider(servicesRoot)
  await writeTraefikService(servicesRoot, ports)
  await writeServiceAdmin(servicesRoot, ports, serviceAdminArtifact)

  return { root, servicesRoot, workspaceRoot, ports }
}

function startServiceLasso({ servicesRoot, workspaceRoot, ports }) {
  const child = spawn(
    process.execPath,
    [
      serviceLassoCliPath,
      'serve',
      '--services-root',
      servicesRoot,
      '--workspace-root',
      workspaceRoot,
      '--port',
      String(ports.api),
    ],
    {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  child.stdout.on('data', (chunk) => process.stdout.write(chunk))
  child.stderr.on('data', (chunk) => process.stderr.write(chunk))
  return child
}

async function stopRuntime(apiBaseUrl, child) {
  try {
    await fetchJson(`${apiBaseUrl}/api/runtime/actions/stopAll`, { method: 'POST' })
  } catch {}

  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM')
    await Promise.race([
      new Promise((resolve) => child.once('close', resolve)),
      sleep(5_000).then(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL')
        }
      }),
    ])
  }
}

async function lifecycle(apiBaseUrl, serviceId, action) {
  return await fetchJson(`${apiBaseUrl}/api/services/${encodeURIComponent(serviceId)}/${action}`, {
    method: 'POST',
  })
}

async function bootstrapServices(apiBaseUrl) {
  for (const serviceId of ['@node', '@traefik', '@serviceadmin']) {
    log(`install ${serviceId}`)
    await lifecycle(apiBaseUrl, serviceId, 'install')
    log(`config ${serviceId}`)
    await lifecycle(apiBaseUrl, serviceId, 'config')
    if (serviceId !== '@node') {
      log(`start ${serviceId}`)
      await lifecycle(apiBaseUrl, serviceId, 'start')
    }
  }
}

async function readService(apiBaseUrl, serviceId) {
  const body = await waitForJson(`${apiBaseUrl}/api/services/${encodeURIComponent(serviceId)}`)
  return body.service
}

async function verifyRuntime(apiBaseUrl, ports) {
  const health = await waitForJson(`${apiBaseUrl}/api/health`)
  assert(health.status === 'ok', 'Service Lasso API did not report healthy status.')

  const servicesPayload = await waitForJson(`${apiBaseUrl}/api/services`)
  const serviceIds = servicesPayload.services.map((service) => service.id).sort()
  assert(
    JSON.stringify(serviceIds) === JSON.stringify(['@node', '@serviceadmin', '@traefik']),
    `Unexpected dev server services: ${JSON.stringify(serviceIds)}`,
  )

  const node = await readService(apiBaseUrl, '@node')
  assert(node.lifecycle?.installed === true, '@node was not installed.')
  assert(node.lifecycle?.configured === true, '@node was not configured.')
  assert(node.lifecycle?.running === false, '@node should be a provider, not a managed daemon.')

  const traefik = await readService(apiBaseUrl, '@traefik')
  assert(traefik.lifecycle?.running === true, '@traefik was not running.')
  assert(traefik.health?.healthy === true, '@traefik was not healthy.')
  await waitForOk(`http://127.0.0.1:${ports.traefikAdmin}/ping`)

  const serviceadmin = await readService(apiBaseUrl, '@serviceadmin')
  assert(serviceadmin.lifecycle?.running === true, '@serviceadmin was not running.')
  assert(serviceadmin.health?.healthy === true, '@serviceadmin was not healthy.')
  const response = await waitForOk(`http://127.0.0.1:${ports.serviceAdmin}/`)
  assert((response.headers.get('content-type') || '').includes('text/html'), '@serviceadmin did not serve HTML.')
}

let child = null
let apiBaseUrl = null
let tempRoot = null
let artifactServer = null

try {
  const serviceAdminArtifact = serviceAdminArtifactPath ? await startLocalArtifactServer(serviceAdminArtifactPath) : null
  artifactServer = serviceAdminArtifact?.server ?? null
  if (serviceAdminArtifactPath) {
    log(`Service Admin artifact: ${serviceAdminArtifactPath}`)
  }
  const runtime = await prepareRuntimeRoots(serviceAdminArtifact)
  tempRoot = runtime.root
  apiBaseUrl = `http://127.0.0.1:${runtime.ports.api}`
  child = startServiceLasso(runtime)

  await waitForJson(`${apiBaseUrl}/api/health`)
  await bootstrapServices(apiBaseUrl)
  await verifyRuntime(apiBaseUrl, runtime.ports)

  log('real Service Lasso dev server is running')
  log(`API: ${apiBaseUrl}`)
  log(`Service Admin: http://127.0.0.1:${runtime.ports.serviceAdmin}/`)
  log(`Traefik dashboard: http://127.0.0.1:${runtime.ports.traefikAdmin}/dashboard/`)

  if (verifyMode) {
    log('verification passed')
    await stopRuntime(apiBaseUrl, child)
    child = null
    await closeServer(artifactServer)
    if (!keepRoot && tempRoot) {
      await rm(tempRoot, { recursive: true, force: true })
    }
    process.exit(0)
  }

  const shutdown = async () => {
    log('stopping Service Lasso dev server')
    await stopRuntime(apiBaseUrl, child)
    await closeServer(artifactServer)
    process.exit(0)
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  await new Promise((resolve) => child.once('close', resolve))
  await closeServer(artifactServer)
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error)
  if (apiBaseUrl || child) {
    await stopRuntime(apiBaseUrl, child)
  }
  await closeServer(artifactServer)
  if (verifyMode && !keepRoot && tempRoot) {
    await rm(tempRoot, { recursive: true, force: true })
  }
  process.exit(1)
}
