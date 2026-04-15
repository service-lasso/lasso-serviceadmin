import { promises as fs } from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

function resolveStubServiceLogInfo(
  serviceId: string,
  type: 'default' | 'access' | 'error' = 'default'
) {
  const samplePath = path.resolve(
    __dirname,
    'public',
    'mock-logs',
    'service-sample.log'
  )

  const logPaths: Record<string, string> = {
    traefik: 'C:\\service-lasso\\traefik\\logs\\traefik.log',
    'service-admin': samplePath,
    zitadel: 'C:\\service-lasso\\zitadel\\logs\\zitadel.log',
    dagu: 'C:\\service-lasso\\dagu\\logs\\dagu.log',
    'secrets-broker': 'C:\\service-lasso\\secrets-broker\\logs\\broker.log',
  }

  const resolvedPath = logPaths[serviceId]
  if (!resolvedPath) return null

  return {
    serviceId,
    type,
    path: resolvedPath,
    availableTypes: ['default'],
  }
}

function attachLogMiddlewares(
  middlewares: {
    use: (path: string, handler: (req: any, res: any) => void | Promise<void>) => void
  }
) {
  middlewares.use('/api/services/log-info', async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? '', 'http://localhost')
      const serviceId = requestUrl.searchParams.get('service')
      const type = (requestUrl.searchParams.get('type') ?? 'default') as
        | 'default'
        | 'access'
        | 'error'

      if (!serviceId) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Missing service query parameter' }))
        return
      }

      const logInfo = resolveStubServiceLogInfo(serviceId, type)
      if (!logInfo) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Unknown service log target' }))
        return
      }

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(logInfo))
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : 'Failed to resolve service log info',
        })
      )
    }
  })

  middlewares.use('/api/logs/content', async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? '', 'http://localhost')
      const serviceId = requestUrl.searchParams.get('service')
      const type = (requestUrl.searchParams.get('type') ?? 'default') as
        | 'default'
        | 'access'
        | 'error'

      if (!serviceId) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end('Missing service query parameter')
        return
      }

      const logInfo = resolveStubServiceLogInfo(serviceId, type)
      if (!logInfo?.path) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end('Unknown service log target')
        return
      }

      const content = await fs.readFile(logInfo.path, 'utf8')
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(content)
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(error instanceof Error ? error.message : 'Failed to read log file')
    }
  })

  middlewares.use('/api/logs/read', async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? '', 'http://localhost')
      const serviceId = requestUrl.searchParams.get('service')
      const type = (requestUrl.searchParams.get('type') ?? 'default') as
        | 'default'
        | 'access'
        | 'error'
      const limit = Math.max(
        1,
        Math.min(1000, Number(requestUrl.searchParams.get('limit') ?? '50'))
      )
      const beforeParam = requestUrl.searchParams.get('before')

      if (!serviceId) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Missing service query parameter' }))
        return
      }

      const logInfo = resolveStubServiceLogInfo(serviceId, type)
      if (!logInfo?.path) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Unknown service log target' }))
        return
      }

      const filePath = logInfo.path
      const content = await fs.readFile(filePath, 'utf8')
      const allLines = content.replace(/\r\n/g, '\n').split('\n')
      const normalizedLines =
        allLines.length && allLines[allLines.length - 1] === ''
          ? allLines.slice(0, -1)
          : allLines

      const totalLines = normalizedLines.length
      const before = beforeParam ? Number(beforeParam) : totalLines
      const safeBefore = Number.isFinite(before)
        ? Math.max(0, Math.min(totalLines, before))
        : totalLines
      const start = Math.max(0, safeBefore - limit)
      const lines = normalizedLines.slice(start, safeBefore)

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          serviceId,
          type,
          path: filePath,
          totalLines,
          start,
          end: safeBefore,
          hasMore: start > 0,
          nextBefore: start,
          lines,
        })
      )
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to read log file',
        })
      )
    }
  })
}

function createLogReadEndpointPlugin() {
  return {
    name: 'service-lasso-log-read-endpoint',
    configureServer(server: import('vite').ViteDevServer) {
      attachLogMiddlewares(server.middlewares)
    },
    configurePreviewServer(server: import('vite').PreviewServer) {
      attachLogMiddlewares(server.middlewares)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    createLogReadEndpointPlugin(),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
