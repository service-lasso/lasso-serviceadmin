import type {
  InboxCountsResult,
  InboxListResult,
  OperatorInboxActionAvailability,
  OperatorInboxActionKind,
  OperatorInboxActionMetadata,
  OperatorInboxCounts,
  OperatorInboxFilter,
  OperatorInboxItem,
  OperatorInboxRelatedTarget,
  OperatorInboxSeverity,
  OperatorInboxSource,
  OperatorInboxState,
  OperatorInboxType,
  OperatorInboxVisibility,
} from './types'

const INBOX_TYPES: readonly OperatorInboxType[] = [
  'system',
  'workflow',
  'service',
  'update',
  'security',
  'help',
  'error',
]

const INBOX_SEVERITIES: readonly OperatorInboxSeverity[] = [
  'info',
  'success',
  'warning',
  'error',
  'critical',
]

const INBOX_SOURCES: readonly OperatorInboxSource[] = [
  'runtime',
  'service',
  'workflow',
  'updater',
  'broker',
  'admin-ui',
  'system',
]

const INBOX_STATES: readonly OperatorInboxState[] = ['unread', 'read']
const INBOX_VISIBILITIES: readonly OperatorInboxVisibility[] = [
  'visible',
  'hidden',
]
const INBOX_ACTION_KINDS: readonly OperatorInboxActionKind[] = [
  'link',
  'api',
  'command',
]
const INBOX_ACTION_AVAILABILITIES: readonly OperatorInboxActionAvailability[] =
  ['available', 'disabled', 'expired']

export const INBOX_UNAVAILABLE_REASON =
  'Service Lasso runtime Inbox API is not available.'

export type InboxDeepLink =
  | { kind: 'service'; serviceId: string }
  | { kind: 'logs'; serviceId?: string }
  | { kind: 'runtime' }
  | { kind: 'audit' }
  | { kind: 'telemetry' }
  | { kind: 'dashboard' }

/**
 * Narrows `value` to one of the provided string literals without assertions.
 */
function oneOf<T extends string>(
  value: unknown,
  values: readonly T[]
): T | null {
  if (typeof value !== 'string') {
    return null
  }

  for (const entry of values) {
    if (entry === value) {
      return entry
    }
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readNullableString(value: unknown): string | null {
  if (value === null) {
    return null
  }

  return readString(value)
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function emptyTypeCounts(): Record<OperatorInboxType, number> {
  return {
    system: 0,
    workflow: 0,
    service: 0,
    update: 0,
    security: 0,
    help: 0,
    error: 0,
  }
}

function emptySeverityCounts(): Record<OperatorInboxSeverity, number> {
  return {
    info: 0,
    success: 0,
    warning: 0,
    error: 0,
    critical: 0,
  }
}

function emptySourceCounts(): Record<OperatorInboxSource, number> {
  return {
    runtime: 0,
    service: 0,
    workflow: 0,
    updater: 0,
    broker: 0,
    'admin-ui': 0,
    system: 0,
  }
}

function emptyFilterCounts(): Record<OperatorInboxFilter, number> {
  return {
    all: 0,
    unread: 0,
    updates: 0,
    system: 0,
    workflow: 0,
    service: 0,
    errors: 0,
    hidden: 0,
  }
}

/**
 * Builds Core-compatible Inbox counts from a local item list.
 */
export function countOperatorInboxItems(
  items: OperatorInboxItem[]
): OperatorInboxCounts {
  const byType = emptyTypeCounts()
  const bySeverity = emptySeverityCounts()
  const bySource = emptySourceCounts()
  const byFilter = emptyFilterCounts()

  for (const item of items) {
    byType[item.type] += 1
    bySeverity[item.severity] += 1
    bySource[item.source] += 1

    if (item.visibility === 'hidden') {
      byFilter.hidden += 1
      continue
    }

    byFilter.all += 1
    if (item.state === 'unread') {
      byFilter.unread += 1
    }
    if (item.type === 'update') {
      byFilter.updates += 1
    }
    if (item.type === 'system') {
      byFilter.system += 1
    }
    if (item.type === 'workflow') {
      byFilter.workflow += 1
    }
    if (item.type === 'service') {
      byFilter.service += 1
    }
    if (
      item.type === 'error' ||
      item.severity === 'error' ||
      item.severity === 'critical'
    ) {
      byFilter.errors += 1
    }
  }

  return {
    total: items.length,
    unread: items.filter((item) => item.state === 'unread').length,
    read: items.filter((item) => item.state === 'read').length,
    visible: items.filter((item) => item.visibility === 'visible').length,
    hidden: items.filter((item) => item.visibility === 'hidden').length,
    byType,
    bySeverity,
    bySource,
    byFilter,
  }
}

/**
 * Returns the unread count operators should see in header/sidebar badges.
 */
export function unreadBadgeCount(counts: OperatorInboxCounts): number {
  return counts.byFilter.unread
}

export function unavailableInboxList(stubMode = false): InboxListResult {
  return {
    status: 'unavailable',
    stubMode,
    unavailableReason: INBOX_UNAVAILABLE_REASON,
    items: [],
    pagination: {
      limit: 50,
      nextCursor: null,
      total: 0,
    },
  }
}

export function unavailableInboxCounts(stubMode = false): InboxCountsResult {
  return {
    status: 'unavailable',
    stubMode,
    unavailableReason: INBOX_UNAVAILABLE_REASON,
    unread: 0,
    counts: null,
  }
}

function parseRelatedTarget(value: unknown): OperatorInboxRelatedTarget | null {
  if (value === null) {
    return null
  }
  if (!isRecord(value)) {
    return null
  }

  const relatedTarget: OperatorInboxRelatedTarget = {}
  const serviceId = readString(value.serviceId)
  const workflowId = readString(value.workflowId)
  const updateId = readString(value.updateId)
  const auditId = readString(value.auditId)
  const backupExportId = readString(value.backupExportId)
  const route = readString(value.route)

  if (serviceId) relatedTarget.serviceId = serviceId
  if (workflowId) relatedTarget.workflowId = workflowId
  if (updateId) relatedTarget.updateId = updateId
  if (auditId) relatedTarget.auditId = auditId
  if (backupExportId) relatedTarget.backupExportId = backupExportId
  if (route) relatedTarget.route = route

  return relatedTarget
}

function parseAction(value: unknown): OperatorInboxActionMetadata | null {
  if (value === null) {
    return null
  }
  if (!isRecord(value)) {
    return null
  }

  const label = readString(value.label)
  const target = readString(value.target)
  const kind = oneOf(value.kind, INBOX_ACTION_KINDS)
  const availability = oneOf(value.availability, INBOX_ACTION_AVAILABILITIES)

  if (!label || !target || !kind || !availability) {
    return null
  }

  return { label, target, kind, availability }
}

/**
 * Parses one durable operator Inbox item from runtime JSON.
 */
export function parseOperatorInboxItem(
  value: unknown
): OperatorInboxItem | null {
  if (!isRecord(value)) {
    return null
  }

  const id = readString(value.id)
  const dedupeKey = readString(value.dedupeKey)
  const title = readString(value.title)
  const summary = readString(value.summary)
  const details = readNullableString(value.details)
  const type = oneOf(value.type, INBOX_TYPES)
  const severity = oneOf(value.severity, INBOX_SEVERITIES)
  const source = oneOf(value.source, INBOX_SOURCES)
  const state = oneOf(value.state, INBOX_STATES)
  const visibility = oneOf(value.visibility, INBOX_VISIBILITIES)
  const createdAt = readString(value.createdAt)
  const updatedAt = readString(value.updatedAt)
  const readAt = readNullableString(value.readAt)
  const hiddenAt = readNullableString(value.hiddenAt)

  if (
    !id ||
    !dedupeKey ||
    !title ||
    summary === null ||
    details === undefined ||
    !type ||
    !severity ||
    !source ||
    !state ||
    !visibility ||
    !createdAt ||
    !updatedAt
  ) {
    return null
  }

  return {
    id,
    dedupeKey,
    title,
    summary,
    details,
    type,
    severity,
    source,
    state,
    visibility,
    createdAt,
    updatedAt,
    readAt,
    hiddenAt,
    relatedTarget: parseRelatedTarget(value.relatedTarget),
    action: parseAction(value.action),
  }
}

function parsePagination(value: unknown): InboxListResult['pagination'] | null {
  if (!isRecord(value)) {
    return null
  }

  const limit = readFiniteNumber(value.limit)
  const total = readFiniteNumber(value.total)
  const nextCursor =
    value.nextCursor === null ? null : readString(value.nextCursor)

  if (limit === null || total === null || nextCursor === undefined) {
    return null
  }

  return { limit, total, nextCursor }
}

function parseCountRecord<T extends string>(
  value: unknown,
  empty: Record<T, number>
): Record<T, number> | null {
  if (!isRecord(value)) {
    return null
  }

  const result = { ...empty }
  for (const key of Object.keys(empty) as T[]) {
    const count = readFiniteNumber(value[key])
    if (count === null) {
      return null
    }
    result[key] = count
  }
  return result
}

/**
 * Parses Core `GET /api/operator/inbox/counts` envelopes.
 */
export function parseInboxCountsPayload(
  value: unknown
): OperatorInboxCounts | null {
  const envelope =
    isRecord(value) && isRecord(value.inbox) ? value.inbox : value
  const countsValue = isRecord(envelope)
    ? isRecord(envelope.counts)
      ? envelope.counts
      : envelope
    : value

  if (!isRecord(countsValue)) {
    return null
  }

  const total = readFiniteNumber(countsValue.total)
  const unread = readFiniteNumber(countsValue.unread)
  const read = readFiniteNumber(countsValue.read)
  const visible = readFiniteNumber(countsValue.visible)
  const hidden = readFiniteNumber(countsValue.hidden)
  const byType = parseCountRecord(countsValue.byType, emptyTypeCounts())
  const bySeverity = parseCountRecord(
    countsValue.bySeverity,
    emptySeverityCounts()
  )
  const bySource = parseCountRecord(countsValue.bySource, emptySourceCounts())
  const byFilter = parseCountRecord(countsValue.byFilter, emptyFilterCounts())

  if (
    total === null ||
    unread === null ||
    read === null ||
    visible === null ||
    hidden === null ||
    !byType ||
    !bySeverity ||
    !bySource ||
    !byFilter
  ) {
    return null
  }

  return {
    total,
    unread,
    read,
    visible,
    hidden,
    byType,
    bySeverity,
    bySource,
    byFilter,
  }
}

/**
 * Parses Core `GET /api/operator/inbox` envelopes.
 */
export function parseInboxListPayload(value: unknown): InboxListResult | null {
  if (!isRecord(value) || !isRecord(value.inbox)) {
    return null
  }

  const listed = value.inbox
  if (!Array.isArray(listed.items)) {
    return null
  }

  const items: OperatorInboxItem[] = []
  for (const entry of listed.items) {
    const item = parseOperatorInboxItem(entry)
    if (!item) {
      return null
    }
    items.push(item)
  }

  const pagination = parsePagination(listed.pagination)
  if (!pagination) {
    return null
  }

  return {
    status: 'available',
    stubMode: false,
    unavailableReason: null,
    items,
    pagination,
  }
}

function decodePathSegment(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value)
    return decoded.trim() ? decoded : null
  } catch {
    return null
  }
}

/**
 * Maps Inbox target/action hrefs onto in-app Admin routes.
 * External URLs, protocol-relative paths, and unknown routes are dropped.
 */
export function resolveInboxDeepLink(
  rawHref: string | null | undefined
): InboxDeepLink | null {
  if (typeof rawHref !== 'string') {
    return null
  }

  const trimmed = rawHref.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null
  }
  if (trimmed.includes('\\') || trimmed.includes('://')) {
    return null
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed, 'https://service-admin.local')
  } catch {
    return null
  }

  if (parsed.username || parsed.password) {
    return null
  }

  const pathname = parsed.pathname.replace(/\/+$/, '') || '/'
  const serviceMatch = pathname.match(/^\/services\/([^/]+)(?:\/.*)?$/)
  if (serviceMatch) {
    const encodedId = serviceMatch[1]
    if (!encodedId) {
      return null
    }
    const serviceId = decodePathSegment(encodedId)
    if (!serviceId) {
      return null
    }
    return { kind: 'service', serviceId }
  }

  if (pathname === '/logs') {
    const serviceParam = parsed.searchParams.get('service')
    const serviceId = serviceParam ? decodePathSegment(serviceParam) : undefined
    if (serviceParam && !serviceId) {
      return null
    }
    return serviceId ? { kind: 'logs', serviceId } : { kind: 'logs' }
  }

  if (pathname === '/runtime') {
    return { kind: 'runtime' }
  }
  if (pathname === '/operations/audit-logging') {
    return { kind: 'audit' }
  }
  if (pathname === '/operations/telemetry') {
    return { kind: 'telemetry' }
  }
  if (pathname === '/') {
    return { kind: 'dashboard' }
  }

  return null
}

export type InboxViewFilter = 'unread' | 'read' | 'all' | 'hidden'

/**
 * Filters Inbox items for the Unread / Read / All / Hidden operator view.
 */
export function filterInboxItemsForView(
  items: OperatorInboxItem[],
  view: InboxViewFilter
): OperatorInboxItem[] {
  if (view === 'hidden') {
    return items.filter((item) => item.visibility === 'hidden')
  }

  const visible = items.filter((item) => item.visibility === 'visible')
  if (view === 'unread') {
    return visible.filter((item) => item.state === 'unread')
  }
  if (view === 'read') {
    return visible.filter((item) => item.state === 'read')
  }
  return visible
}
