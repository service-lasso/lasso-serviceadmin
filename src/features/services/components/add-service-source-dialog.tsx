import { useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  FileArchive,
  Loader2,
  PackageSearch,
  Plus,
  ShieldCheck,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

const catalogServices = [
  {
    name: 'Reverse proxy',
    description:
      'Approved edge routing package for local Service Lasso stacks.',
  },
  {
    name: 'Identity provider',
    description: 'Approved authentication package for operator sign-in.',
  },
]

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
  return (
    <div className='space-y-4'>
      <Button type='button' variant='ghost' size='sm' onClick={onBack}>
        <ArrowLeft className='size-4' />
        Source choices
      </Button>
      <div className='space-y-3'>
        {catalogServices.map((service) => (
          <div
            key={service.name}
            className='flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between'
          >
            <div className='min-w-0'>
              <p className='font-medium'>{service.name}</p>
              <p className='text-sm text-muted-foreground'>
                {service.description}
              </p>
            </div>
            <Button type='button' size='sm'>
              Install
            </Button>
          </div>
        ))}
      </div>
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
              ? 'Select an approved package to install.'
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
