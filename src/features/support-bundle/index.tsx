import { Download, FileText, ShieldAlert } from 'lucide-react'
import {
  useDashboardSummary,
  useServices,
} from '@/lib/service-lasso-dashboard/hooks'
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
import {
  buildSupportBundleReview,
  type SupportBundleReviewSection,
} from './support-bundle'

const severityVariant: Record<
  SupportBundleReviewSection['severity'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  info: 'secondary',
  warning: 'outline',
  error: 'destructive',
}

export function SupportBundleDiagnosticsAction() {
  const summaryQuery = useDashboardSummary()
  const servicesQuery = useServices()
  const review = buildSupportBundleReview({
    summary: summaryQuery.data,
    services: servicesQuery.data,
    isLoading: summaryQuery.isLoading || servicesQuery.isLoading,
    error: summaryQuery.error ?? servicesQuery.error,
  })

  return (
    <Card role='region' aria-label='Support bundle export action'>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2 text-base'>
              <FileText className='size-4' /> Support bundle export
            </CardTitle>
            <CardDescription>
              Controlled local diagnostics export from the current Secrets
              Broker diagnostics context.
            </CardDescription>
          </div>
          <Badge variant='outline'>{review.exportAvailability.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <Alert>
          <ShieldAlert className='size-4' />
          <AlertTitle>Export unavailable</AlertTitle>
          <AlertDescription>
            {review.exportAvailability.reason} No sample bundle or fixture
            payload is generated here.
          </AlertDescription>
        </Alert>

        <div className='rounded-lg border p-3'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <div className='font-medium'>{review.sourceState.label}</div>
              <p className='mt-1 text-sm text-muted-foreground'>
                {review.sourceState.summary}
              </p>
            </div>
            <Badge
              variant={
                review.sourceState.state === 'error'
                  ? 'destructive'
                  : 'secondary'
              }
            >
              {review.sourceState.state}
            </Badge>
          </div>
        </div>

        <div className='grid gap-3 md:grid-cols-3'>
          <div className='rounded-lg border p-3'>
            <div className='text-xs font-medium text-muted-foreground uppercase'>
              Categories
            </div>
            <div className='text-2xl font-bold'>{review.sections.length}</div>
          </div>
          <div className='rounded-lg border p-3'>
            <div className='text-xs font-medium text-muted-foreground uppercase'>
              Redaction
            </div>
            <div className='text-sm font-medium'>{review.redactionStatus}</div>
          </div>
          <div className='rounded-lg border p-3'>
            <div className='text-xs font-medium text-muted-foreground uppercase'>
              Approximate size
            </div>
            <div className='text-sm font-medium'>
              {review.approximateSizeLabel}
            </div>
          </div>
        </div>

        <div className='grid gap-3 lg:grid-cols-2'>
          {review.sections.map((section) => (
            <div key={section.id} className='rounded-lg border p-3'>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <div className='font-medium'>{section.title}</div>
                  <p className='mt-1 text-sm text-muted-foreground'>
                    {section.summary}
                  </p>
                </div>
                <Badge variant={severityVariant[section.severity]}>
                  {section.severity}
                </Badge>
              </div>
              <div className='mt-2 text-xs text-muted-foreground'>
                {section.itemCount} item{section.itemCount === 1 ? '' : 's'}
              </div>
            </div>
          ))}
        </div>

        {review.previewItems.length ? (
          <div className='space-y-3'>
            <div>
              <h3 className='text-sm font-medium'>Live metadata review</h3>
              <p className='text-sm text-muted-foreground'>
                These groups are assembled from current runtime metadata only.
                Secret values, provider credentials, environment values, and
                private material are excluded or redacted.
              </p>
            </div>
            <div className='grid gap-3 lg:grid-cols-2'>
              {review.previewItems.map((item) => (
                <div key={item.id} className='rounded-lg border p-3'>
                  <div className='mb-2 flex items-start justify-between gap-3'>
                    <div>
                      <div className='font-medium'>{item.title}</div>
                      <div className='text-xs text-muted-foreground'>
                        {item.source}
                      </div>
                    </div>
                    <Badge variant={severityVariant[item.status]}>
                      {item.status}
                    </Badge>
                  </div>
                  <ul className='space-y-1 text-sm text-muted-foreground'>
                    {item.details.slice(0, 5).map((detail) => (
                      <li key={detail} className='break-words'>
                        {detail}
                      </li>
                    ))}
                  </ul>
                  {item.details.length > 5 ? (
                    <div className='mt-2 text-xs text-muted-foreground'>
                      {item.details.length - 5} more metadata records excluded
                      from the compact review.
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className='flex flex-wrap items-center gap-3'>
          <Button type='button' disabled>
            <Download className='size-4' /> Download support bundle unavailable
          </Button>
          <span className='text-sm text-muted-foreground'>
            Wire this action to the broker export endpoint when a real redacted
            export API is available.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
