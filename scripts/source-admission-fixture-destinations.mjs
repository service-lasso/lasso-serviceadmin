// Private input selection only: no generated path or execution authority.
import fs from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const fail = () => { throw new Error('FIXTURE_RECEIVER_DESTINATION') }
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')

export function receiverEvidenceDestinations(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'extracted,source') fail()
  const result = {}
  for (const role of ['source', 'extracted']) {
    const selected = value[role]
    if (typeof selected !== 'string' || !path.isAbsolute(selected) ||
        /[\r\n\0]/.test(selected)) fail()
    result[role] = selected
  }
  const key = (file) => process.platform === 'win32'
    ? path.resolve(file).toLowerCase() : path.resolve(file)
  // Actual admitted parents must already exist. Resolve aliases before choosing
  // two originals; distinct spelling cannot disguise one receiving destination.
  const actual = (file) => path.join(fs.realpathSync(path.dirname(file)), path.basename(file))
  const source = key(actual(result.source))
  const extracted = key(actual(result.extracted))
  if (source === extracted || source.startsWith(`${extracted}${path.sep}`) ||
      extracted.startsWith(`${source}${path.sep}`)) fail()
  return Object.freeze(result)
}

export function selectReceiverEvidenceDestination(value, invocation) {
  if (!['source', 'extracted'].includes(invocation)) fail()
  const destinations = receiverEvidenceDestinations(value)
  const output = destinations[invocation]
  // A prior other invocation is retained; only this exact original must be absent.
  if (fs.existsSync(output)) fail()
  return output
}

export function qualificationReceiverEvidenceDestinations(root) {
  const selector = root.members?.find((row) => row.path === root.destinationSelectorSource)
  const ownBytes = fs.readFileSync(fileURLToPath(import.meta.url))
  if (!selector || ownBytes.length !== selector.size || digest(ownBytes) !== selector.sha256) fail()
  const declared = receiverEvidenceDestinations(root.receiverEvidenceDestinations)
  const selected = receiverEvidenceDestinations({
    source: process.env.SERVICE_LASSO_TEST_RECEIVER_SOURCE_EVIDENCE_DIR,
    extracted: process.env.SERVICE_LASSO_TEST_RECEIVER_EXTRACTED_EVIDENCE_DIR,
  })
  if (selected.source !== declared.source || selected.extracted !== declared.extracted) fail()
  return declared
}

export async function prepareReceiverEvidenceDirectory(value, invocation) {
  const output = selectReceiverEvidenceDestination(value, invocation)
  // Atomic absent-target creation still rejects races and retains all first bytes.
  await mkdir(output, { recursive: false })
  return output
}

export function readQualificationReceiverEvidenceDestinations() {
  const rootPath = process.env.SERVICE_LASSO_TEST_SENDER_ARTIFACT_ROOT
  const pin = process.env.SERVICE_LASSO_TEST_SENDER_ARTIFACT_ROOT_SHA256
  if (!path.isAbsolute(rootPath ?? '') || !/^[a-f0-9]{64}$/.test(pin ?? '') ||
      fs.statSync(rootPath).size > 4194304) fail()
  const raw = fs.readFileSync(rootPath)
  if (raw.length > 4194304 || digest(raw) !== pin) fail()
  const root = JSON.parse(raw)
  if (root.schema !== 'sa-sender-artifact.v1' || root.platform !== process.platform ||
      root.nodeVersion !== '22.23.2') fail()
  return qualificationReceiverEvidenceDestinations(root)
}
