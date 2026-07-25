import { useState } from 'react'
import { ArrowLeft, PackageSearch, Plus, Upload } from 'lucide-react'
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
  return (
    <div className='space-y-4'>
      <Button type='button' variant='ghost' size='sm' onClick={onBack}>
        <ArrowLeft className='size-4' />
        Source choices
      </Button>
      <div className='space-y-2'>
        <Label htmlFor='service-archive'>Built service archive</Label>
        <Input
          id='service-archive'
          type='file'
          accept='.zip,.tgz,.tar.gz,.service'
        />
        <p className='text-sm text-muted-foreground'>
          Choose a built package or archive produced by the Service Lasso build
          pipeline.
        </p>
      </div>
      <Button type='button'>Upload archive</Button>
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
