import { createFileRoute, redirect } from '@tanstack/react-router'

type BrokerRootRedirect =
  | '/secrets-broker/secrets'
  | '/secrets-broker/sources'
  | '/secrets-broker/backup-keys'
  | '/secrets-broker/topology'
  | '/operations/audit-logging'

/**
 * Map leftover Overview hash bookmarks onto the real operator pages.
 * Bare `/secrets-broker` still lands on Secrets (KV).
 */
function redirectPathForBrokerRootHash(hash: string): BrokerRootRedirect {
  const normalizedHash = hash.replace(/^#/, '')

  switch (normalizedHash) {
    case 'secret-sources':
    case 'provider-connections':
    case 'workflow-authoring-boundary':
    case 'diagnostics':
      return '/secrets-broker/sources'
    case 'operational-controls':
    case 'audit-events':
      return '/operations/audit-logging'
    case 'backup-keys':
      return '/secrets-broker/backup-keys'
    case 'secrets-topology':
      return '/secrets-broker/topology'
    default:
      return '/secrets-broker/secrets'
  }
}

export const Route = createFileRoute('/_authenticated/secrets-broker/')({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: redirectPathForBrokerRootHash(location.hash),
      replace: true,
    })
  },
})
