import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import path from 'node:path'

const runtimeInputNames = Object.freeze([
  'workspaceRoot',
  'servicesRoot',
  'evidenceRoot',
  'supportRoot',
])
const registryNames = Object.freeze(['instanceRegistryPath', 'hostPortRegistryPath'])

function absolutePath(value, name) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value !== value.trim() ||
    !path.isAbsolute(value)
  ) {
    throw new Error(`${name} must be an absolute path.`)
  }
  return path.resolve(value)
}

function overlaps(left, right) {
  const relative = path.relative(left, right)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..')
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

export function parseExpectedRuntimeInputs(environment = process.env) {
  const inputs = Object.fromEntries(
    runtimeInputNames.map((name) => {
      const environmentName = `SERVICE_LASSO_TEST_${name
        .replace(/[A-Z]/g, (letter) => `_${letter}`)
        .toUpperCase()}`
      return [name, absolutePath(environment[environmentName], environmentName)]
    })
  )
  for (const name of registryNames) {
    const environmentName = `SERVICE_LASSO_${name
      .replace(/[A-Z]/g, (letter) => `_${letter}`)
      .toUpperCase()}`
    inputs[name] = absolutePath(environment[environmentName], environmentName)
  }
  for (let index = 0; index < runtimeInputNames.length; index += 1) {
    for (let other = index + 1; other < runtimeInputNames.length; other += 1) {
      if (
        overlaps(inputs[runtimeInputNames[index]], inputs[runtimeInputNames[other]]) ||
        overlaps(inputs[runtimeInputNames[other]], inputs[runtimeInputNames[index]])
      ) {
        throw new Error('Real browser runtime roots must be distinct and non-overlapping.')
      }
    }
  }
  return Object.freeze(inputs)
}

export async function validateExpectedRuntimeFilesystem(environment = process.env) {
  const inputs = parseExpectedRuntimeInputs(environment)
  for (const name of runtimeInputNames) {
    const info = await lstat(inputs[name]).catch(() => null)
    if (!info?.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`Caller-owned ${name} must be an existing real directory.`)
    }
  }
  for (const name of registryNames) {
    if (!inputs[name].startsWith(`${inputs.workspaceRoot}${path.sep}`)) {
      throw new Error(`Caller-owned ${name} must be beneath workspaceRoot.`)
    }
    const parent = await lstat(path.dirname(inputs[name])).catch(() => null)
    const existing = await lstat(inputs[name]).catch(() => null)
    if (!parent?.isDirectory() || parent.isSymbolicLink() || existing) {
      throw new Error(`Caller-owned ${name} must be absent beneath a real workspace directory.`)
    }
  }
  if (inputs.instanceRegistryPath === inputs.hostPortRegistryPath) {
    throw new Error('Caller-owned registry paths must be distinct.')
  }
  return inputs
}

async function readPrivateReceipt(filePath, expectedPath, expectedHash, label) {
  if (filePath !== expectedPath) {
    throw new Error(`${label} path was outside the caller-owned evidence root.`)
  }
  const info = await lstat(expectedPath)
  if (!info.isFile() || info.isSymbolicLink() || info.size < 1 || info.size > 1024 * 1024) {
    throw new Error(`${label} must be a bounded regular file.`)
  }
  const bytes = await readFile(expectedPath)
  if (bytes.length !== info.size || (expectedHash && sha256(bytes) !== expectedHash)) {
    throw new Error(`${label} changed or failed its public hash binding.`)
  }
  return JSON.parse(bytes.toString('utf8'))
}

export async function parseRuntimeInputs(ready, { environment = process.env, source, assets } = {}) {
  const runtimeInputs = parseExpectedRuntimeInputs(environment)
  const liveReceipt = ready?.liveReceipt
  if (!liveReceipt || typeof liveReceipt !== 'object' || Array.isArray(liveReceipt)) {
    throw new Error('Real browser runtime omitted its public live receipt.')
  }
  const fields = ['schema', 'nonce', 'prelaunchPath', 'prelaunchSHA256', 'initialPath', 'initialSHA256', 'readyPath', 'readySHA256', 'closurePath']
  if (Object.keys(liveReceipt).length !== fields.length || fields.some((field) => !(field in liveReceipt))) {
    throw new Error('Real browser runtime returned an incomplete public live receipt.')
  }
  if (liveReceipt.schema !== 'service-lasso.real-admin-browser-live-initial.v1' || !/^[a-f0-9]{64}$/.test(liveReceipt.nonce)) {
    throw new Error('Real browser runtime returned an invalid public live receipt identity.')
  }
  const receipts = {}
  for (const name of ['prelaunch', 'initial', 'ready']) {
    receipts[name] = await readPrivateReceipt(
      liveReceipt[`${name}Path`],
      path.join(runtimeInputs.evidenceRoot, `live-${name}-receipt.json`),
      liveReceipt[`${name}SHA256`],
      `Real browser ${name} receipt`
    )
  }
  if (!source || !/^[a-f0-9]{40}$/.test(source.head) || !/^[a-f0-9]{40}$/.test(source.tree)) {
    throw new Error('Expected Core source identity was invalid.')
  }
  for (const [name, receipt] of Object.entries(receipts)) {
    if (
      !receipt ||
      receipt.private !== true ||
      receipt.nonce !== liveReceipt.nonce ||
      receipt.source?.head !== source.head ||
      receipt.source?.tree !== source.tree ||
      receipt.runtimeInputs?.workspaceRoot !== runtimeInputs.workspaceRoot ||
      receipt.runtimeInputs?.servicesRoot !== runtimeInputs.servicesRoot
    ) {
      throw new Error(`Real browser ${name} receipt did not cross-bind its private runtime identity.`)
    }
  }
  const prelaunch = receipts.prelaunch
  if (
    prelaunch.schema !== 'service-lasso.real-admin-browser-live-prelaunch.v1' ||
    prelaunch.runner?.birthObserved !== true ||
    prelaunch.runner?.parentEdgeObserved !== true ||
    prelaunch.runner?.nativeIdentityObserved !== true ||
    !Array.isArray(prelaunch.assets)
  ) {
    throw new Error('Real browser prelaunch receipt did not prove its native runner identity.')
  }
  for (const [literalPath, expectedAsset] of Object.entries(assets ?? {})) {
    const observed = prelaunch.assets.find((asset) => asset?.literalPath === literalPath)
    if (!observed || observed.sha256 !== expectedAsset.sha256 || observed.size !== expectedAsset.size) {
      throw new Error('Real browser prelaunch receipt did not bind its expected native assets.')
    }
  }
  const initial = receipts.initial
  if (
    initial.schema !== 'service-lasso.real-admin-browser-live-initial.v1' ||
    initial.inputs?.workspaceRoot !== runtimeInputs.workspaceRoot ||
    initial.inputs?.instanceRegistryPath !== runtimeInputs.instanceRegistryPath ||
    initial.inputs?.hostPortRegistryPath !== runtimeInputs.hostPortRegistryPath ||
    initial.inputs?.servicesRoot !== runtimeInputs.servicesRoot ||
    initial.inputs?.evidenceRoot !== runtimeInputs.evidenceRoot ||
    initial.inputs?.supportRoot !== runtimeInputs.supportRoot
  ) {
    throw new Error('Real browser initial receipt did not bind caller-owned runtime inputs.')
  }
  if (
    receipts.ready.ownerCorrelation?.state !== 'observed' ||
    !Number.isInteger(receipts.ready.ownedProcesses?.runner?.pid) ||
    !Number.isInteger(receipts.ready.ownedProcesses?.admin?.pid) ||
    receipts.ready.ownedProcesses.admin.parentPid !== receipts.ready.ownedProcesses.runner.pid
  ) {
    throw new Error('Real browser ready receipt did not prove its owned native process chain.')
  }
  return Object.freeze({
    ...runtimeInputs,
    liveReceipt: Object.freeze({
      nonce: liveReceipt.nonce,
      closurePath: absolutePath(liveReceipt.closurePath, 'closurePath'),
    }),
  })
}

export async function verifyClosureReceipt(runtimeInputs, source) {
  const expectedPath = path.join(runtimeInputs.evidenceRoot, 'live-closure-receipt.json')
  const receipt = await readPrivateReceipt(
    runtimeInputs.liveReceipt.closurePath,
    expectedPath,
    null,
    'Real browser closure receipt'
  )
  if (
    receipt?.schema !== 'service-lasso.real-admin-browser-live-closure.v1' ||
    receipt.private !== true ||
    receipt.nonce !== runtimeInputs.liveReceipt.nonce ||
    receipt.source?.head !== source.head ||
    receipt.source?.tree !== source.tree ||
    receipt.outcome !== 'closed'
  ) {
    throw new Error('Real browser closure receipt did not close the validated runtime tuple.')
  }
}

export function brokerAuditPath({ workspaceRoot }) {
  return path.join(
    workspaceRoot,
    '.service-lasso',
    'secretsbroker',
    'audit.jsonl'
  )
}

export function rollbackProcessEvidencePath({ servicesRoot }) {
  return path.join(
    servicesRoot,
    'sample-service',
    '.state',
    'browser-broker-evidence.json'
  )
}

export function noLeakEvidenceRoots({ workspaceRoot, servicesRoot }, qualificationMode) {
  if (qualificationMode !== 'comprehensive') return []
  return [
    {
      directory: path.join(servicesRoot, 'sample-service', 'logs'),
      allowEmptyFiles: true,
    },
    {
      directory: path.join(
        workspaceRoot,
        '.service-lasso',
        'secret-rotations'
      ),
      allowEmptyFiles: false,
    },
  ]
}
