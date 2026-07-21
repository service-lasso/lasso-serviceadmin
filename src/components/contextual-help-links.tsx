import { Link, useRouterState } from '@tanstack/react-router'
import { BookOpenText } from 'lucide-react'
import { Button } from '@/components/ui/button'

type HelpLink = {
  label: string
  doc: `help/${string}.md`
}

const helpLinksByRoute: Record<string, HelpLink[]> = {
  '/services': [
    { label: 'Service actions', doc: 'help/service-actions.md' },
    { label: 'Health checks', doc: 'help/health-checks.md' },
    { label: 'Add a service', doc: 'help/how-to-create-a-basic-service.md' },
  ],
  '/runtime': [
    {
      label: 'Runtime runbook',
      doc: 'help/runtime-and-logs-operator-runbook.md',
    },
  ],
  '/logs': [
    { label: 'Logs runbook', doc: 'help/runtime-and-logs-operator-runbook.md' },
  ],
  '/installed': [
    { label: 'Install paths', doc: 'help/service-install-and-setup-config.md' },
  ],
  '/variables': [
    {
      label: 'Variables guide',
      doc: 'help/environment-variables-global-and-service-reuse.md',
    },
    {
      label: 'Secret safety',
      doc: 'help/variables-and-secrets-broker-safety-guide.md',
    },
  ],
  '/network': [
    {
      label: 'Network guide',
      doc: 'help/network-and-service-routes-operator-guide.md',
    },
  ],
  '/service-routes': [
    {
      label: 'Routes guide',
      doc: 'help/network-and-service-routes-operator-guide.md',
    },
  ],
  '/operations/telemetry': [
    {
      label: 'Telemetry guide',
      doc: 'help/operations-telemetry-operator-guide.md',
    },
  ],
  '/operations/audit-logging': [
    { label: 'Audit guide', doc: 'help/operations-audit-operator-guide.md' },
  ],
  '/secrets-broker': [
    {
      label: 'Secrets Broker guide',
      doc: 'help/variables-and-secrets-broker-safety-guide.md',
    },
  ],
  '/secrets-broker/secrets': [
    {
      label: 'Secrets guide',
      doc: 'help/variables-and-secrets-broker-safety-guide.md',
    },
  ],
  '/secrets-broker/sources': [
    {
      label: 'Provider setup',
      doc: 'help/service-install-and-setup-config.md',
    },
    {
      label: 'Support diagnostics',
      doc: 'help/support-bundle-and-diagnostics-safety-guide.md',
    },
    {
      label: 'Secret safety',
      doc: 'help/variables-and-secrets-broker-safety-guide.md',
    },
  ],
  '/secrets-broker/configuration': [
    {
      label: 'Broker configuration',
      doc: 'help/service-install-and-setup-config.md',
    },
    {
      label: 'Secret safety',
      doc: 'help/variables-and-secrets-broker-safety-guide.md',
    },
  ],
  '/secrets-broker/topology': [
    {
      label: 'SecretRef guide',
      doc: 'help/variables-and-secrets-broker-safety-guide.md',
    },
  ],
}

function normalizePathname(pathname: string) {
  if (pathname === '/') return pathname
  return pathname.replace(/\/$/, '')
}

export function getContextualHelpLinks(pathname: string): HelpLink[] {
  const normalizedPathname = normalizePathname(pathname)

  if (normalizedPathname.startsWith('/services/')) {
    return [
      { label: 'Service actions', doc: 'help/service-actions.md' },
      { label: 'Health checks', doc: 'help/health-checks.md' },
    ]
  }

  return helpLinksByRoute[normalizedPathname] ?? []
}

export function ContextualHelpLinks() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const links = getContextualHelpLinks(pathname)

  if (!links.length) return null

  return (
    <nav
      aria-label='Contextual Help Center links'
      className='flex flex-wrap items-center justify-end gap-2'
    >
      {links.map((link) => (
        <Button
          key={`${link.doc}:${link.label}`}
          variant='outline'
          size='sm'
          asChild
        >
          <Link
            to='/help-center'
            search={{ doc: link.doc }}
            aria-label={`Open Help Center: ${link.label}`}
          >
            <BookOpenText className='size-3.5' />
            {link.label}
          </Link>
        </Button>
      ))}
    </nav>
  )
}
