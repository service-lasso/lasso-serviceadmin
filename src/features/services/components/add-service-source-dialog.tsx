import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  FileArchive,
  Loader2,
  PackageSearch,
  Plus,
  Search,
  ShieldCheck,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AddServiceSource = 'catalog' | 'archive'
type ArchiveUploadState = 'idle' | 'uploading' | 'uploaded' | 'error'
type ArchiveImportState = 'idle' | 'importing' | 'imported' | 'error'

type ArchiveServiceMetadata = {
  id: string
  displayName: string
  version: string
}

type ArchiveValidation = {
  status: 'valid' | 'invalid'
  messages: string[]
}

type ArchiveConflict = {
  exists: boolean
  message: string
}

type ArchiveUploadResult = {
  uploadId: string
  service: ArchiveServiceMetadata
  trust: string
  validation: ArchiveValidation
  conflict?: ArchiveConflict
}

type ArchiveImportResult = {
  status: 'imported' | 'failed'
  serviceId: string
  serviceUrl?: string
  message: string
}

type CatalogVersion = {
  version: string
  label: string
  stable: boolean
}

type CatalogPackage = {
  id: string
  name: string
  summary: string
  source: string
  approved: boolean
  tags: string[]
  versions: CatalogVersion[]
  defaultVersion: string
}

type InstallOutcome = {
  id: string
  status: 'registered' | 'conflict' | 'failed' | 'pending' | 'skipped'
  message: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeVersion(value: unknown): CatalogVersion | null {
  if (typeof value === 'string') {
    return { version: value, label: value, stable: !value.includes('-') }
  }

  if (!isRecord(value)) return null

  const version =
    typeof value.version === 'string'
      ? value.version
      : typeof value.tag === 'string'
        ? value.tag
        : typeof value.tagName === 'string'
          ? value.tagName
          : null

  if (!version) return null

  const name =
    typeof value.name === 'string'
      ? value.name
      : typeof value.label === 'string'
        ? value.label
        : version

  return {
    version,
    label: name === version ? version : `${name} (${version})`,
    stable: value.prerelease === true || value.draft === true ? false : true,
  }
}

function normalizePackage(value: unknown): CatalogPackage | null {
  if (!isRecord(value)) return null

  const id =
    typeof value.id === 'string'
      ? value.id
      : typeof value.packageId === 'string'
        ? value.packageId
        : typeof value.name === 'string'
          ? value.name
          : null

  if (!id) return null

  const versions = (
    Array.isArray(value.versions)
      ? value.versions
      : Array.isArray(value.releases)
        ? value.releases
        : []
  )
    .map(normalizeVersion)
    .filter((version): version is CatalogVersion => version !== null)

  const defaultVersion =
    (typeof value.defaultVersion === 'string' ? value.defaultVersion : null) ??
    (typeof value.latestStableVersion === 'string'
      ? value.latestStableVersion
      : null) ??
    versions.find((version) => version.stable)?.version ??
    versions[0]?.version ??
    'latest'

  return {
    id,
    name: typeof value.name === 'string' ? value.name : id,
    summary:
      typeof value.summary === 'string'
        ? value.summary
        : typeof value.description === 'string'
          ? value.description
          : 'Approved Service Lasso catalog package.',
    source:
      typeof value.source === 'string'
        ? value.source
        : typeof value.repo === 'string'
          ? value.repo
          : typeof value.repository === 'string'
            ? value.repository
            : 'service-lasso/service-catalog',
    approved: value.approved === false ? false : true,
    tags: Array.isArray(value.tags)
      ? value.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    versions: versions.length
      ? versions
      : [{ version: defaultVersion, label: defaultVersion, stable: true }],
    defaultVersion,
  }
}

function normalizePackagesPayload(payload: unknown) {
  const items = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.packages)
      ? payload.packages
      : isRecord(payload) &&
          isRecord(payload.catalog) &&
          Array.isArray(payload.catalog.packages)
        ? payload.catalog.packages
        : []

  return items
    .map(normalizePackage)
    .filter((item): item is CatalogPackage => item !== null)
}

function normalizeInstallOutcomes(payload: unknown): InstallOutcome[] {
  const items =
    isRecord(payload) && Array.isArray(payload.results)
      ? payload.results
      : isRecord(payload) && Array.isArray(payload.outcomes)
        ? payload.outcomes
        : []

  return items.filter(isRecord).map((item) => {
    const id =
      typeof item.id === 'string'
        ? item.id
        : typeof item.packageId === 'string'
          ? item.packageId
          : 'unknown'
    const status =
      item.status === 'registered' ||
      item.status === 'conflict' ||
      item.status === 'failed' ||
      item.status === 'pending' ||
      item.status === 'skipped'
        ? item.status
        : item.ok === true
          ? 'registered'
          : 'failed'

    return {
      id,
      status,
      message:
        typeof item.message === 'string'
          ? item.message
          : status === 'registered'
            ? 'Registered successfully.'
            : 'Install did not complete.',
    }
  })
}

async function fetchCatalogPackages() {
  const response = await fetch('/api/catalog/packages')

  if (!response.ok) {
    throw new Error('Service Catalog packages could not be loaded.')
  }

  return normalizePackagesPayload(await response.json())
}

async function installCatalogPackages(
  packages: Array<{ id: string; version: string }>
) {
  const response = await fetch('/api/catalog/install', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packages }),
  })

  if (!response.ok) {
    throw new Error('Service Catalog install request failed.')
  }

  return normalizeInstallOutcomes(await response.json())
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | T
    | { message?: string }
    | null

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      payload.message
        ? payload.message
        : `Request failed with status ${response.status}`

    throw new Error(message)
  }

  return payload as T
}

function SourceChooser({
  onSelect,
}: {
  onSelect: (source: AddServiceSource) => void
}) {
  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      <button
        type='button'
        className='flex min-h-40 flex-col rounded-md border p-4 text-start transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden'
        onClick={() => onSelect('catalog')}
      >
        <PackageSearch className='size-5 text-primary' />
        <span className='mt-4 text-base font-semibold'>Service Catalog</span>
        <span className='mt-2 text-sm text-muted-foreground'>
          Browse approved packages from the Service Lasso catalog.
        </span>
      </button>
      <button
        type='button'
        className='flex min-h-40 flex-col rounded-md border p-4 text-start transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden'
        onClick={() => onSelect('archive')}
      >
        <Upload className='size-5 text-primary' />
        <span className='mt-4 text-base font-semibold'>Service Archive</span>
        <span className='mt-2 text-sm text-muted-foreground'>
          Upload a built service package or archive.
        </span>
      </button>
    </div>
  )
}

function CatalogInstallPanel({ onBack }: { onBack: () => void }) {
  const [packages, setPackages] = useState<CatalogPackage[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [versions, setVersions] = useState<Record<string, string>>({})
  const [outcomes, setOutcomes] = useState<InstallOutcome[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    setLoading(true)
    setError(null)
    fetchCatalogPackages()
      .then((nextPackages) => {
        if (!active) return

        setPackages(nextPackages)
        setVersions(
          Object.fromEntries(
            nextPackages.map((item) => [item.id, item.defaultVersion])
          )
        )
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Catalog unavailable.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const filteredPackages = useMemo(() => {
    const query = searchValue.trim().toLowerCase()
    if (!query) return packages

    return packages.filter((item) =>
      [item.name, item.id, item.summary, item.source, ...item.tags]
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [packages, searchValue])

  async function onInstallSelected() {
    const installSelection = selectedIds.map((id) => ({
      id,
      version: versions[id] ?? 'latest',
    }))

    setInstalling(true)
    setError(null)
    setOutcomes([])

    try {
      setOutcomes(await installCatalogPackages(installSelection))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Catalog install request failed.'
      )
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className='space-y-4'>
      <Button type='button' variant='ghost' size='sm' onClick={onBack}>
        <ArrowLeft className='size-4' />
        Source choices
      </Button>

      <div className='relative'>
        <Search className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
        <Input
          aria-label='Search Service Catalog'
          className='ps-9'
          placeholder='Search packages'
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
        />
      </div>

      {loading ? (
        <div className='flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin' />
          Loading approved packages
        </div>
      ) : error ? (
        <div className='rounded-md border border-destructive/40 p-4 text-sm text-destructive'>
          {error}
        </div>
      ) : (
        <>
          <div className='space-y-3'>
            {filteredPackages.map((service) => {
              const checkboxId = `catalog-package-${service.id}`
              const selected = selectedSet.has(service.id)

              return (
                <div
                  key={service.id}
                  className='grid gap-3 rounded-md border p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]'
                  data-state={selected ? 'selected' : undefined}
                >
                  <Checkbox
                    id={checkboxId}
                    checked={selected}
                    aria-label={`Select ${service.name}`}
                    onCheckedChange={(checked) => {
                      setSelectedIds((current) =>
                        checked
                          ? [...current, service.id]
                          : current.filter((id) => id !== service.id)
                      )
                    }}
                  />
                  <div className='min-w-0 space-y-2'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Label htmlFor={checkboxId} className='font-medium'>
                        {service.name}
                      </Label>
                      {service.approved ? (
                        <Badge variant='secondary' className='gap-1'>
                          <ShieldCheck className='size-3' />
                          Approved
                        </Badge>
                      ) : null}
                    </div>
                    <p className='text-sm text-muted-foreground'>
                      {service.summary}
                    </p>
                    <div className='flex flex-wrap gap-2 text-xs text-muted-foreground'>
                      <span>{service.source}</span>
                      {service.tags.map((tag) => (
                        <Badge key={tag} variant='outline'>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className='space-y-1'>
                    <Label
                      htmlFor={`catalog-version-${service.id}`}
                      className='text-xs text-muted-foreground'
                    >
                      Version
                    </Label>
                    <select
                      id={`catalog-version-${service.id}`}
                      aria-label={`${service.name} version`}
                      className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-44'
                      disabled={!selected}
                      value={versions[service.id] ?? service.defaultVersion}
                      onChange={(event) =>
                        setVersions((current) => ({
                          ...current,
                          [service.id]: event.target.value,
                        }))
                      }
                    >
                      {service.versions.map((version) => (
                        <option key={version.version} value={version.version}>
                          {version.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )
            })}
          </div>

          {filteredPackages.length === 0 ? (
            <p className='rounded-md border p-4 text-sm text-muted-foreground'>
              No approved catalog packages match that search.
            </p>
          ) : null}

          <div className='flex flex-wrap items-center justify-between gap-3'>
            <p className='text-sm text-muted-foreground'>
              {selectedIds.length} selected
            </p>
            <Button
              type='button'
              disabled={selectedIds.length === 0 || installing}
              onClick={onInstallSelected}
            >
              {installing ? <Loader2 className='size-4 animate-spin' /> : null}
              Install selected
            </Button>
          </div>

          {outcomes.length ? (
            <div className='space-y-2' aria-label='Install outcomes'>
              {outcomes.map((outcome) => (
                <div
                  key={outcome.id}
                  className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm'
                >
                  <span className='font-medium'>{outcome.id}</span>
                  <Badge
                    variant={
                      outcome.status === 'registered'
                        ? 'default'
                        : outcome.status === 'conflict'
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {outcome.status}
                  </Badge>
                  <span className='basis-full text-muted-foreground'>
                    {outcome.message}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function ArchiveUploadPanel({ onBack }: { onBack: () => void }) {
  const [archiveFile, setArchiveFile] = useState<File | null>(null)
  const [uploadState, setUploadState] = useState<ArchiveUploadState>('idle')
  const [importState, setImportState] = useState<ArchiveImportState>('idle')
  const [uploadResult, setUploadResult] = useState<ArchiveUploadResult | null>(
    null
  )
  const [importResult, setImportResult] = useState<ArchiveImportResult | null>(
    null
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const canImport =
    uploadResult?.validation.status === 'valid' &&
    uploadResult.conflict?.exists !== true &&
    importState !== 'importing'

  const handleArchiveFile = (file: File | null) => {
    setArchiveFile(file)
    setUploadResult(null)
    setImportResult(null)
    setUploadState('idle')
    setImportState('idle')
    setErrorMessage(null)
  }

  const handleUpload = async () => {
    if (!archiveFile) {
      setErrorMessage('Choose a Service Archive before uploading.')
      return
    }

    setUploadState('uploading')
    setImportState('idle')
    setImportResult(null)
    setErrorMessage(null)

    try {
      const formData = new FormData()
      formData.append('archive', archiveFile)

      const result = await readJsonResponse<ArchiveUploadResult>(
        await fetch('/api/service-archives/upload', {
          method: 'POST',
          body: formData,
        })
      )

      setUploadResult(result)
      setUploadState('uploaded')
    } catch (error) {
      setUploadState('error')
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Service Archive upload failed.'
      )
    }
  }

  const handleImport = async () => {
    if (!uploadResult || !canImport) return

    setImportState('importing')
    setErrorMessage(null)

    try {
      const result = await readJsonResponse<ArchiveImportResult>(
        await fetch('/api/service-archives/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId: uploadResult.uploadId }),
        })
      )

      setImportResult(result)
      setImportState(result.status === 'imported' ? 'imported' : 'error')
      if (result.status !== 'imported') {
        setErrorMessage(result.message)
      }
    } catch (error) {
      setImportState('error')
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Service Archive import failed.'
      )
    }
  }

  return (
    <div className='space-y-4'>
      <Button type='button' variant='ghost' size='sm' onClick={onBack}>
        <ArrowLeft className='size-4' />
        Source choices
      </Button>
      <div
        className='space-y-3 rounded-md border border-dashed p-4'
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          handleArchiveFile(event.dataTransfer.files.item(0))
        }}
      >
        <div className='flex items-start gap-3'>
          <FileArchive className='mt-0.5 size-5 text-primary' />
          <div className='min-w-0 space-y-1'>
            <Label htmlFor='service-archive'>Built service archive</Label>
            <p className='text-sm text-muted-foreground'>
              Drop a packaged archive here or choose a file built by a Service
              Lasso service repo.
            </p>
          </div>
        </div>
        <Input
          id='service-archive'
          type='file'
          accept='.zip,.tgz,.tar.gz,.service'
          onChange={(event) => {
            handleArchiveFile(event.target.files?.item(0) ?? null)
          }}
        />
        {archiveFile ? (
          <p className='truncate text-sm font-medium'>{archiveFile.name}</p>
        ) : null}
      </div>

      {uploadResult ? (
        <div className='space-y-3 rounded-md border p-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <h3 className='text-sm font-semibold'>Detected service metadata</h3>
            <Badge variant='outline'>
              <ShieldCheck className='size-3' />
              {uploadResult.trust}
            </Badge>
          </div>
          <dl className='grid gap-3 text-sm sm:grid-cols-3'>
            <div>
              <dt className='text-muted-foreground'>Service id</dt>
              <dd className='font-medium'>{uploadResult.service.id}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>Display name</dt>
              <dd className='font-medium'>
                {uploadResult.service.displayName}
              </dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>Version</dt>
              <dd className='font-medium'>{uploadResult.service.version}</dd>
            </div>
          </dl>
          <Alert
            variant={
              uploadResult.validation.status === 'valid'
                ? 'default'
                : 'destructive'
            }
          >
            {uploadResult.validation.status === 'valid' ? (
              <CheckCircle2 />
            ) : (
              <TriangleAlert />
            )}
            <AlertTitle>
              {uploadResult.validation.status === 'valid'
                ? 'Validation passed'
                : 'Validation failed'}
            </AlertTitle>
            <AlertDescription>
              {uploadResult.validation.messages.join(' ')}
            </AlertDescription>
          </Alert>
          {uploadResult.conflict?.exists ? (
            <Alert variant='destructive'>
              <TriangleAlert />
              <AlertTitle>Service id conflict</AlertTitle>
              <AlertDescription>
                {uploadResult.conflict.message}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? (
        <Alert variant='destructive'>
          <TriangleAlert />
          <AlertTitle>Archive action failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {importResult?.status === 'imported' ? (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Service imported</AlertTitle>
          <AlertDescription>
            {importResult.message}{' '}
            {importResult.serviceUrl ? (
              <a
                className='font-medium underline'
                href={importResult.serviceUrl}
              >
                Open service
              </a>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='outline'
          onClick={handleUpload}
          disabled={uploadState === 'uploading'}
        >
          {uploadState === 'uploading' ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <Upload className='size-4' />
          )}
          Upload archive
        </Button>
        <Button type='button' onClick={handleImport} disabled={!canImport}>
          {importState === 'importing' ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <CheckCircle2 className='size-4' />
          )}
          Import archive
        </Button>
      </div>
    </div>
  )
}

export function AddServiceSourceDialog() {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<AddServiceSource | null>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setSource(null)
      }}
    >
      <DialogTrigger asChild>
        <Button type='button'>
          <Plus className='size-4' />
          Add Service
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader className='text-start'>
          <DialogTitle>
            {source === 'catalog'
              ? 'Service Catalog'
              : source === 'archive'
                ? 'Service Archive'
                : 'Add Service'}
          </DialogTitle>
          <DialogDescription>
            {source === 'catalog'
              ? 'Select approved packages and versions to install.'
              : source === 'archive'
                ? 'Upload a built service archive.'
                : 'Choose a source for the new service.'}
          </DialogDescription>
        </DialogHeader>

        {source === 'catalog' ? (
          <CatalogInstallPanel onBack={() => setSource(null)} />
        ) : source === 'archive' ? (
          <ArchiveUploadPanel onBack={() => setSource(null)} />
        ) : (
          <SourceChooser onSelect={setSource} />
        )}
      </DialogContent>
    </Dialog>
  )
}
