import {
  containsUnsafeBrokerText,
  sanitizeBrokerDisplayText,
} from '@/lib/service-lasso-dashboard/secrets-safe-text'

/**
 * Per-service Add Service operation status shared by catalog and archive.
 */
export type AddServiceProgressStatus =
  | 'pending'
  | 'downloading'
  | 'uploading'
  | 'validating'
  | 'copying'
  | 'registering'
  | 'complete'
  | 'skipped/conflict'
  | 'failed'

/**
 * One service row in the shared Add Service progress/result list.
 */
export type AddServiceProgressItem = {
  id: string
  label: string
  status: AddServiceProgressStatus
  message: string
  serviceId?: string
  nextAction?: string
}

type CatalogSelection = {
  id: string
  name: string
  version: string
}

const MAX_SAFE_DETAIL_LENGTH = 512
const WITHHELD_DETAIL = '[unsafe details withheld]'

/**
 * Returns true when value is a non-array object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Reads a trimmed non-empty string, otherwise undefined.
 */
function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Builds `/services/{id}` for a registered or already-present service id.
 */
export function serviceDetailsPath(serviceId: string): string {
  return `/services/${encodeURIComponent(serviceId)}`
}

/**
 * Parses a Service Details path produced by catalog or archive results.
 */
export function serviceIdFromDetailsUrl(url: string): string | undefined {
  const match = url.match(/^\/services\/([^/?#]+)/)
  if (!match) {
    return undefined
  }

  try {
    return decodeURIComponent(match[1] ?? '')
  } catch {
    return match[1]
  }
}

/**
 * Maps API and local operation tokens onto the shared status set.
 */
export function mapAddServiceStatus(
  value: string | undefined
): AddServiceProgressStatus | undefined {
  if (!value) {
    return undefined
  }

  if (value === 'registered' || value === 'imported' || value === 'complete') {
    return 'complete'
  }

  if (
    value === 'conflict' ||
    value === 'skipped' ||
    value === 'skipped/conflict'
  ) {
    return 'skipped/conflict'
  }

  if (
    value === 'failed' ||
    value === 'error' ||
    value === 'invalid' ||
    value === 'imported_failed'
  ) {
    return 'failed'
  }

  if (
    value === 'pending' ||
    value === 'downloading' ||
    value === 'uploading' ||
    value === 'validating' ||
    value === 'copying' ||
    value === 'registering'
  ) {
    return value
  }

  return undefined
}

/**
 * Operator-facing label for a shared Add Service status.
 */
export function addServiceStatusLabel(
  status: AddServiceProgressStatus
): string {
  if (status === 'skipped/conflict') {
    return 'Conflict'
  }

  if (status === 'complete') {
    return 'Complete'
  }

  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`
}

/**
 * Returns true when the status is still an in-flight operation.
 */
export function isAddServiceInFlight(
  status: AddServiceProgressStatus
): boolean {
  return (
    status === 'pending' ||
    status === 'downloading' ||
    status === 'uploading' ||
    status === 'validating' ||
    status === 'copying' ||
    status === 'registering'
  )
}

/**
 * Sanitizes operator-visible Add Service text. Secrets and overlong values
 * are withheld instead of rendered.
 */
export function sanitizeAddServiceDetail(
  value: unknown,
  fallback: string
): string {
  const sanitized = sanitizeBrokerDisplayText(value)
  if (sanitized) {
    return sanitized
  }

  if (typeof value === 'string' && containsUnsafeBrokerText(value)) {
    return WITHHELD_DETAIL
  }

  if (
    typeof value === 'string' &&
    value.trim().length > MAX_SAFE_DETAIL_LENGTH
  ) {
    return WITHHELD_DETAIL
  }

  return fallback
}

/**
 * Next-step copy for conflicted or failed services.
 */
export function addServiceNextAction(
  status: AddServiceProgressStatus,
  source: 'catalog' | 'archive'
): string | undefined {
  if (status === 'skipped/conflict') {
    return source === 'archive'
      ? 'Choose a different archive or service id. Existing services are not overwritten.'
      : 'Skip this package or open the existing service. Catalog install does not overwrite.'
  }

  if (status === 'failed') {
    return source === 'archive'
      ? 'Fix the archive, then upload and import again.'
      : 'Review the error, then retry this service from the catalog.'
  }

  return undefined
}

/**
 * Creates pending catalog rows so multi-select progress is visible immediately.
 */
export function createPendingCatalogItems(
  selections: readonly CatalogSelection[]
): AddServiceProgressItem[] {
  return selections.map((selection) => ({
    id: selection.id,
    label: selection.name,
    status: 'pending',
    message: `Waiting to install ${selection.name} ${selection.version}.`,
  }))
}

/**
 * Marks every in-flight catalog row as downloading while the install request
 * is outstanding. Terminal rows stay put so partial results remain visible.
 */
export function markCatalogItemsDownloading(
  items: readonly AddServiceProgressItem[]
): AddServiceProgressItem[] {
  return items.map((item) => {
    if (!isAddServiceInFlight(item.status) && item.status !== 'pending') {
      return item
    }

    return {
      ...item,
      status: 'downloading',
      message: `Downloading ${item.label}.`,
    }
  })
}

/**
 * Marks remaining in-flight catalog rows failed when the install request
 * itself fails. Completed and conflicted rows stay visible.
 */
export function markCatalogItemsRequestFailed(
  items: readonly AddServiceProgressItem[],
  errorMessage: string
): AddServiceProgressItem[] {
  const message = sanitizeAddServiceDetail(
    errorMessage,
    'Catalog install request failed.'
  )

  return items.map((item) => {
    if (!isAddServiceInFlight(item.status)) {
      return item
    }

    return {
      ...item,
      status: 'failed',
      message,
      nextAction: addServiceNextAction('failed', 'catalog'),
    }
  })
}

/**
 * Reads a Core or Admin catalog install payload into shared progress items.
 * Unknown shapes yield an empty list so the caller can keep local progress.
 */
export function catalogItemsFromInstallPayload(
  payload: unknown,
  selections: readonly CatalogSelection[]
): AddServiceProgressItem[] {
  const selectionById = new Map(
    selections.map((selection) => [selection.id, selection])
  )
  const rawItems = readInstallResultRecords(payload)

  return rawItems.map((item, index) => {
    const packageId =
      readString(item.packageId) ??
      readString(item.id) ??
      selections[index]?.id ??
      `catalog-${String(index)}`
    const selection = selectionById.get(packageId)
    const serviceId =
      readString(item.serviceId) ??
      serviceIdFromDetailsUrl(readString(item.serviceUrl) ?? '') ??
      (mapAddServiceStatus(
        readString(item.status) ?? readString(item.state)
      ) === 'complete'
        ? packageId
        : undefined)
    const status =
      mapAddServiceStatus(readString(item.state)) ??
      mapAddServiceStatus(readString(item.status)) ??
      mapAddServiceStatus(lastProgressToken(item.progress)) ??
      (item.ok === true ? 'complete' : 'failed')
    const conflictReason = readConflictReason(item.conflict)
    const message = sanitizeAddServiceDetail(
      readString(item.reason) ??
        readString(item.message) ??
        conflictReason ??
        defaultCatalogMessage(status, selection?.name ?? packageId),
      defaultCatalogMessage(status, selection?.name ?? packageId)
    )

    return {
      id: packageId,
      label: selection?.name ?? readString(item.name) ?? packageId,
      status,
      message,
      serviceId,
      nextAction: addServiceNextAction(status, 'catalog'),
    }
  })
}

/**
 * Builds the single archive progress row from the shipped upload/import state.
 */
export function archiveProgressItem(input: {
  fileName?: string
  uploadState: 'idle' | 'uploading' | 'uploaded' | 'error'
  importState: 'idle' | 'importing' | 'imported' | 'error'
  serviceId?: string
  displayName?: string
  validationStatus?: 'valid' | 'invalid'
  validationMessages?: readonly string[]
  conflictExists?: boolean
  conflictMessage?: string
  importStatus?: 'imported' | 'failed'
  importMessage?: string
  importServiceUrl?: string
  errorMessage?: string | null
}): AddServiceProgressItem | null {
  const label =
    input.displayName ?? input.fileName ?? input.serviceId ?? 'Service Archive'
  const id = input.serviceId ?? input.fileName ?? 'archive'

  if (input.uploadState === 'idle' && input.importState === 'idle') {
    return null
  }

  if (input.uploadState === 'uploading') {
    return {
      id,
      label,
      status: 'uploading',
      message: `Uploading ${input.fileName ?? 'archive'}.`,
    }
  }

  if (input.importState === 'importing') {
    return {
      id,
      label,
      status: 'registering',
      message: `Registering ${label}.`,
      serviceId: input.serviceId,
    }
  }

  if (input.importStatus === 'imported' || input.importState === 'imported') {
    const serviceId =
      input.serviceId ??
      serviceIdFromDetailsUrl(input.importServiceUrl ?? '') ??
      undefined

    return {
      id,
      label,
      status: 'complete',
      message: sanitizeAddServiceDetail(
        input.importMessage,
        `${label} was imported.`
      ),
      serviceId,
    }
  }

  if (input.conflictExists) {
    return {
      id,
      label,
      status: 'skipped/conflict',
      message: sanitizeAddServiceDetail(
        input.conflictMessage,
        'A service with this id already exists.'
      ),
      serviceId: input.serviceId,
      nextAction: addServiceNextAction('skipped/conflict', 'archive'),
    }
  }

  if (input.validationStatus === 'invalid') {
    return {
      id,
      label,
      status: 'failed',
      message: sanitizeAddServiceDetail(
        input.validationMessages?.join(' '),
        'Archive validation failed.'
      ),
      nextAction: addServiceNextAction('failed', 'archive'),
    }
  }

  if (
    input.uploadState === 'error' ||
    input.importState === 'error' ||
    input.importStatus === 'failed'
  ) {
    return {
      id,
      label,
      status: 'failed',
      message: sanitizeAddServiceDetail(
        input.errorMessage ?? input.importMessage,
        'Service Archive action failed.'
      ),
      nextAction: addServiceNextAction('failed', 'archive'),
    }
  }

  if (input.uploadState === 'uploaded' && input.validationStatus === 'valid') {
    return {
      id,
      label,
      status: 'validating',
      message: sanitizeAddServiceDetail(
        input.validationMessages?.join(' '),
        'Validation passed. Import when ready.'
      ),
      serviceId: input.serviceId,
    }
  }

  return {
    id,
    label,
    status: 'pending',
    message: `Waiting to process ${label}.`,
    serviceId: input.serviceId,
  }
}

/**
 * Collects result records from Core `{ install.results }` and Admin
 * `{ results | outcomes }` payloads without rewriting either contract.
 */
function readInstallResultRecords(
  payload: unknown
): Array<Record<string, unknown>> {
  if (!isRecord(payload)) {
    return []
  }

  const install = isRecord(payload.install) ? payload.install : undefined
  const items =
    (install && Array.isArray(install.results) ? install.results : undefined) ??
    (Array.isArray(payload.results) ? payload.results : undefined) ??
    (Array.isArray(payload.outcomes) ? payload.outcomes : undefined) ??
    []

  return items.filter(isRecord)
}

/**
 * Reads the last Core progress token when the payload includes a trail.
 */
function lastProgressToken(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined
  }

  const last = value[value.length - 1]
  return typeof last === 'string' ? last : undefined
}

/**
 * Reads a human conflict reason from Core `{ conflict }` or a string field.
 */
function readConflictReason(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return readString(value)
  }

  if (!isRecord(value)) {
    return undefined
  }

  return (
    readString(value.message) ??
    (readString(value.kind) === 'target_manifest_exists'
      ? 'A service with this id already exists and was not overwritten.'
      : readString(value.kind) === 'target_directory_exists'
        ? 'A directory for this service id already exists and was not overwritten.'
        : undefined)
  )
}

/**
 * Default catalog copy when the API omits a safe message.
 */
function defaultCatalogMessage(
  status: AddServiceProgressStatus,
  label: string
): string {
  if (status === 'complete') {
    return `${label} was registered.`
  }

  if (status === 'skipped/conflict') {
    return `${label} already exists.`
  }

  if (status === 'failed') {
    return `${label} did not complete.`
  }

  return `${label} is ${addServiceStatusLabel(status).toLowerCase()}.`
}
