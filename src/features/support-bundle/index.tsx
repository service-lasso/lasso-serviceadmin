import { useMemo, useState } from 'react'
import { Download, FileText, ShieldAlert } from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
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
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  buildSupportBundlePayload,
  type SupportBundleSection,
} from './support-bundle'

const severityVariant: Record<
  SupportBundleSection['severity'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  info: 'secondary',
  warning: 'outline',
  error: 'destructive',
}

export function SupportBundlePage() {
  const [preparedBundle, setPreparedBundle] = useState('')
  const bundle = useMemo(() => buildSupportBundlePayload(), [])
  const manifestPreview = useMemo(
    () => JSON.stringify(bundle.manifest, null, 2),
    [bundle]
  )
  const bundlePreview = useMemo(() => JSON.stringify(bundle, null, 2), [bundle])
  const redactionCount = bundle.diagnostics.redactionReport.reduce(
    (total, item) => total + Number(item.redactions),
    0
  )

  usePageMetadata({
    title: 'Service Admin - Support Bundle',
    description:
      'Secret-safe Service Lasso diagnostics support bundle preview and export.',
  })

  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main id='content' className='space-y-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              <FileText className='size-5' /> Support bundle export
            </h1>
            <p className='mt-1 text-muted-foreground'>
              Preview and prepare a local diagnostics bundle for support triage.
              The bundle is secret-safe by default: raw secrets, tokens, API
              keys, cookies, private keys, recovery material, passwords, and
              environment values are excluded or redacted before export.
            </p>
          </div>
          <Badge variant='secondary'>Secret-safe diagnostics</Badge>
        </div>

        <Alert>
          <ShieldAlert className='size-4' />
          <AlertTitle>Review before sharing</AlertTitle>
          <AlertDescription>
            This preview shows every included section and the manifest redaction
            policy before export. Operators should still review the generated
            bundle in their support workflow before sending it externally.
          </AlertDescription>
        </Alert>

        <div className='grid gap-4 md:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Sections</CardDescription>
              <CardTitle className='text-3xl'>
                {bundle.manifest.sections.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Redactions</CardDescription>
              <CardTitle className='text-3xl'>{redactionCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Policy</CardDescription>
              <CardTitle className='text-base'>
                {bundle.manifest.redactionPolicy.mode}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Instance</CardDescription>
              <CardTitle className='text-base'>
                {bundle.manifest.instanceRef}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Included sections preview</CardTitle>
            <CardDescription>
              The export contains only metadata, refs, safe status codes,
              summaries, and redacted log excerpts.
            </CardDescription>
          </CardHeader>
          <CardContent className='grid gap-3 md:grid-cols-2'>
            {bundle.manifest.sections.map((section) => (
              <div key={section.id} className='rounded-lg border p-4'>
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
                <div className='mt-3 text-xs text-muted-foreground'>
                  {section.itemCount} item{section.itemCount === 1 ? '' : 's'}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>Redaction policy</CardTitle>
              <CardDescription>
                Rules applied before diagnostics are displayed or exported.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <div className='mb-2 text-sm font-medium'>Rules</div>
                <ul className='list-disc space-y-2 ps-5 text-sm text-muted-foreground'>
                  {bundle.manifest.redactionPolicy.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className='mb-2 text-sm font-medium'>
                  Excluded material
                </div>
                <div className='flex flex-wrap gap-2'>
                  {bundle.manifest.redactionPolicy.excludedMaterial.map(
                    (item) => (
                      <Badge key={item} variant='outline'>
                        {item}
                      </Badge>
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Redacted error preview</CardTitle>
              <CardDescription>
                Recent log excerpts after line-level redaction.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-2'>
                {bundle.diagnostics.recentErrors.map((line) => (
                  <code
                    key={line}
                    className='block rounded-md border bg-muted px-3 py-2 text-xs break-all'
                  >
                    {line}
                  </code>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Machine-readable manifest</CardTitle>
            <CardDescription>
              Included with the bundle so support tooling can verify timestamp,
              sections, and redaction policy.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <pre className='max-h-80 overflow-auto rounded-lg border bg-muted p-4 text-xs'>
              {manifestPreview}
            </pre>
            <div className='flex flex-wrap items-center gap-3'>
              <Button onClick={() => setPreparedBundle(bundlePreview)}>
                <Download className='size-4' /> Prepare export manifest
              </Button>
              {preparedBundle ? (
                <span className='text-sm text-muted-foreground'>
                  Export payload prepared for local review. No upload is
                  performed by this UI.
                </span>
              ) : null}
            </div>
            {preparedBundle ? (
              <pre
                aria-label='Prepared support bundle payload'
                className='max-h-80 overflow-auto rounded-lg border bg-muted p-4 text-xs'
              >
                {preparedBundle}
              </pre>
            ) : null}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
