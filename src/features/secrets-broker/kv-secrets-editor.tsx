import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, FileKey2, Folder, Plus, Trash2 } from 'lucide-react'
import type { SecretsBrokerOverview } from '@/lib/secrets-broker/client'
import {
  KvRequestError,
  deleteKvVersions,
  kvSourceOptions,
  listKvKeys,
  patchKvData,
  readKvData,
  readKvMetadata,
  undeleteKvVersions,
  writeKvData,
  type KvMetadata,
  type KvSourceOption,
} from '@/lib/secrets-broker/kv-client'
import { containsUnsafeBrokerText } from '@/lib/service-lasso-dashboard/secrets-safe-text'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type FieldRow = {
  key: string
  value: string
}

type RevealPrompt = {
  rowIndex: number
  reason: string
  confirmed: boolean
  error: string
}

type RevealRequest = {
  fieldKey: string
  reason: string
}

type KvSecretsEditorProps = {
  overview: SecretsBrokerOverview | null | undefined
  pathFilter?: string
  onPathFilterChange?: (value: string) => void
}

function parentPrefix(path: string): string {
  const trimmed = path.replace(/^\/+|\/+$/gu, '')
  const index = trimmed.lastIndexOf('/')
  if (index <= 0) {
    return ''
  }
  return trimmed.slice(0, index)
}

function joinPath(prefix: string, key: string): string {
  const leaf = key.replace(/\/$/u, '')
  if (!prefix) {
    return leaf
  }
  return `${prefix}/${leaf}`
}

/** Audited GET data reason used to hydrate field names without revealing values. */
export const KV_LOAD_FIELD_NAMES_REASON = 'load field names'

export type KvPathNavigation = {
  prefix: string
  selectedPath: string
  folder: boolean
}

/**
 * Parse a pasted or typed KV path into folder browse vs leaf select.
 * A trailing slash means browse that folder; otherwise treat as a leaf.
 */
export function parseKvPathNavigation(raw: string): KvPathNavigation {
  const original = raw.trim()
  const folder = original.endsWith('/')
  const trimmed = original.replace(/^\/+/gu, '').replace(/\/+$/gu, '')
  if (!trimmed) {
    return { prefix: '', selectedPath: '', folder: false }
  }
  if (folder) {
    return { prefix: trimmed, selectedPath: '', folder: true }
  }
  return {
    prefix: parentPrefix(trimmed),
    selectedPath: trimmed,
    folder: false,
  }
}

/**
 * Display value for the KV Path textbox: selected leaf, folder with slash, or empty.
 */
export function kvPathBoxValue(prefix: string, selectedPath: string): string {
  if (selectedPath) {
    return selectedPath
  }
  if (prefix) {
    return `${prefix}/`
  }
  return ''
}

/**
 * Keep field names only. Values must not be copied into editor state during hydrate.
 */
function maskSecretValues(
  fields: Record<string, string>
): Record<string, string> {
  const next: Record<string, string> = {}
  for (const key of Object.keys(fields)) {
    next[key] = ''
  }
  return next
}

function emptyCreateRow(): FieldRow[] {
  return [{ key: 'value', value: '' }]
}

function storedFieldValue(fields: Record<string, string>, key: string): string {
  const value = fields[key]
  return typeof value === 'string' ? value : ''
}

function hasStoredField(fields: Record<string, string>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(fields, key)
}

/**
 * Build editor rows from a KV read. Only the requested field's value is copied
 * into the row; other stored fields keep their names and stay empty.
 */
function buildRowsAfterRead(
  fields: Record<string, string>,
  revealedKey: string,
  previousRows: FieldRow[]
): FieldRow[] {
  const loadedKeys = new Set(Object.keys(fields))
  const loadedRows = Object.keys(fields).map((key) => ({
    key,
    value: key === revealedKey ? storedFieldValue(fields, key) : '',
  }))
  const extras = previousRows.filter((row) => {
    const key = row.key.trim()
    return key.length > 0 && !loadedKeys.has(key)
  })
  if (loadedRows.length === 0 && extras.length === 0) {
    return emptyCreateRow()
  }
  return [...loadedRows, ...extras]
}

/**
 * PATCH/POST payload: skip stored fields that are not currently revealed so an
 * empty masked row cannot overwrite a hidden value. Newly added keys are not
 * in `loadedFields`, so they are included.
 */
function fieldsForSave(
  rows: FieldRow[],
  loadedFields: Record<string, string>,
  revealedKey: string
): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (!key) {
      continue
    }
    if (hasStoredField(loadedFields, key) && key !== revealedKey) {
      continue
    }
    fields[key] = row.value
  }
  return fields
}

/**
 * Keep known field names after save. KV list/metadata only return path keys,
 * not field names, so the editor cannot rebuild rows from a list refresh.
 */
function rowsAfterSave(
  rows: FieldRow[],
  loadedFields: Record<string, string>
): FieldRow[] {
  const seen = new Set<string>()
  const next: FieldRow[] = []
  for (const row of rows) {
    const key = row.key.trim()
    if (!key || seen.has(key)) {
      continue
    }
    seen.add(key)
    next.push({ key, value: '' })
  }
  for (const key of Object.keys(loadedFields)) {
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    next.push({ key, value: '' })
  }
  if (next.length === 0) {
    return emptyCreateRow()
  }
  return next
}

/**
 * Mark saved and previously loaded keys as stored (names only) so the next
 * save still skips unrevealed fields. Values stay empty until an audited reveal.
 */
function loadedFieldsAfterSave(
  rows: FieldRow[],
  loadedFields: Record<string, string>
): Record<string, string> {
  const next: Record<string, string> = {}
  for (const key of Object.keys(loadedFields)) {
    next[key] = ''
  }
  for (const row of rows) {
    const key = row.key.trim()
    if (key) {
      next[key] = ''
    }
  }
  return next
}

/**
 * List KV versions newest-first without including secret values.
 */
function versionEntries(metadata: KvMetadata | undefined): Array<{
  version: number
  deleted: boolean
}> {
  if (!metadata) {
    return []
  }
  return Object.keys(metadata.versions)
    .map((key) => Number(key))
    .filter((version) => Number.isInteger(version) && version > 0)
    .sort((left, right) => right - left)
    .map((version) => ({
      version,
      deleted: Boolean(metadata.versions[String(version)]?.deletionTime),
    }))
}

function errorMessage(error: unknown): string {
  if (error instanceof KvRequestError) {
    return error.message
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return 'KV request failed.'
}

/**
 * Reject empty or secret-like audit reasons so the reason cannot carry a value.
 */
function auditReasonRejection(reason: string): string {
  const trimmed = reason.trim()
  if (!trimmed) {
    return 'Enter an audit reason before revealing.'
  }
  if (containsUnsafeBrokerText(trimmed)) {
    return 'Audit reason cannot contain secret material.'
  }
  return ''
}

/**
 * Accessible name for the icon-only reveal/hide control.
 */
function revealButtonLabel(
  row: FieldRow,
  index: number,
  revealedKey: string,
  fieldsLoaded: boolean
): string {
  const key = row.key.trim()
  if (key && key === revealedKey) {
    return `Hide ${key}`
  }
  if (key) {
    return `Reveal ${key}`
  }
  if (!fieldsLoaded) {
    return 'Load fields'
  }
  return `Reveal field ${index + 1}`
}

/**
 * Dialog heading for the audited reveal prompt.
 */
function revealDialogTitle(
  row: FieldRow | undefined,
  fieldsLoaded: boolean
): string {
  const key = row?.key.trim() ?? ''
  if (key) {
    return `Reveal ${key}`
  }
  if (!fieldsLoaded) {
    return 'Load field names'
  }
  return 'Reveal secret field'
}

/**
 * Case-insensitive substring match for path and key search filters.
 */
export function matchesKvFilter(value: string, filter: string): boolean {
  const needle = filter.trim().toLowerCase()
  if (!needle) {
    return true
  }
  return value.toLowerCase().includes(needle)
}

/**
 * Paths shown in the KV Path pane after applying the path search filter.
 */
export function filterKvPaths(keys: string[], filter: string): string[] {
  return keys.filter((key) => matchesKvFilter(key, filter))
}

/**
 * Keep unnamed draft rows visible while filtering the KV Value table by key.
 */
export function fieldRowVisibleInKeyFilter(
  fieldKey: string,
  filter: string
): boolean {
  const trimmed = fieldKey.trim()
  if (!trimmed) {
    return true
  }
  return matchesKvFilter(trimmed, filter)
}

/**
 * OpenBao-shaped path browser and field editor for local or remote KV sources.
 * Source sits in page chrome above the card. The card is a 50/50 Path/Value
 * split with independent scroll. Stored values stay hidden until a per-row
 * audited reveal; only one field value is shown at a time.
 */
export function KvSecretsEditor({
  overview,
  pathFilter: pathFilterProp,
  onPathFilterChange,
}: KvSecretsEditorProps) {
  const queryClient = useQueryClient()
  const sources = useMemo(() => kvSourceOptions(overview), [overview])
  const [sourceId, setSourceId] = useState('local')
  const [prefix, setPrefix] = useState('')
  const [selectedPath, setSelectedPath] = useState('')
  const [createPath, setCreatePath] = useState('')
  const [rows, setRows] = useState<FieldRow[]>(emptyCreateRow())
  const [revealedKey, setRevealedKey] = useState('')
  const [loadedFields, setLoadedFields] = useState<Record<string, string>>({})
  const [revealPrompt, setRevealPrompt] = useState<RevealPrompt | null>(null)
  const [cas, setCas] = useState<number | undefined>(undefined)
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(
    undefined
  )
  const [status, setStatus] = useState('')
  const [uncontrolledPathFilter, setUncontrolledPathFilter] = useState('')
  const [keyFilter, setKeyFilter] = useState('')
  const [pathDraft, setPathDraft] = useState('')
  const pathFilter = pathFilterProp ?? uncontrolledPathFilter

  /**
   * Keep URL-backed path filters when the page supplies them; otherwise
   * store the filter locally for isolated editor tests.
   */
  const setPathFilter = (value: string) => {
    if (onPathFilterChange) {
      onPathFilterChange(value)
      return
    }
    setUncontrolledPathFilter(value)
  }

  const source: KvSourceOption = sources.find(
    (item) => item.id === sourceId
  ) ?? {
    id: 'local',
    label: 'Local encrypted store',
    kind: 'local',
  }
  const query = { source: source.id }
  const fieldsLoaded = Object.keys(loadedFields).length > 0

  const listQuery = useQuery({
    queryKey: ['secrets-broker', 'kv', 'list', source.id, prefix],
    queryFn: () => listKvKeys(prefix, { source: source.id }),
  })

  const metadataQuery = useQuery({
    queryKey: ['secrets-broker', 'kv', 'metadata', source.id, selectedPath],
    queryFn: () => readKvMetadata(selectedPath, { source: source.id }),
    enabled: selectedPath.length > 0,
  })

  const metadataReady = selectedPath.length > 0
  const versions = versionEntries(metadataQuery.data)
  const currentVersion = metadataQuery.data?.currentVersion
  const writeCas =
    cas ?? (currentVersion && currentVersion > 0 ? currentVersion : undefined)

  const resetStoredReveal = () => {
    setRevealedKey('')
    setLoadedFields({})
    setRevealPrompt(null)
  }

  useEffect(() => {
    setPathDraft(kvPathBoxValue(prefix, selectedPath))
  }, [prefix, selectedPath])

  /**
   * Metadata has no field names. Hydrate keys from audited GET data and keep
   * values masked until a per-row reveal.
   */
  useEffect(() => {
    if (!selectedPath) {
      return
    }
    let cancelled = false
    setStatus('Loading field names.')
    void readKvData(selectedPath, {
      source: source.id,
      version: selectedVersion,
      reason: KV_LOAD_FIELD_NAMES_REASON,
    })
      .then((data) => {
        if (cancelled) {
          return
        }
        setLoadedFields(maskSecretValues(data.fields))
        setCas(data.version)
        setRevealedKey('')
        setRevealPrompt(null)
        setRows(buildRowsAfterRead(data.fields, '', []))
        setStatus(
          `Loaded field names for version ${data.version}. Reveal one field at a time.`
        )
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        setLoadedFields({})
        setRevealedKey('')
        setRevealPrompt(null)
        setRows([{ key: '', value: '' }])
        if (error instanceof KvRequestError && error.status === 404) {
          setStatus('No stored secret at this path. Add fields to create it.')
          return
        }
        setStatus(errorMessage(error))
      })
    return () => {
      cancelled = true
    }
  }, [selectedPath, selectedVersion, source.id])

  const applyPathNavigation = (raw: string) => {
    const next = parseKvPathNavigation(raw)
    setPathFilter('')
    setKeyFilter('')
    setCreatePath('')
    resetStoredReveal()
    setCas(undefined)
    setSelectedVersion(undefined)
    if (!next.selectedPath && !next.prefix) {
      setPrefix('')
      setSelectedPath('')
      setRows(emptyCreateRow())
      setStatus('')
      setPathDraft('')
      return
    }
    if (next.folder || !next.selectedPath) {
      setPrefix(next.prefix)
      setSelectedPath('')
      setRows(emptyCreateRow())
      setStatus(next.prefix ? `Browsing ${next.prefix}.` : '')
      setPathDraft(kvPathBoxValue(next.prefix, ''))
      return
    }
    setPrefix(next.prefix)
    setSelectedPath(next.selectedPath)
    setRows([{ key: '', value: '' }])
    setPathDraft(next.selectedPath)
  }

  const revealMutation = useMutation({
    mutationFn: async ({ fieldKey, reason }: RevealRequest) => {
      const data = await readKvData(selectedPath, {
        source: source.id,
        version: selectedVersion,
        reason,
      })
      return { data, fieldKey }
    },
    onSuccess: ({ data, fieldKey }) => {
      const nextRevealed =
        fieldKey && hasStoredField(data.fields, fieldKey) ? fieldKey : ''
      const masked = maskSecretValues(data.fields)
      if (nextRevealed) {
        masked[nextRevealed] = storedFieldValue(data.fields, nextRevealed)
      }
      setLoadedFields(masked)
      setCas(data.version)
      setRevealedKey(nextRevealed)
      setRows((previous) =>
        buildRowsAfterRead(data.fields, nextRevealed, previous)
      )
      setRevealPrompt(null)
      setStatus(
        nextRevealed
          ? `Showing ${nextRevealed} from version ${data.version}. Hide it when finished.`
          : `Loaded field names for version ${data.version}. Reveal one field at a time.`
      )
    },
    onError: (error) => {
      setRevealedKey('')
      setStatus(errorMessage(error))
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const navigated = parseKvPathNavigation(pathDraft)
      const path =
        selectedPath ||
        navigated.selectedPath ||
        joinPath(prefix, createPath.trim())
      const fields = fieldsForSave(rows, loadedFields, revealedKey)
      if (!path) {
        throw new Error('Enter a KV path before saving.')
      }
      if (Object.keys(fields).length === 0) {
        throw new Error('Add at least one field before saving.')
      }
      if (selectedPath && writeCas !== undefined) {
        return patchKvData(path, fields, writeCas, query)
      }
      return writeKvData(path, fields, writeCas, query)
    },
    onSuccess: async (result) => {
      const navigated = parseKvPathNavigation(pathDraft)
      const path =
        selectedPath ||
        navigated.selectedPath ||
        joinPath(prefix, createPath.trim())
      const nextRows = rowsAfterSave(rows, loadedFields)
      const nextLoaded = loadedFieldsAfterSave(rows, loadedFields)
      setSelectedPath(path)
      setCreatePath('')
      setCas(result.version)
      setStatus(`Saved version ${result.version}.`)
      setRevealedKey('')
      setRevealPrompt(null)
      setLoadedFields(nextLoaded)
      setRows(nextRows)
      await queryClient.invalidateQueries({
        queryKey: ['secrets-broker', 'kv'],
      })
    },
    onError: (error) => {
      setStatus(errorMessage(error))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteKvVersions(selectedPath, writeCas ? [writeCas] : [], query),
    onSuccess: async () => {
      setStatus('Soft-deleted the current version. Undelete restores it.')
      resetStoredReveal()
      setRows(emptyCreateRow())
      await queryClient.invalidateQueries({
        queryKey: ['secrets-broker', 'kv'],
      })
    },
    onError: (error) => {
      setStatus(errorMessage(error))
    },
  })

  const undeleteMutation = useMutation({
    mutationFn: () =>
      undeleteKvVersions(selectedPath, writeCas ? [writeCas] : [], query),
    onSuccess: async () => {
      setStatus('Restored the selected version.')
      await queryClient.invalidateQueries({
        queryKey: ['secrets-broker', 'kv'],
      })
    },
    onError: (error) => {
      setStatus(errorMessage(error))
    },
  })

  const keys = listQuery.data?.keys ?? []
  const visiblePaths = filterKvPaths(keys, pathFilter)
  const visibleFieldRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => fieldRowVisibleInKeyFilter(row.key, keyFilter))
  const busy =
    saveMutation.isPending ||
    deleteMutation.isPending ||
    undeleteMutation.isPending ||
    revealMutation.isPending

  const openRevealPrompt = (rowIndex: number) => {
    setRevealPrompt({
      rowIndex,
      reason: '',
      confirmed: false,
      error: '',
    })
  }

  const hideRevealedRow = (rowIndex: number) => {
    const row = rows[rowIndex]
    if (!row) {
      return
    }
    const next = [...rows]
    next[rowIndex] = { ...row, value: '' }
    setRows(next)
    setRevealedKey('')
    setRevealPrompt(null)
    setStatus('Value hidden.')
  }

  const submitRevealPrompt = () => {
    if (!revealPrompt) {
      return
    }
    const row = rows[revealPrompt.rowIndex]
    if (!row) {
      setRevealPrompt(null)
      return
    }
    const reasonError = auditReasonRejection(revealPrompt.reason)
    if (reasonError) {
      setRevealPrompt({ ...revealPrompt, error: reasonError })
      return
    }
    if (!revealPrompt.confirmed) {
      setRevealPrompt({
        ...revealPrompt,
        error: 'Confirm the controlled reveal before continuing.',
      })
      return
    }
    revealMutation.mutate({
      fieldKey: row.key.trim(),
      reason: revealPrompt.reason.trim(),
    })
  }

  return (
    <div
      className='flex min-h-0 flex-1 flex-col gap-3'
      data-testid='kv-secrets-editor'
    >
      <div
        className='flex shrink-0 flex-wrap items-end gap-3'
        data-testid='kv-source-chrome'
      >
        <div className='space-y-1'>
          <Label htmlFor='kv-source'>Source</Label>
          <select
            id='kv-source'
            className='h-9 rounded-md border border-input bg-transparent px-3 text-sm'
            value={source.id}
            onChange={(event) => {
              setSourceId(event.target.value)
              setPrefix('')
              setSelectedPath('')
              resetStoredReveal()
              setCas(undefined)
              setSelectedVersion(undefined)
              setStatus('')
              setPathFilter('')
              setKeyFilter('')
            }}
          >
            {sources.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card
        className='flex min-h-0 flex-1 flex-col overflow-hidden'
        data-testid='kv-store-card'
      >
        <CardHeader className='shrink-0'>
          <CardTitle className='flex items-center gap-2'>
            <FileKey2 className='size-4' />
            KV store
          </CardTitle>
        </CardHeader>
        <CardContent className='flex min-h-0 flex-1 flex-col overflow-hidden'>
          <div className='grid min-h-0 flex-1 grid-cols-2 gap-4'>
            <section
              className='flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border'
              data-testid='kv-path-pane'
              aria-label='KV Path'
            >
              <div className='flex shrink-0 flex-col gap-2 border-b p-3'>
                <h3 className='text-sm font-medium'>KV Path</h3>
                <div className='space-y-1'>
                  <Label htmlFor='kv-path'>Path</Label>
                  <Input
                    id='kv-path'
                    aria-label='KV path'
                    value={pathDraft}
                    onChange={(event) => setPathDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        applyPathNavigation(pathDraft)
                      }
                    }}
                    onPaste={(event) => {
                      const pasted = event.clipboardData.getData('text')
                      if (!pasted.trim()) {
                        return
                      }
                      event.preventDefault()
                      setPathDraft(pasted.trim())
                      applyPathNavigation(pasted)
                    }}
                    placeholder={prefix ? `${prefix}/app/db` : 'apps/db'}
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='kv-path-filter'>Filter paths</Label>
                  <Input
                    id='kv-path-filter'
                    aria-label='Filter paths'
                    value={pathFilter}
                    onChange={(event) => setPathFilter(event.target.value)}
                    placeholder='Search paths'
                  />
                </div>
                <div className='flex flex-wrap items-center gap-2 text-sm'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => {
                      applyPathNavigation('')
                    }}
                  >
                    root
                  </Button>
                  {prefix
                    .split('/')
                    .filter(Boolean)
                    .map((segment, index, all) => {
                      const next = all.slice(0, index + 1).join('/')
                      return (
                        <Button
                          key={next}
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() => {
                            applyPathNavigation(`${next}/`)
                          }}
                        >
                          / {segment}
                        </Button>
                      )
                    })}
                  {prefix ? (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => {
                        const parent = parentPrefix(prefix)
                        applyPathNavigation(parent ? `${parent}/` : '')
                      }}
                    >
                      Up
                    </Button>
                  ) : null}
                </div>
              </div>

              {listQuery.isError ? (
                <Alert variant='destructive' className='m-3 shrink-0'>
                  <AlertTitle>KV list unavailable</AlertTitle>
                  <AlertDescription>
                    {errorMessage(listQuery.error)}
                  </AlertDescription>
                </Alert>
              ) : null}

              <div
                className='grid min-h-0 flex-1 content-start gap-2 overflow-auto p-3'
                data-testid='kv-store-key-list'
              >
                {keys.length === 0 && !listQuery.isLoading ? (
                  <p className='text-sm text-muted-foreground'>
                    No keys at this path. Create one in KV Value.
                  </p>
                ) : null}
                {keys.length > 0 && visiblePaths.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>
                    No paths match this filter.
                  </p>
                ) : null}
                {visiblePaths.map((key) => {
                  const isFolder = key.endsWith('/')
                  const fullPath = joinPath(prefix, key)
                  return (
                    <Button
                      key={key}
                      type='button'
                      variant={
                        fullPath === selectedPath ? 'default' : 'outline'
                      }
                      className='justify-start'
                      onClick={() => {
                        if (isFolder) {
                          applyPathNavigation(`${fullPath}/`)
                          return
                        }
                        applyPathNavigation(fullPath)
                      }}
                    >
                      {isFolder ? (
                        <Folder className='size-4' />
                      ) : (
                        <FileKey2 className='size-4' />
                      )}
                      {key}
                    </Button>
                  )
                })}
              </div>
            </section>

            <section
              className='flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border'
              data-testid='kv-value-pane'
              aria-label='KV Value'
            >
              <div className='flex shrink-0 flex-col gap-2 border-b p-3'>
                <h3 className='text-sm font-medium'>KV Value</h3>
                <div className='space-y-1'>
                  <Label htmlFor='kv-key-filter'>Search keys</Label>
                  <Input
                    id='kv-key-filter'
                    aria-label='Search keys'
                    value={keyFilter}
                    onChange={(event) => setKeyFilter(event.target.value)}
                    placeholder='Search keys'
                  />
                </div>
              </div>

              <div
                className='flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3'
                data-testid='kv-store-field-editor'
              >
                {versions.length > 0 ? (
                  <div className='space-y-2'>
                    <p className='text-xs font-medium text-muted-foreground uppercase'>
                      Versions
                    </p>
                    <div className='flex flex-wrap gap-2'>
                      {versions.map((entry) => (
                        <Button
                          key={entry.version}
                          type='button'
                          size='sm'
                          variant={
                            selectedVersion === entry.version ||
                            (selectedVersion === undefined &&
                              entry.version === currentVersion)
                              ? 'default'
                              : 'outline'
                          }
                          onClick={() => {
                            setSelectedVersion(entry.version)
                            setCas(entry.version)
                            resetStoredReveal()
                            setStatus(
                              entry.deleted
                                ? `Version ${entry.version} is soft-deleted. Undelete restores it.`
                                : `Version ${entry.version} selected. Reveal one field at a time.`
                            )
                          }}
                        >
                          v{entry.version}
                          {entry.deleted ? ' deleted' : ''}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {rows.length > 0 && visibleFieldRows.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>
                    No keys match this filter.
                  </p>
                ) : null}

                <Table contained={false}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead className='w-12'>
                        <span className='sr-only'>Reveal</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleFieldRows.map(({ row, index }) => {
                      const key = row.key.trim()
                      const isRevealed = Boolean(key) && key === revealedKey
                      const showRevealControls = metadataReady
                      return (
                        <TableRow key={`field-${index}`}>
                          <TableCell className='whitespace-normal'>
                            <Input
                              aria-label={`Field ${index + 1} name`}
                              value={row.key}
                              onChange={(event) => {
                                const next = [...rows]
                                const nextKey = event.target.value
                                next[index] = { ...row, key: nextKey }
                                setRows(next)
                                if (revealedKey && revealedKey === key) {
                                  setRevealedKey(nextKey.trim())
                                }
                              }}
                              placeholder='field name'
                            />
                          </TableCell>
                          <TableCell className='whitespace-normal'>
                            <Input
                              aria-label={`Field ${index + 1} value`}
                              type={
                                isRevealed || !metadataReady
                                  ? 'text'
                                  : 'password'
                              }
                              value={row.value}
                              onChange={(event) => {
                                const next = [...rows]
                                next[index] = {
                                  ...row,
                                  value: event.target.value,
                                }
                                setRows(next)
                              }}
                              placeholder={
                                isRevealed
                                  ? 'secret value'
                                  : metadataReady
                                    ? 'hidden until this field is revealed'
                                    : 'secret value'
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {showRevealControls ? (
                              <Button
                                type='button'
                                variant='outline'
                                size='icon'
                                disabled={busy}
                                aria-label={revealButtonLabel(
                                  row,
                                  index,
                                  revealedKey,
                                  fieldsLoaded
                                )}
                                onClick={() => {
                                  if (isRevealed) {
                                    hideRevealedRow(index)
                                    return
                                  }
                                  openRevealPrompt(index)
                                }}
                              >
                                {isRevealed ? (
                                  <EyeOff className='size-4' />
                                ) : (
                                  <Eye className='size-4' />
                                )}
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className='flex shrink-0 flex-col gap-2 border-t p-3'>
                <div className='flex flex-wrap gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => setRows([...rows, { key: '', value: '' }])}
                  >
                    <Plus className='size-4' />
                    Add field
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    disabled={busy}
                    onClick={() => saveMutation.mutate()}
                  >
                    Save
                  </Button>
                  {metadataReady ? (
                    <Button
                      type='button'
                      variant='destructive'
                      size='sm'
                      disabled={busy}
                      onClick={() => deleteMutation.mutate()}
                    >
                      <Trash2 className='size-4' />
                      Soft delete
                    </Button>
                  ) : null}
                  {metadataReady ? (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      disabled={busy}
                      onClick={() => undeleteMutation.mutate()}
                    >
                      Undelete
                    </Button>
                  ) : null}
                </div>
                {writeCas !== undefined ? (
                  <p className='text-xs text-muted-foreground'>
                    CAS version {writeCas}
                    {currentVersion ? ` · current ${currentVersion}` : ''}
                  </p>
                ) : null}
                {status ? <p className='text-sm'>{status}</p> : null}
              </div>
            </section>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={revealPrompt !== null}
        onOpenChange={(open) => {
          if (!open && !revealMutation.isPending) {
            setRevealPrompt(null)
          }
        }}
      >
        <DialogContent
          className='sm:max-w-md'
          overlayClassName='bg-black/40 backdrop-blur-sm'
        >
          <DialogHeader>
            <DialogTitle>
              {revealDialogTitle(
                revealPrompt ? rows[revealPrompt.rowIndex] : undefined,
                fieldsLoaded
              )}
            </DialogTitle>
            <DialogDescription>
              Enter an audit reason and confirm. Clicking outside this dialog
              cancels the reveal.
            </DialogDescription>
          </DialogHeader>
          {revealPrompt ? (
            <div className='grid gap-3'>
              <div className='space-y-1'>
                <Label htmlFor='kv-audit-reason'>Audit reason</Label>
                <Input
                  id='kv-audit-reason'
                  aria-label='Audit reason'
                  value={revealPrompt.reason}
                  onChange={(event) =>
                    setRevealPrompt({
                      ...revealPrompt,
                      reason: event.target.value,
                      error: '',
                    })
                  }
                  placeholder='Why this field is being revealed'
                />
              </div>
              <Label className='flex items-center gap-2 text-sm'>
                <Checkbox
                  aria-label='Confirm this controlled reveal'
                  checked={revealPrompt.confirmed}
                  onCheckedChange={(checked) =>
                    setRevealPrompt({
                      ...revealPrompt,
                      confirmed: checked === true,
                      error: '',
                    })
                  }
                />
                I confirm this controlled reveal
              </Label>
              {revealPrompt.error ? (
                <p className='text-sm text-destructive'>{revealPrompt.error}</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => setRevealPrompt(null)}
            >
              Cancel reveal
            </Button>
            <Button
              type='button'
              size='sm'
              disabled={busy}
              onClick={submitRevealPrompt}
            >
              Request reveal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
