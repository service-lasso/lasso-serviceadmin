// Byte copying creates NEW input observations. It never grants execution.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const fail = () => { throw new Error('FIXTURE_SENDER_MATERIALIZATION') }
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const [rootPath, pin, destination] = process.argv.slice(2)
if (!path.isAbsolute(rootPath ?? '') || !path.isAbsolute(destination ?? '') ||
    !/^[a-f0-9]{64}$/.test(pin ?? '') || fs.existsSync(destination)) fail()
const originalParent = path.dirname(path.resolve(rootPath))
const destinationParent = path.dirname(path.resolve(destination))
if (destinationParent !== originalParent ||
    fs.realpathSync(originalParent) !== originalParent) fail()
if (fs.statSync(rootPath).size > 4194304) fail()
const raw = fs.readFileSync(rootPath)
if (raw.length > 4194304 || sha(raw) !== pin) fail()
const root = JSON.parse(raw)
if (root.schema !== 'sa-sender-artifact.v1' || root.nodeVersion !== '22.23.2' ||
    !['win32', 'linux'].includes(root.platform) || !Array.isArray(root.members) ||
    root.members.length < 2 || root.members.length > 20000) fail()
const originals = new Map()
for (const row of root.members) {
  if (!path.isAbsolute(row.path) || originals.has(row.path) ||
      !Number.isSafeInteger(row.size) || row.size < 0 || row.size > 134217728 ||
      !/^[a-f0-9]{64}$/.test(row.sha256)) fail()
  if (fs.statSync(row.path).size !== row.size) fail()
  const bytes = fs.readFileSync(row.path)
  if (bytes.length !== row.size || sha(bytes) !== row.sha256) fail()
  originals.set(row.path, row)
}
for (const file of [root.addon, root.nativeSource, root.runtimeSource]) {
  if (!originals.has(file)) fail()
}
fs.mkdirSync(destination, { mode: 0o700 })
const associations = []
const copied = new Map()
let ordinal = 0
for (const row of originals.values()) {
  const copy = path.join(destination, `${ordinal++}-${path.basename(row.path)}`)
  fs.copyFileSync(row.path, copy, fs.constants.COPYFILE_EXCL)
  const bytes = fs.readFileSync(copy)
  if (bytes.length !== row.size || sha(bytes) !== row.sha256) fail()
  const actual = { path: copy, size: row.size, sha256: row.sha256 }
  copied.set(row.path, actual)
  associations.push({ original: row, copy: actual })
}
// The actual consumer Node must be separately present with exactly original bytes.
const originalNode = originals.get(root.nodeImage)
const currentNode = fs.readFileSync(process.execPath)
if (!originalNode || currentNode.length !== originalNode.size ||
    sha(currentNode) !== originalNode.sha256 || process.version !== 'v22.23.2' ||
    process.platform !== root.platform) fail()
const node = { ...originalNode, path: process.execPath }
const members = [...copied.values(), node]
const projection = { ...root, state: 'NEW_UNADMITTED_MATERIALIZED_INPUT',
  nodeImage: process.execPath,
  addon: copied.get(root.addon).path, nativeSource: copied.get(root.nativeSource).path,
  runtimeSource: copied.get(root.runtimeSource).path, members }
const bytes = Buffer.from(JSON.stringify(projection))
if (bytes.length > 4194304 || members.length > 20000) fail()
fs.writeFileSync(path.join(destination, 'ARTIFACT-ROOT.json'), bytes, { flag: 'wx', mode: 0o600 })
fs.writeFileSync(path.join(destination, 'COPY-ASSOCIATIONS.json'),
  JSON.stringify({ originalRootSHA256: pin, associations, actualConsumerNode: node,
    materializedRootSHA256: sha(bytes), admitted: false }), { flag: 'wx', mode: 0o600 })
// This new projection requires independent qualification and NEW runtime admission.
