import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { promises as fs } from 'fs'
import type { IncomingMessage, ServerResponse } from 'http'

const DEFAULT_LOG_READ_LIMIT = 100
const MAX_LOG_READ_LIMIT = 1000

type StubServiceDefinition = {
  id: string
  name?: string
  description?: string
  logs?: Partial<
    Record<
      'default' | 'access' | 'error',
      {
        path?: string
      }
    >
  >
}

async function loadStubServiceDefinition(serviceId: string) {
  const serviceJsonPath = path.resolve(
    __dirname,
    'public',
    'services',
    serviceId,
    'service.json'
  )

  try {
    const content = await fs.readFile(serviceJsonPath, 'utf8')
    return {
      serviceJsonPath,
      serviceDefinition: JSON.parse(content) as StubServiceDefinition,
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return null
    }

    throw error
  }
}

async function resolveStubServiceLogInfo(
  serviceId: string,
  type: 'default' | 'access' | 'error' = 'default'
) {
  const loadedServiceDefinition = await loadStubServiceDefinition(serviceId)
  const serviceDefinition = loadedServiceDefinition?.serviceDefinition
  const configuredPath = serviceDefinition?.logs?.[type]?.path
  if (!configuredPath || !loadedServiceDefinition) return null

  const resolvedPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(
        path.dirname(loadedServiceDefinition.serviceJsonPath),
        configuredPath
      )

  return {
    serviceId,
    type,
    path: resolvedPath,
    availableTypes: Object.entries(serviceDefinition.logs ?? {})
      .filter(([, value]) => Boolean(value?.path))
      .map(([key]) => key),
  }
}

function normalizeLogLines(content: string) {
  const allLines = content.replace(/\r\n/g, '\n').split('\n')

  return allLines.length && allLines[allLines.length - 1] === ''
    ? allLines.slice(0, -1)
    : allLines
}

async function readResolvedLogLines(filePath: string) {
  try {
    const content = await fs.readFile(filePath, 'utf8')

    return {
      path: filePath,
      lines: normalizeLogLines(content),
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return {
        path: filePath,
        lines: [
          'Log file not created yet.',
          `Waiting for first log output from ${path.basename(filePath)}.`,
        ],
      }
    }

    throw error
  }
}

function normalizeLogReadLimit(value: string | null) {
  const parsed = Number(value ?? String(DEFAULT_LOG_READ_LIMIT))
  if (!Number.isFinite(parsed)) return DEFAULT_LOG_READ_LIMIT
  return Math.max(1, Math.min(MAX_LOG_READ_LIMIT, Math.trunc(parsed)))
}

function normalizeLogReadBefore(value: string | null, totalLines: number) {
  if (value == null || value === '') return totalLines
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return totalLines
  return Math.max(0, Math.min(totalLines, Math.trunc(parsed)))
}

function attachLogMiddlewares(middlewares: {
  use: (
    path: string,
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  ) => void
}) {
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

      const logInfo = await resolveStubServiceLogInfo(serviceId, type)
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
            error instanceof Error
              ? error.message
              : 'Failed to resolve service log info',
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

      const logInfo = await resolveStubServiceLogInfo(serviceId, type)
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
      res.end(
        error instanceof Error ? error.message : 'Failed to read log file'
      )
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
      const limit = normalizeLogReadLimit(requestUrl.searchParams.get('limit'))
      const beforeParam = requestUrl.searchParams.get('before')

      if (!serviceId) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Missing service query parameter' }))
        return
      }

      const logInfo = await resolveStubServiceLogInfo(serviceId, type)
      if (!logInfo?.path) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Unknown service log target' }))
        return
      }

      const filePath = logInfo.path
      const logData = await readResolvedLogLines(filePath)
      const totalLines = logData.lines.length
      const safeBefore = normalizeLogReadBefore(beforeParam, totalLines)
      const start = Math.max(0, safeBefore - limit)
      const lines = logData.lines.slice(start, safeBefore)

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          serviceId,
          type,
          path: logData.path,
          totalLines,
          start,
          end: safeBefore,
          hasMore: start > 0,
          nextBefore: start,
          limit,
          lines,
        })
      )
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : 'Failed to read log file',
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
