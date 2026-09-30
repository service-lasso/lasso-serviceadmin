import { Shield } from 'lucide-react'
import type { ServiceIsolationStatus } from '@/lib/service-lasso-dashboard/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function requireLabel(require: ServiceIsolationStatus['require']): string {
  if (require === 'none') {
    return 'none'
  }
  if (require === 'limits') {
    return 'limits'
  }
  if (require === 'dedicated-user') {
    return 'dedicated user'
  }
  return 'hardened'
}

/**
 * Overview card for Core isolation status. Missing payloads stay honest as
 * unreported direct mode. This is not a Docker UI.
 *
 * @param isolation Parsed Core status, or undefined when Core omitted the field.
 */
export function ServiceIsolationCard({
  isolation,
}: {
  isolation: ServiceIsolationStatus | undefined
}) {
  if (!isolation) {
    return (
      <Card data-testid='service-detail-isolation'>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
            <Shield className='size-4' /> Isolation
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-2 text-sm text-muted-foreground'>
          <p>Core did not report isolation. Treated as direct process mode.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-testid='service-detail-isolation'>
      <CardHeader className='pb-2'>
        <CardTitle className='flex items-center gap-2 text-sm font-medium'>
          <Shield className='size-4' /> Isolation
          {isolation.startBlocked ? (
            <Badge variant='destructive'>Start blocked</Badge>
          ) : isolation.degradeReasons.length > 0 ? (
            <Badge variant='secondary'>Degraded</Badge>
          ) : (
            <Badge variant='outline'>Direct</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-2 text-sm text-muted-foreground'>
        <div>
          Mode: {isolation.effectiveMode}
          {isolation.declaredMode !== isolation.effectiveMode
            ? ` (declared ${isolation.declaredMode})`
            : ''}
        </div>
        <div>Require: {requireLabel(isolation.require)}</div>
        <div>
          Limits:{' '}
          {isolation.limitsEnforced
            ? 'enforced'
            : isolation.limits
              ? 'declared, not applied'
              : 'none'}
        </div>
        <div>
          Workspace:{' '}
          {isolation.workspace.length > 0
            ? isolation.workspace.join(', ')
            : 'service root only'}
        </div>
        {isolation.startBlockedReason ? (
          <p>{isolation.startBlockedReason}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
