import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { readHeldJsonFile, readHeldRegularFile } from './held-receipt-reader.mjs'

const schema = 'service-lasso.real-browser-native-custody.v1'
const pathNames = Object.freeze([
  'SERVICE_LASSO_WORKSPACE_ROOT',
  'SERVICE_LASSO_TEST_REGISTRIES_ROOT',
  'SERVICE_LASSO_INSTANCE_REGISTRY_PATH',
  'SERVICE_LASSO_HOST_PORT_REGISTRY_PATH',
])

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function requiredRuntimePaths(environment = process.env) {
  const values = Object.fromEntries(
    pathNames.map((name) => {
      const value = environment[name]?.trim()
      if (!value || !path.isAbsolute(value)) {
        throw new Error(`${name} must be an absolute runtime path.`)
      }
      return [name, path.resolve(value)]
    })
  )
  if (new Set(Object.values(values)).size !== pathNames.length) {
    throw new Error('Qualification runtime paths must be unique.')
  }
  if (
    !values.SERVICE_LASSO_INSTANCE_REGISTRY_PATH.startsWith(
      `${values.SERVICE_LASSO_TEST_REGISTRIES_ROOT}${path.sep}`
    ) ||
    !values.SERVICE_LASSO_HOST_PORT_REGISTRY_PATH.startsWith(
      `${values.SERVICE_LASSO_TEST_REGISTRIES_ROOT}${path.sep}`
    )
  ) {
    throw new Error('Qualification registries must be owned by their separate registries root.')
  }
  if (
    values.SERVICE_LASSO_TEST_REGISTRIES_ROOT.startsWith(`${values.SERVICE_LASSO_WORKSPACE_ROOT}${path.sep}`) ||
    values.SERVICE_LASSO_WORKSPACE_ROOT.startsWith(`${values.SERVICE_LASSO_TEST_REGISTRIES_ROOT}${path.sep}`)
  ) {
    throw new Error('Qualification registries root must not overlap its workspace.')
  }
  return values
}

export async function initializeQualificationCustody({
  environment = process.env,
  receiptPath = environment.SERVICE_LASSO_QUALIFICATION_CUSTODY_RECEIPT_PATH,
} = {}) {
  const runtimePaths = requiredRuntimePaths(environment)
  const initialReceiptPath =
    environment.SERVICE_LASSO_QUALIFICATION_CUSTODY_INITIAL_RECEIPT_PATH ??
    receiptPath
  if (
    !receiptPath ||
    !path.isAbsolute(receiptPath) ||
    !initialReceiptPath ||
    !path.isAbsolute(initialReceiptPath)
  ) {
    throw new Error('SERVICE_LASSO_QUALIFICATION_CUSTODY_RECEIPT_PATH is required.')
  }
  await Promise.all([
    mkdir(runtimePaths.SERVICE_LASSO_WORKSPACE_ROOT, { recursive: true }),
    mkdir(runtimePaths.SERVICE_LASSO_TEST_REGISTRIES_ROOT, { recursive: true }),
  ])
  await Promise.all(
    [
      runtimePaths.SERVICE_LASSO_INSTANCE_REGISTRY_PATH,
      runtimePaths.SERVICE_LASSO_HOST_PORT_REGISTRY_PATH,
      receiptPath,
      initialReceiptPath,
    ].map((target) => mkdir(path.dirname(target), { recursive: true }))
  )
  const receipt = {
    schema,
    state: 'initialized',
    // This is a hash-only receipt.  The raw paths remain in the runner
    // environment and never enter an artifact.
    runtimePathHashes: pathNames.map((name) => sha256(runtimePaths[name])),
    owners: [],
  }
  await writeFile(initialReceiptPath, `${JSON.stringify(receipt)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  return receipt
}

export async function readQualificationCustody(receiptPath) {
  const resolved = path.resolve(receiptPath)
  const { value } = await readHeldJsonFile({
    root: path.dirname(resolved),
    literalPath: path.basename(resolved),
    label: 'Qualification custody receipt',
    maxBytes: 1024 * 1024,
  })
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.schema !== schema ||
    value.state !== 'initialized' ||
    !Array.isArray(value.runtimePathHashes) ||
    value.runtimePathHashes.length !== pathNames.length ||
    !value.runtimePathHashes.every((hash) => /^[a-f0-9]{64}$/.test(hash)) ||
    !Array.isArray(value.owners)
  ) {
    throw new Error('Qualification custody initial receipt was invalid.')
  }
  return value
}

export async function sha256Receipt(receiptPath) {
  const resolved = path.resolve(receiptPath)
  const bytes = await readHeldRegularFile({ root: path.dirname(resolved), literalPath: path.basename(resolved), label: 'Qualification custody receipt', maxBytes: 1024 * 1024 })
  return createHash('sha256').update(bytes).digest('hex')
}

export async function writeQualificationCustody(receiptPath, receipt) {
  await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
}

export async function finalizeAbsentQualificationCustody({
  initialReceiptPath = process.env.SERVICE_LASSO_QUALIFICATION_CUSTODY_INITIAL_RECEIPT_PATH,
  receiptPath = process.env.SERVICE_LASSO_QUALIFICATION_CUSTODY_RECEIPT_PATH,
} = {}) {
  const closed = path.resolve(receiptPath)
  try {
    await readHeldRegularFile({ root: path.dirname(closed), literalPath: path.basename(closed), label: 'Qualification custody closed receipt', maxBytes: 1024 * 1024 })
    return false
  } catch (error) {
    if (error?.message !== 'Qualification custody closed receipt could not be read from its held descriptor.') throw error
  }
  const initial = await readQualificationCustody(initialReceiptPath)
  const initialReceiptSha256 = await sha256Receipt(initialReceiptPath)
  await writeFile(closed, `${JSON.stringify({
    schema: initial.schema,
    state: 'closed',
    mode: 'unverified',
    outcome: 'unverified',
    causal: 'unverified',
    runtimePathHashes: initial.runtimePathHashes,
    initialReceiptSha256,
    sourceHashes: {},
    sourceBindings: [],
    owners: [],
  })}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  return true
}

export async function sha256File(filePath) {
  const resolved = path.resolve(filePath)
  const bytes = await readHeldRegularFile({ root: path.dirname(resolved), literalPath: path.basename(resolved), label: 'Qualification source file', maxBytes: 256 * 1024 * 1024 })
  return createHash('sha256').update(bytes).digest('hex')
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  if (process.argv[2] === 'initialize') await initializeQualificationCustody()
  else if (process.argv[2] === 'finalize') await finalizeAbsentQualificationCustody()
  else throw new Error('Expected qualification custody initialize or finalize command.')
}
