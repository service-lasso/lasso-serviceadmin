// Consumer preflight: metadata selects bytes, never supplies native authority.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const fail = () => { throw new Error('FIXTURE_SENDER_QUALIFICATION_INPUT') }
const rootPath = process.env.SERVICE_LASSO_TEST_SENDER_ARTIFACT_ROOT
const pin = process.env.SERVICE_LASSO_TEST_SENDER_ARTIFACT_ROOT_SHA256
if (!path.isAbsolute(rootPath ?? '') || !/^[a-f0-9]{64}$/.test(pin ?? '') ||
    process.version !== 'v22.23.2' || !['win32', 'linux'].includes(process.platform)) fail()
const raw = fs.readFileSync(rootPath)
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
if (raw.length > 4194304 || hash(raw) !== pin) fail()
const root = JSON.parse(raw)
if (root.schema !== 'sa-sender-artifact.v1' || root.platform !== process.platform ||
    root.nodeVersion !== '22.23.2' || !Array.isArray(root.members) ||
    root.members.length < 2 || root.members.length > 20000) fail()
const seen = new Set()
for (const row of root.members) {
  if (!path.isAbsolute(row.path) || seen.has(row.path) || !Number.isSafeInteger(row.size) ||
      row.size < 0 || row.size > 134217728 || !/^[a-f0-9]{64}$/.test(row.sha256)) fail()
  const bytes = fs.readFileSync(row.path)
  if (bytes.length !== row.size || hash(bytes) !== row.sha256) fail()
  seen.add(row.path)
}
for (const file of [process.execPath, root.addon, root.nativeSource, root.runtimeSource]) {
  if (!seen.has(file)) fail()
}
// Existing source/extracted loader rechecks original runtime equality before load.
