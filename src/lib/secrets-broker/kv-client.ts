/**
 * OpenBao-compatible KV v2 client for Secrets Broker.
 *
 * Admin talks only to Broker `/v1/kv/*` via the Core proxy. The same JSON works
 * for the local encrypted store and for a configured Vault/OpenBao source.
 */
import type { SecretsBrokerOverview } from '@/lib/secrets-broker/client'
import { serviceLassoApiBaseUrl } from '@/lib/service-lasso-dashboard/stub'

export type KvSourceOption = {
  id: string
  label: string
  kind: 'local' | 'vault' | 'openbao'
}

export type KvListResult = {
  keys: string[]
  missing: boolean
}

export type KvSecretData = {
  fields: Record<string, string>
  version: number
  createdTime: string
  deletionTime: string
  destroyed: boolean
}

export type KvWriteResult = {
  version: number
  createdTime: string
  deletionTime: string
  destroyed: boolean
}

export type KvMetadataVersion = {
  createdTime: string
  deletionTime: string
  destroyed: boolean
}

export type KvMetadata = {
  currentVersion: number
  createdTime: string
  updatedTime: string
  versions: Record<string, KvMetadataVersion>
}

export class KvRequestError extends Error {
  readonly status: number
  readonly errors: string[]

  constructor(status: number, errors: string[], message: string) {
    super(message)
    this.name = 'KvRequestError'
    this.status = status
    this.errors = errors
  }
}

type KvQuery = {
  source?: string
  mount?: string
  version?: number
  list?: boolean
  /** Operator audit reason for a controlled KV read. Sent as a header, not a query param. */
  reason?: string
}

/**
 * Build the KV source picker: local OOTB store plus configured Vault/OpenBao.
 */
export function kvSourceOptions(
  overview: SecretsBrokerOverview | null | undefined
): KvSourceOption[] {
  const sources: KvSourceOption[] = [
    {
      id: 'local',
      label: 'Local encrypted store',
      kind: 'local',
    },
  ]
  if (!overview) {
    return sources
  }
  for (const source of overview.sources) {
    const kind = source.provider.trim().toLowerCase()
    if (kind !== 'vault' && kind !== 'openbao') {
      continue
    }
    const id = source.id.trim()
    if (!id || id === 'local' || sources.some((item) => item.id === id)) {
      continue
    }
    sources.push({
      id,
      label: source.label.trim() || id,
      kind,
    })
  }
  return sources
}

/**
 * List immediate child keys for a KV prefix. Values are never returned.
 */
export async function listKvKeys(
  prefix: string,
  query: KvQuery = {}
): Promise<KvListResult> {
  try {
    const payload = await kvFetchJson(
      kvPath('metadata', prefix, { ...query, list: true })
    )
    return {
      keys: readStringList(readRecord(readRecord(payload).data).keys),
      missing: false,
    }
  } catch (error) {
    if (error instanceof KvRequestError && error.status === 404) {
      return { keys: [], missing: true }
    }
    throw error
  }
}

/**
 * Read one KV secret. Missing or soft-deleted versions throw KvRequestError 404.
 */
export async function readKvData(
  path: string,
  query: KvQuery = {}
): Promise<KvSecretData> {
  const headers: Record<string, string> = {}
  const reason = query.reason?.trim() ?? ''
  if (reason) {
    headers['X-Secretsbroker-Audit-Reason'] = reason
  }
  const payload = await kvFetchJson(kvPath('data', path, query), { headers })
  const data = readRecord(readRecord(payload).data)
  const metadata = readRecord(data.metadata)
  return {
    fields: readStringMap(data.data),
    version: readNumber(metadata.version),
    createdTime: readString(metadata.created_time),
    deletionTime: readString(metadata.deletion_time),
    destroyed: dataBoolean(metadata.destroyed),
  }
}

/**
 * Replace KV fields and return the new version metadata.
 */
export async function writeKvData(
  path: string,
  fields: Record<string, string>,
  cas: number | undefined,
  query: KvQuery = {}
): Promise<KvWriteResult> {
  return writeKv('POST', path, fields, cas, query)
}

/**
 * Merge KV fields into the current version.
 */
export async function patchKvData(
  path: string,
  fields: Record<string, string>,
  cas: number | undefined,
  query: KvQuery = {}
): Promise<KvWriteResult> {
  return writeKv('PATCH', path, fields, cas, query)
}

/**
 * Read version inventory without values.
 */
export async function readKvMetadata(
  path: string,
  query: KvQuery = {}
): Promise<KvMetadata> {
  const payload = await kvFetchJson(kvPath('metadata', path, query))
  const data = readRecord(readRecord(payload).data)
  const versions: Record<string, KvMetadataVersion> = {}
  const rawVersions = readRecord(data.versions)
  for (const [key, value] of Object.entries(rawVersions)) {
    const record = readRecord(value)
    versions[key] = {
      createdTime: readString(record.created_time),
      deletionTime: readString(record.deletion_time),
      destroyed: dataBoolean(record.destroyed),
    }
  }
  return {
    currentVersion: readNumber(data.current_version),
    createdTime: readString(data.created_time),
    updatedTime: readString(data.updated_time),
    versions,
  }
}

/**
 * Soft-delete the current version, or the supplied versions.
 */
export async function deleteKvVersions(
  path: string,
  versions: number[],
  query: KvQuery = {}
): Promise<void> {
  await kvFetchJson(kvPath('delete', path, query), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ versions }),
  })
}

/**
 * Restore previously soft-deleted versions.
 */
export async function undeleteKvVersions(
  path: string,
  versions: number[],
  query: KvQuery = {}
): Promise<void> {
  await kvFetchJson(kvPath('undelete', path, query), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ versions }),
  })
}

async function writeKv(
  method: 'POST' | 'PATCH',
  path: string,
  fields: Record<string, string>,
  cas: number | undefined,
  query: KvQuery
): Promise<KvWriteResult> {
  const body: { data: Record<string, string>; options?: { cas: number } } = {
    data: fields,
  }
  if (cas !== undefined) {
    body.options = { cas }
  }
  const payload = await kvFetchJson(kvPath('data', path, query), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = readRecord(readRecord(payload).data)
  return {
    version: readNumber(data.version),
    createdTime: readString(data.created_time),
    deletionTime: readString(data.deletion_time),
    destroyed: dataBoolean(data.destroyed),
  }
}

function kvPath(
  kind: 'data' | 'metadata' | 'delete' | 'undelete',
  path: string,
  query: KvQuery
): string {
  const trimmed = path.replace(/^\/+|\/+$/gu, '')
  const suffix = trimmed
    ? `/${trimmed.split('/').map(encodeURIComponent).join('/')}`
    : '/'
  const params = new URLSearchParams()
  const source = query.source?.trim() || 'local'
  params.set('source', source)
  if (query.mount?.trim()) {
    params.set('mount', query.mount.trim())
  }
  if (query.list) {
    params.set('list', 'true')
  }
  if (query.version && query.version > 0) {
    params.set('version', String(query.version))
  }
  return `/api/services/%40secretsbroker/proxy/v1/kv/${kind}${suffix}?${params.toString()}`
}

async function kvFetchJson(
  pathname: string,
  init?: RequestInit
): Promise<Record<string, unknown>> {
  const response = await fetch(`${serviceLassoApiBaseUrl}${pathname}`, init)
  if (response.status === 204) {
    return {}
  }
  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.toLowerCase().includes('application/json')
  const payload: unknown = isJson ? await response.json() : null
  if (!response.ok) {
    const errors = readErrorMessages(payload)
    throw new KvRequestError(
      response.status,
      errors,
      errors[0] ?? `Secrets Broker KV request returned ${response.status}.`
    )
  }
  if (!isJson) {
    throw new KvRequestError(
      response.status,
      ['non-json-response'],
      'Secrets Broker KV request returned non-JSON content.'
    )
  }
  return readRecord(payload)
}

function readErrorMessages(payload: unknown): string[] {
  const record = readRecord(payload)
  return readStringList(record.errors)
}

function readRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function dataBoolean(value: unknown): boolean {
  return value === true
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(
    (item): item is string => typeof item === 'string' && item.length > 0
  )
}

function readStringMap(value: unknown): Record<string, string> {
  const record = readRecord(value)
  const fields: Record<string, string> = {}
  for (const [key, fieldValue] of Object.entries(record)) {
    if (typeof fieldValue === 'string') {
      fields[key] = fieldValue
      continue
    }
    if (fieldValue === null || fieldValue === undefined) {
      fields[key] = ''
      continue
    }
    fields[key] = JSON.stringify(fieldValue)
  }
  return fields
}
