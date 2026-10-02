import { lstat } from 'node:fs/promises'
import path from 'node:path'
import {
  absoluteOwnedPath,
  readHeldJsonFile,
  requireRealDirectoryChain,
} from './held-receipt-reader.mjs'

const runtimeInputNames = Object.freeze([
  'workspaceRoot',
  'servicesRoot',
  'evidenceRoot',
  'supportRoot',
  'registriesRoot',
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

export function parseExpectedRuntimeInputs(environment = process.env) {
  const inputs = Object.fromEntries(
    runtimeInputNames.map((name) => {
      const environmentName = name === 'workspaceRoot'
        ? 'SERVICE_LASSO_WORKSPACE_ROOT'
        : `SERVICE_LASSO_TEST_${name
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
    await requireRealDirectoryChain(inputs[name], `Caller-owned ${name}`)
  }
  for (const name of registryNames) {
    if (!inputs[name].startsWith(`${inputs.registriesRoot}${path.sep}`)) {
      throw new Error(`Caller-owned ${name} must be beneath registriesRoot.`)
    }
    if (path.dirname(inputs[name]) !== inputs.registriesRoot) {
      throw new Error(`Caller-owned ${name} must be a direct absent file in registriesRoot.`)
    }
    const expected = absoluteOwnedPath(inputs.registriesRoot, path.relative(inputs.registriesRoot, inputs[name]), `Caller-owned ${name}`)
    if (expected !== inputs[name]) throw new Error(`Caller-owned ${name} must be beneath registriesRoot.`)
    const existing = await lstat(inputs[name]).catch((error) =>
      error?.code === 'ENOENT' ? null : Promise.reject(error)
    )
    if (existing) throw new Error(`Caller-owned ${name} must be absent beneath a real registries directory.`)
  }
  if (inputs.instanceRegistryPath === inputs.hostPortRegistryPath) {
    throw new Error('Caller-owned registry paths must be distinct.')
  }
  return inputs
}

async function readPrivateReceipt(evidenceRoot, literalPath, label) {
  const { value } = await readHeldJsonFile({ root: evidenceRoot, literalPath, label, maxBytes: 1024 * 1024 })
  return value
}

export async function parseRuntimeInputs(ready, { environment = process.env, source, assets, observedRunner } = {}) {
  const runtimeInputs = parseExpectedRuntimeInputs(environment)
  const liveReceipt = ready?.liveReceipt
  if (!liveReceipt || typeof liveReceipt !== 'object' || Array.isArray(liveReceipt)) {
    throw new Error('Real browser runtime omitted its public live receipt.')
  }
  const fields = ['schema', 'nonce']
  if (Object.keys(liveReceipt).length !== fields.length || fields.some((field) => !(field in liveReceipt))) {
    throw new Error('Real browser runtime returned an incomplete public live receipt.')
  }
  if (liveReceipt.schema !== 'service-lasso.real-admin-browser-live-initial.v1' || !/^[a-f0-9]{64}$/.test(liveReceipt.nonce)) {
    throw new Error('Real browser runtime returned an invalid public live receipt identity.')
  }
  const receipts = {}
  for (const name of ['prelaunch', 'initial', 'ready']) {
    receipts[name] = await readPrivateReceipt(
      runtimeInputs.evidenceRoot,
      `live-${name}-receipt.json`,
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
    !Number.isInteger(prelaunch.runner?.pid) ||
    prelaunch.runner.pid < 1 ||
    !Number.isInteger(prelaunch.runner?.parentPid) ||
    prelaunch.runner.parentPid < 1 ||
    typeof prelaunch.runner?.birth !== 'string' ||
    prelaunch.runner.birth.length < 1 ||
    !Number.isInteger(prelaunch.runner?.nativeIdentity?.size) ||
    prelaunch.runner.nativeIdentity.size < 1 ||
    !/^sha256:[a-f0-9]{64}$/.test(prelaunch.runner.nativeIdentity.sha256) ||
    !Array.isArray(prelaunch.assets)
  ) {
    throw new Error('Real browser prelaunch receipt did not prove its native runner identity.')
  }
  if (
    !observedRunner ||
    prelaunch.runner.pid !== observedRunner.pid ||
    prelaunch.runner.parentPid !== observedRunner.parentPid ||
    prelaunch.runner.nativeIdentity.size !== observedRunner.nativeIdentity?.size ||
    prelaunch.runner.nativeIdentity.sha256 !== observedRunner.nativeIdentity?.sha256
  ) {
    throw new Error('Real browser prelaunch receipt did not bind the verifier-observed native runner.')
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
    receipts.ready.ownedProcesses.runner.pid !== prelaunch.runner.pid ||
    receipts.ready.ownedProcesses.runner.parentPid !== prelaunch.runner.parentPid ||
    receipts.ready.ownedProcesses.runner.nativeIdentity?.size !== prelaunch.runner.nativeIdentity.size ||
    receipts.ready.ownedProcesses.runner.nativeIdentity?.sha256 !== prelaunch.runner.nativeIdentity.sha256 ||
    receipts.ready.ownedProcesses.admin.parentPid !== receipts.ready.ownedProcesses.runner.pid
  ) {
    throw new Error('Real browser ready receipt did not prove its owned native process chain.')
  }
  return Object.freeze({
    ...runtimeInputs,
    liveReceipt: Object.freeze({
      nonce: liveReceipt.nonce,
    }),
  })
}

export async function verifyClosureReceipt(runtimeInputs, source) {
  const receipt = await readPrivateReceipt(
    runtimeInputs.evidenceRoot,
    'live-closure-receipt.json',
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
