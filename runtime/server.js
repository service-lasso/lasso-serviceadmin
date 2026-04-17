import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const distDir = path.resolve(root, process.env.SERVICE_DIST_DIR || 'dist')
const host = process.env.SERVICE_HOST || '127.0.0.1'
const port = Number(process.env.SERVICE_PORT || '17700')

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

function sendFile(filePath, response) {
  const ext = path.extname(filePath).toLowerCase()
  response.writeHead(200, {
    'Content-Type': mimeTypes.get(ext) || 'application/octet-stream',
  })
  fs.createReadStream(filePath).pipe(response)
}

function resolveRequestPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0])
  const safePath = path.normalize(decoded).replace(/^([.][.][/\\])+/, '')
  const candidate = path.join(distDir, safePath)

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    const indexPath = path.join(candidate, 'index.html')
    if (fs.existsSync(indexPath)) {
      return indexPath
    }
  }

  return path.join(distDir, 'index.html')
}

const server = http.createServer((request, response) => {
  const method = request.method || 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Method Not Allowed')
    return
  }

  const filePath = resolveRequestPath(request.url || '/')
  if (!fs.existsSync(filePath)) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end(`Built dist not found at ${distDir}`)
    return
  }

  if (method === 'HEAD') {
    response.writeHead(200, {
      'Content-Type': mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream',
    })
    response.end()
    return
  }

  sendFile(filePath, response)
})

server.listen(port, host, () => {
  console.log(`@serviceadmin listening on http://${host}:${port}`)
})
