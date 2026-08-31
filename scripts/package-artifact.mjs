import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, lstat, mkdir, open, readdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const supportedPlatforms = new Set(['win32', 'linux', 'darwin'])
const requestedPlatform = process.argv.slice(2).find((argument) => argument !== '--') ?? process.platform

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
const sbomName = `serviceadmin-${requestedPlatform}.cdx.json`
const sbomPath = path.join(stageRoot, sbomName)
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

function npmPurl(name, version) {
  if (name.startsWith('@')) {
    const [scope, packageName] = name.split('/')
    return `pkg:npm/${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}@${encodeURIComponent(version)}`
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`
}

function buildCycloneDX(rootPackage) {
  const components = new Map()
  const dependencyEdges = new Map()
  const visit = (node, fallbackName) => {
    const name = node.name ?? node.from ?? fallbackName
    const version = node.version
    if (!name || !version) return null
    const ref = npmPurl(name, version)
    if (!components.has(ref)) {
      components.set(ref, { type: 'library', 'bom-ref': ref, name, version, purl: ref })
    }
    const children = []
    for (const [childName, child] of Object.entries(node.dependencies ?? {})) {
      const childRef = visit(child, childName)
      if (childRef) children.push(childRef)
    }
    const observed = dependencyEdges.get(ref) ?? new Set()
    for (const childRef of children) observed.add(childRef)
    dependencyEdges.set(ref, observed)
    return ref
  }
  const rootRef = visit(rootPackage, rootPackage.name)
  const componentList = [...components.values()].sort((left, right) => left['bom-ref'].localeCompare(right['bom-ref']))
  const dependencies = [...dependencyEdges.entries()]
    .map(([ref, values]) => ({ ref, dependsOn: [...values].sort() }))
    .sort((left, right) => left.ref.localeCompare(right.ref))
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    version: 1,
    metadata: {
      component: { ...components.get(rootRef), type: 'application' },
      properties: [
        { name: 'service-lasso:artifact-platform', value: requestedPlatform },
        { name: 'service-lasso:package-manager', value: 'pnpm@10.34.5' },
      ],
    },
    components: componentList.filter((component) => component['bom-ref'] !== rootRef),
    dependencies,
  }
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
const pnpmCLI = process.env.npm_execpath
if (!pnpmCLI) throw new Error('Package manager identity is unavailable.')
const dependencyList = spawnSync(process.execPath, [pnpmCLI, 'list', '--prod', '--json', '--depth', 'Infinity'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 << 20,
})
if (dependencyList.status !== 0) {
  throw new Error(`Production dependency inventory failed (${dependencyList.status ?? 'spawn'}).`)
}
const dependencyRoots = JSON.parse(dependencyList.stdout)
if (!Array.isArray(dependencyRoots) || dependencyRoots.length !== 1) {
  throw new Error('Production dependency inventory returned an unexpected root set.')
}
await writeFile(sbomPath, `${JSON.stringify(buildCycloneDX(dependencyRoots[0]), null, 2)}\n`, 'utf8')
await auditAndNormalize(stageRoot)

await mkdir(releaseRoot, { recursive: true })
await rm(assetPath, { force: true })
const archive = requestedPlatform === 'win32'
  ? spawnSync('tar.exe', ['-a', '-cf', assetName, '-C', stageRoot, '.'], {
      cwd: releaseRoot,
      encoding: 'utf8',
    })
  : spawnSync('tar', ['-czf', assetName, '-C', stageRoot, '.'], {
      cwd: releaseRoot,
      encoding: 'utf8',
    })
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
await cp(sbomPath, path.join(releaseRoot, sbomName))
const assetInfo = await stat(assetPath)
process.stdout.write(`${JSON.stringify({ assetName, sbomName, bytes: assetInfo.size, sha256: digest })}\n`)
