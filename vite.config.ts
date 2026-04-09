import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { stubBackend } from './src/lib/service-lasso-api/stub-backend'
import type { ServiceAction } from './src/lib/service-lasso-api/types'

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function handleStubApi(req: IncomingMessage, res: ServerResponse) {
  const method = req.method ?? 'GET'
  const url = new URL(req.url ?? '/', 'http://localhost')
  const pathname = url.pathname

  if (!pathname.startsWith('/api/')) {
    return false
  }

  if (method === 'GET' && pathname === '/api/health') {
    json(res, 200, stubBackend.getHealth())
    return true
  }

  if (method === 'GET' && pathname === '/api/runtime/status') {
    json(res, 200, stubBackend.getRuntimeSummary())
    return true
  }

  const runtimeActionMatch = pathname.match(
    /^\/api\/runtime\/actions\/([^/]+)$/
  )
  if (method === 'POST' && runtimeActionMatch) {
    json(
      res,
      200,
      stubBackend.runRuntimeAction(runtimeActionMatch[1] as ServiceAction)
    )
    return true
  }

  if (method === 'GET' && pathname === '/api/services') {
    json(res, 200, stubBackend.getServices())
    return true
  }

  const serviceDetailMatch = pathname.match(/^\/api\/services\/([^/]+)$/)
  if (method === 'GET' && serviceDetailMatch) {
    const service = stubBackend.getService(
      decodeURIComponent(serviceDetailMatch[1])
    )
    if (!service) {
      json(res, 404, { message: 'Service not found' })
      return true
    }
    json(res, 200, service)
    return true
  }

  const serviceActionMatch = pathname.match(
    /^\/api\/services\/([^/]+)\/actions\/([^/]+)$/
  )
  if (method === 'POST' && serviceActionMatch) {
    const result = stubBackend.runServiceAction(
      decodeURIComponent(serviceActionMatch[1]),
      decodeURIComponent(serviceActionMatch[2]) as ServiceAction
    )
    if (!result) {
      json(res, 404, { message: 'Service not found' })
      return true
    }
    json(res, 200, result)
    return true
  }

  if (method === 'GET' && pathname === '/api/dependencies') {
    json(res, 200, stubBackend.getDependencyGraph())
    return true
  }

  if (method === 'GET' && pathname === '/api/network') {
    json(res, 200, stubBackend.getNetworkBindings())
    return true
  }

  if (method === 'GET' && pathname === '/api/installed') {
    json(res, 200, stubBackend.getInstalledRecords())
    return true
  }

  if (method === 'GET' && pathname === '/api/settings') {
    json(res, 200, stubBackend.getOperatorSettings())
    return true
  }

  json(res, 404, { message: 'Unknown stub endpoint', path: pathname, method })
  return true
}

function serviceLassoStubApiPlugin(): Plugin {
  return {
    name: 'service-lasso-stub-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (handleStubApi(req, res)) {
          return
        }
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (handleStubApi(req, res)) {
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [TanStackRouterVite(), react(), serviceLassoStubApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 17700,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 17700,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
