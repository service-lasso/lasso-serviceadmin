import path from 'node:path'

const runtimeInputNames = Object.freeze([
  'workspaceRoot',
  'servicesRoot',
  'evidenceRoot',
  'supportRoot',
])

function resolveRuntimeInput(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Real browser runtime omitted ${name}.`)
  }
  return path.resolve(value)
}

export function parseRuntimeInputs(ready) {
  const inputs = ready?.runtimeInputs
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    throw new Error('Real browser runtime omitted explicit runtime inputs.')
  }
  if (
    Object.keys(inputs).length !== runtimeInputNames.length ||
    runtimeInputNames.some((name) => !(name in inputs))
  ) {
    throw new Error('Real browser runtime returned an incomplete runtime input contract.')
  }
  return Object.fromEntries(
    runtimeInputNames.map((name) => [name, resolveRuntimeInput(inputs[name], name)])
  )
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
