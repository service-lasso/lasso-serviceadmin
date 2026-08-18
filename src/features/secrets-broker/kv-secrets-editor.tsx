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
  undeleteKvVersions,
  writeKvData,
  type KvSourceOption,
} from '@/lib/secrets-broker/kv-client'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FieldRow = {
  key: string
  value: string
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

function rowsFromFields(fields: Record<string, string>): FieldRow[] {
  const rows = Object.entries(fields).map(([key, value]) => ({ key, value }))
  if (rows.length === 0) {
    return [{ key: 'value', value: '' }]
  }
  return rows
}

function fieldsFromRows(rows: FieldRow[]): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (!key) {
      continue
    }
    fields[key] = row.value
  }
  return fields
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
 * OpenBao-shaped path browser and field editor for local or remote KV sources.
 */
export function KvSecretsEditor({ overview }: KvSecretsEditorProps) {
  const queryClient = useQueryClient()
  const sources = useMemo(() => kvSourceOptions(overview), [overview])
  const [sourceId, setSourceId] = useState('local')
  const [prefix, setPrefix] = useState('')
  const [selectedPath, setSelectedPath] = useState('')
  const [createPath, setCreatePath] = useState('')
  const [rows, setRows] = useState<FieldRow[]>([{ key: 'value', value: '' }])
  const [revealed, setRevealed] = useState(false)
  const [cas, setCas] = useState<number | undefined>(undefined)
  const [status, setStatus] = useState('')

  const source: KvSourceOption = sources.find(
    (item) => item.id === sourceId
  ) ?? {
    id: 'local',
    label: 'Local encrypted store',
    kind: 'local',
  }
  const query = { source: source.id }

  const listQuery = useQuery({
    queryKey: ['secrets-broker', 'kv', 'list', source.id, prefix],
    queryFn: () => listKvKeys(prefix, { source: source.id }),
  })

  const metadataReady = selectedPath.length > 0

  const revealMutation = useMutation({
    mutationFn: () => readKvData(selectedPath, query),
    onSuccess: (data) => {
      setRows(rowsFromFields(data.fields))
      setCas(data.version)
      setRevealed(true)
      setStatus(`Loaded version ${data.version}. Hide values after you finish.`)
    },
    onError: (error) => {
      setRevealed(false)
      setStatus(errorMessage(error))
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const path = selectedPath || joinPath(prefix, createPath.trim())
      const fields = fieldsFromRows(rows)
      if (!path) {
        throw new Error('Enter a KV path before saving.')
      }
      if (Object.keys(fields).length === 0) {
        throw new Error('Add at least one field before saving.')
      }
      if (selectedPath && cas !== undefined) {
        return patchKvData(path, fields, cas, query)
      }
      return writeKvData(path, fields, cas, query)
    },
    onSuccess: async (result) => {
      const path = selectedPath || joinPath(prefix, createPath.trim())
      setSelectedPath(path)
      setCreatePath('')
      setCas(result.version)
      setStatus(`Saved version ${result.version}.`)
      setRevealed(false)
      setRows([{ key: 'value', value: '' }])
      await queryClient.invalidateQueries({
        queryKey: ['secrets-broker', 'kv'],
      })
    },
    onError: (error) => {
      setStatus(errorMessage(error))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteKvVersions(selectedPath, cas ? [cas] : [], query),
    onSuccess: async () => {
      setStatus('Soft-deleted the current version. Undelete restores it.')
      setRevealed(false)
      setRows([{ key: 'value', value: '' }])
      await queryClient.invalidateQueries({
        queryKey: ['secrets-broker', 'kv'],
      })
    },
    onError: (error) => {
      setStatus(errorMessage(error))
    },
  })

  const undeleteMutation = useMutation({
    mutationFn: () => undeleteKvVersions(selectedPath, cas ? [cas] : [], query),
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
          same editor.
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
                setRevealed(false)
                setCas(undefined)
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
                    setRevealed(false)
                    return
                  }
                  setSelectedPath(joinPath(prefix, key))
                  setRevealed(false)
                  setRows([{ key: 'value', value: '' }])
                  setStatus('Path selected. Reveal to load values.')
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
                setRevealed(false)
              }}
              placeholder={prefix ? `${prefix}/app/db` : 'apps/db'}
            />
          </div>

          {rows.map((row, index) => (
            <div key={`field-${index}`} className='grid gap-2 md:grid-cols-2'>
              <Input
                aria-label={`Field ${index + 1} name`}
                value={row.key}
                onChange={(event) => {
                  const next = [...rows]
                  next[index] = { ...row, key: event.target.value }
                  setRows(next)
                }}
                placeholder='field name'
              />
              <Input
                aria-label={`Field ${index + 1} value`}
                type={revealed ? 'text' : 'password'}
                value={row.value}
                onChange={(event) => {
                  const next = [...rows]
                  next[index] = { ...row, value: event.target.value }
                  setRows(next)
                }}
                placeholder={
                  revealed ? 'secret value' : 'hidden until reveal or type'
                }
              />
            </div>
          ))}

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
            {metadataReady ? (
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={busy}
                onClick={() => revealMutation.mutate()}
              >
                {revealed ? (
                  <EyeOff className='size-4' />
                ) : (
                  <Eye className='size-4' />
                )}
                {revealed ? 'Reload values' : 'Reveal current version'}
              </Button>
            ) : null}
            {revealed ? (
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => {
                  setRevealed(false)
                  setRows(rows.map((row) => ({ ...row, value: '' })))
                  setStatus('Values hidden.')
                }}
              >
                Hide values
              </Button>
            ) : null}
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
          {cas !== undefined ? (
            <p className='text-xs text-muted-foreground'>CAS version {cas}</p>
          ) : null}
          {status ? <p className='text-sm'>{status}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}
