import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { copyText } from '@/lib/copy-text'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
import { Button } from '@/components/ui/button'
import {
  readStructuredRunStatus,
  resolveServiceRunStatus,
  type ServiceRunStatusFields,
} from './service-run-status'

function CopyValueButton({ value, label }: { value?: string; label: string }) {
  return (
    <Button
      type='button'
      variant='outline'
      size='icon'
      className='size-7 shrink-0'
      title={label}
      disabled={!value}
      onClick={() => {
        if (value) void copyText(value)
      }}
    >
      <Copy className='size-3.5' />
      <span className='sr-only'>{label}</span>
    </Button>
  )
}

function RunStatusCard({ label, value }: { label: string; value?: string }) {
  return (
    <div className='rounded-lg border p-3'>
      <div className='flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <div className='font-medium'>{label}</div>
          <div className='text-sm break-all text-muted-foreground'>
            {value ?? 'Not recorded'}
          </div>
        </div>
        <CopyValueButton value={value} label={`Copy ${label}`} />
      </div>
    </div>
  )
}

/**
 * Overview process-identity strip: State, Started, PID, and Run.
 *
 * @param service - Dashboard service currently open in service details.
 */
export function ServiceRunStatusCards({
  service,
}: {
  service: DashboardService
}) {
  const structured = readStructuredRunStatus(service)
  const [fieldsServiceId, setFieldsServiceId] = useState(service.id)
  const [fields, setFields] = useState<ServiceRunStatusFields>(structured)

  if (fieldsServiceId !== service.id) {
    setFieldsServiceId(service.id)
    setFields(structured)
  }

  useEffect(() => {
    let cancelled = false

    void resolveServiceRunStatus(service).then((nextFields) => {
      if (!cancelled) {
        setFields(nextFields)
      }
    })

    return () => {
      cancelled = true
    }
  }, [service])

  return (
    <div
      className='grid gap-3 md:grid-cols-4'
      data-testid='service-detail-overview-run-status'
    >
      <RunStatusCard label='State' value={fields.state} />
      <RunStatusCard label='Started' value={fields.started} />
      <RunStatusCard label='PID' value={fields.pid} />
      <RunStatusCard label='Run' value={fields.runId} />
    </div>
  )
}
