import { Download, FileText, ShieldAlert } from 'lucide-react'
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
import type { SecretsBrokerDiagnostic } from '../secrets-broker/diagnostics'
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

export function SupportBundleDiagnosticsAction({
  diagnostics,
}: {
  diagnostics: SecretsBrokerDiagnostic[]
}) {
  const review = buildSupportBundleReview(
    diagnostics.map((diagnostic) => ({
      category: diagnostic.category,
      status: diagnostic.status,
    }))
  )

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
