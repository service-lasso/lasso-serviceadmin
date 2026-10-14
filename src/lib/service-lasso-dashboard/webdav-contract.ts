import { requireSafeBrokerIdentifier } from './secrets-safe-text'

export type WebDAVFile = {
  grantId: string
  workspaceId: string
  serviceId: string
  path: string
  sizeBytes: number
  createdAt: string
  downloads: number
  servedBytes: number
  lastAccessAt?: string
}

export type WebDAVInventory = {
  state: 'listening' | 'stopped'
  generatedAt: string
  capacityBytes: number
  usedBytes: number
  activeGrants: number
  fileCount: number
  downloads: number
  servedBytes: number
  files: WebDAVFile[]
  nextCursor?: string
}

const invalid = () => new Error('Broker WebDAV inventory is invalid.')
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw invalid()
  return value as Record<string, unknown>
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw invalid()
  return value
}
function date(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 40 ||
    !/^\d{4}-\d\d-\d\dT/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw invalid()
  return value
}
function onlyKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key))) throw invalid()
}

export function normalizeWebDAVInventory(value: unknown): WebDAVInventory {
  const root = record(value)
  onlyKeys(root, [
    'serviceId',
    'outcome',
    'state',
    'generatedAt',
    'capacityBytes',
    'usedBytes',
    'activeGrants',
    'fileCount',
    'downloads',
    'servedBytes',
    'files',
    'nextCursor',
  ])
  if (
    root.serviceId !== '@secretsbroker' ||
    !['listening', 'stopped'].includes(String(root.state)) ||
    root.outcome !== (root.state === 'listening' ? 'ready' : 'unavailable') ||
    !Array.isArray(root.files) ||
    root.files.length > 200
  )
    throw invalid()
  const files = root.files.map((value) => {
    const row = record(value)
    onlyKeys(row, [
      'grantId',
      'workspaceId',
      'serviceId',
      'path',
      'sizeBytes',
      'createdAt',
      'downloads',
      'servedBytes',
      'lastAccessAt',
    ])
    if (
      typeof row.grantId !== 'string' ||
      !/^[a-f0-9]{32}$/.test(row.grantId) ||
      typeof row.path !== 'string' ||
      row.path.length > 512 ||
      !/^[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*$/.test(row.path) ||
      row.path.split('/').some((part) => part === '.' || part === '..')
    )
      throw invalid()
    return {
      grantId: row.grantId,
      workspaceId: requireSafeBrokerIdentifier(row.workspaceId, 'workspace'),
      serviceId: requireSafeBrokerIdentifier(row.serviceId, 'service'),
      path: row.path,
      sizeBytes: count(row.sizeBytes),
      createdAt: date(row.createdAt),
      downloads: count(row.downloads),
      servedBytes: count(row.servedBytes),
      ...(row.lastAccessAt === undefined
        ? {}
        : { lastAccessAt: date(row.lastAccessAt) }),
    }
  })
  if (
    root.nextCursor !== undefined &&
    (typeof root.nextCursor !== 'string' ||
      !/^\d{1,6}$/.test(root.nextCursor) ||
      Number(root.nextCursor) > 131072)
  )
    throw invalid()
  const result: WebDAVInventory = {
    state: root.state as WebDAVInventory['state'],
    generatedAt: date(root.generatedAt),
    capacityBytes: count(root.capacityBytes),
    usedBytes: count(root.usedBytes),
    activeGrants: count(root.activeGrants),
    fileCount: count(root.fileCount),
    downloads: count(root.downloads),
    servedBytes: count(root.servedBytes),
    files,
    ...(root.nextCursor === undefined
      ? {}
      : { nextCursor: root.nextCursor as string }),
  }
  if (
    result.capacityBytes < 1 ||
    result.usedBytes > result.capacityBytes ||
    files.length > result.fileCount
  )
    throw invalid()
  return result
}
