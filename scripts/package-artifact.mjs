import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, lstat, mkdir, open, readdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const supportedPlatforms = new Set(['win32', 'linux', 'darwin'])
const requestedPlatform = process.argv[2] ?? process.platform

if (!supportedPlatforms.has(requestedPlatform)) {
  throw new Error(`Unsupported release platform: ${requestedPlatform}`)
}
if (requestedPlatform !== process.platform) {
  throw new Error(`Release artifacts must be built on their target OS (${requestedPlatform}).`)
}

const distRoot = path.join(root, 'dist')
const stageRoot = path.join(root, 'output', 'package', `@serviceadmin-${requestedPlatform}`)
const releaseRoot = path.join(root, 'output', 'release')
const assetName = requestedPlatform === 'win32'
  ? '@serviceadmin-win32.zip'
  : `@serviceadmin-${requestedPlatform}.tar.gz`
const assetPath = path.join(releaseRoot, assetName)
const fixedTime = new Date('2000-01-01T00:00:00.000Z')

async function requireRegularFile(filePath) {
  const info = await lstat(filePath)
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`Required package input is not a regular file: ${path.relative(root, filePath)}`)
  }
}

async function auditAndNormalize(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name))
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    const info = await lstat(entryPath)
    if (info.isSymbolicLink()) {
      throw new Error(`Release staging contains a symbolic link: ${path.relative(stageRoot, entryPath)}`)
    }
    if (info.isDirectory()) await auditAndNormalize(entryPath)
    else if (!info.isFile()) throw new Error(`Unsupported release entry: ${path.relative(stageRoot, entryPath)}`)
    await utimes(entryPath, fixedTime, fixedTime)
  }
  await utimes(directory, fixedTime, fixedTime)
}

await requireRegularFile(path.join(distRoot, 'index.html'))
await requireRegularFile(path.join(root, 'runtime', 'server.js'))
await requireRegularFile(path.join(root, 'service.json'))

await rm(stageRoot, { recursive: true, force: true })
await mkdir(stageRoot, { recursive: true })
await cp(distRoot, path.join(stageRoot, 'dist'), { recursive: true, dereference: false })
await mkdir(path.join(stageRoot, 'runtime'), { recursive: true })
await cp(path.join(root, 'runtime', 'server.js'), path.join(stageRoot, 'runtime', 'server.js'))
await cp(path.join(root, 'service.json'), path.join(stageRoot, 'service.json'))
await auditAndNormalize(stageRoot)

await mkdir(releaseRoot, { recursive: true })
await rm(assetPath, { force: true })
const archive = requestedPlatform === 'win32'
  ? spawnSync('tar.exe', ['-a', '-cf', assetPath, '-C', stageRoot, '.'], { encoding: 'utf8' })
  : spawnSync('tar', ['-czf', assetPath, '-C', stageRoot, '.'], { encoding: 'utf8' })
if (archive.status !== 0) {
  throw new Error(`Archive creation failed: ${(archive.stderr || archive.stdout).trim()}`)
}

const handle = await open(assetPath, 'r+')
try {
  await handle.sync()
} finally {
  await handle.close()
}
const digest = createHash('sha256').update(await readFile(assetPath)).digest('hex')
await writeFile(path.join(releaseRoot, `${assetName}.sha256`), `${digest}  ${assetName}\n`, 'utf8')
const assetInfo = await stat(assetPath)
process.stdout.write(`${JSON.stringify({ assetName, bytes: assetInfo.size, sha256: digest })}\n`)
