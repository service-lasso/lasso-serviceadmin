import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Folder, FileKey2, Plus, Trash2 } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
 * OpenBao-shaped path browser and field editor for local or remote KV sources.
 * Stored values stay hidden until a per-row audited reveal; only one field
 * value is shown at a time.
 */
export function KvSecretsEditor({ overview }: KvSecretsEditorProps) {
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
      setLoadedFields(data.fields)
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
      const path = selectedPath || joinPath(prefix, createPath.trim())
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
      const path = selectedPath || joinPath(prefix, createPath.trim())
      const nextRows = rowsAfterSave(rows, loadedFields)
      const nextLoaded = loadedFieldsAfterSave(rows, loadedFields)
      setSelectedPath(path)
      setCreatePath('')
      setCas(result.version)
      setSelectedVersion(result.version)
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
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <FileKey2 className='size-4' />
          KV store
        </CardTitle>
        <CardDescription>
          OpenBao-compatible secrets. Local encrypted store is the
          out-of-the-box backend; a configured Vault or OpenBao source uses the
          same editor. Reveal is per field and shows only one value at a time.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex flex-wrap items-end gap-3'>
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
              }}
            >
              {sources.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <Badge variant='outline'>{source.kind}</Badge>
          <Badge variant='outline'>No values in the key list</Badge>
        </div>

        <div className='flex flex-wrap items-center gap-2 text-sm'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => {
              setPrefix('')
              setSelectedPath('')
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
                    setPrefix(next)
                    setSelectedPath('')
                  }}
                >
                  / {segment}
                </Button>
              )
            })}
        </div>

        {listQuery.isError ? (
          <Alert variant='destructive'>
            <AlertTitle>KV list unavailable</AlertTitle>
            <AlertDescription>{errorMessage(listQuery.error)}</AlertDescription>
          </Alert>
        ) : null}

        <div className='grid gap-2'>
          {keys.length === 0 && !listQuery.isLoading ? (
            <p className='text-sm text-muted-foreground'>
              No keys at this path. Create one below.
            </p>
          ) : null}
          {keys.map((key) => {
            const isFolder = key.endsWith('/')
            return (
              <Button
                key={key}
                type='button'
                variant='outline'
                className='justify-start'
                onClick={() => {
                  if (isFolder) {
                    setPrefix(joinPath(prefix, key))
                    setSelectedPath('')
                    resetStoredReveal()
                    return
                  }
                  setSelectedPath(joinPath(prefix, key))
                  resetStoredReveal()
                  setSelectedVersion(undefined)
                  setCas(undefined)
                  setRows([{ key: '', value: '' }])
                  setStatus(
                    'Path selected. Load field names, then reveal one value at a time.'
                  )
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

        <div className='grid gap-3 rounded-md border p-3'>
          <div className='space-y-1'>
            <Label htmlFor='kv-create-path'>Path</Label>
            <Input
              id='kv-create-path'
              value={selectedPath || createPath}
              onChange={(event) => {
                setSelectedPath('')
                setCreatePath(event.target.value)
                setCas(undefined)
                setSelectedVersion(undefined)
                resetStoredReveal()
              }}
              placeholder={prefix ? `${prefix}/app/db` : 'apps/db'}
            />
          </div>

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

          {rows.map((row, index) => {
            const key = row.key.trim()
            const isRevealed = Boolean(key) && key === revealedKey
            const showRevealControls = metadataReady
            const promptOpen =
              revealPrompt !== null && revealPrompt.rowIndex === index
            return (
              <div key={`field-${index}`} className='grid gap-2'>
                <div className='grid gap-2 md:grid-cols-[1fr_1fr_auto]'>
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
                  <Input
                    aria-label={`Field ${index + 1} value`}
                    type={isRevealed || !metadataReady ? 'text' : 'password'}
                    value={row.value}
                    onChange={(event) => {
                      const next = [...rows]
                      next[index] = { ...row, value: event.target.value }
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
                  {showRevealControls ? (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      disabled={busy}
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
                      {revealButtonLabel(row, index, revealedKey, fieldsLoaded)}
                    </Button>
                  ) : null}
                </div>
                {promptOpen && revealPrompt ? (
                  <div className='grid gap-2 rounded-md border bg-muted/40 p-3'>
                    <div className='space-y-1'>
                      <Label htmlFor={`kv-audit-reason-${index}`}>
                        Audit reason
                      </Label>
                      <Input
                        id={`kv-audit-reason-${index}`}
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
                      <p className='text-sm text-destructive'>
                        {revealPrompt.error}
                      </p>
                    ) : null}
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        type='button'
                        size='sm'
                        disabled={busy}
                        onClick={submitRevealPrompt}
                      >
                        Request reveal
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => setRevealPrompt(null)}
                      >
                        Cancel reveal
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}

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
            {prefix ? (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => setPrefix(parentPrefix(prefix))}
              >
                Up
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
      </CardContent>
    </Card>
  )
}
