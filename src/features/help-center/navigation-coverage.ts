export type HelpCenterNavigationCoverage = {
  route: string
  articleId?: `help/${string}.md`
  exception?: {
    kind:
      | 'article-planned'
      | 'compatibility-route'
      | 'redirect-only'
      | 'deferred-page'
    issue: string
    reason: string
  }
}

export const helpCenterNavigationCoverage: HelpCenterNavigationCoverage[] = [
  {
    route: '/',
    articleId: 'help/service-admin-overview-and-navigation.md',
  },
  {
    route: '/services',
    articleId: 'help/how-to-create-a-basic-service.md',
  },
  {
    route: '/dependencies',
    exception: {
      kind: 'article-planned',
      issue: 'service-lasso/lasso-serviceadmin#328',
      reason:
        'Dependency graph guidance is planned as a focused operator article.',
    },
  },
  {
    route: '/service-routes',
    articleId: 'help/network-and-service-routes-operator-guide.md',
  },
  {
    route: '/logs',
    articleId: 'help/runtime-and-logs-operator-runbook.md',
  },
  {
    route: '/runtime',
    articleId: 'help/runtime-and-logs-operator-runbook.md',
  },
  {
    route: '/installed',
    exception: {
      kind: 'article-planned',
      issue: 'service-lasso/lasso-serviceadmin#332',
      reason:
        'Installed paths coverage is planned as the installed paths and configuration guide.',
    },
  },
  {
    route: '/variables',
    articleId: 'help/variables-and-secrets-broker-safety-guide.md',
  },
  {
    route: '/network',
    articleId: 'help/network-and-service-routes-operator-guide.md',
  },
  {
    route: '/operations/telemetry',
    articleId: 'help/operations-telemetry-operator-guide.md',
  },
  {
    route: '/operations/audit-logging',
    articleId: 'help/operations-audit-operator-guide.md',
  },
  {
    route: '/secrets-broker',
    articleId: 'help/variables-and-secrets-broker-safety-guide.md',
  },
  {
    route: '/secrets-broker/secrets',
    articleId: 'help/variables-and-secrets-broker-safety-guide.md',
  },
  {
    route: '/secrets-broker/sources',
    articleId: 'help/service-install-and-setup-config.md',
  },
  {
    route: '/secrets-broker/topology',
    articleId: 'help/variables-and-secrets-broker-safety-guide.md',
  },
  {
    route: '/settings/appearance',
    articleId: 'help/service-admin-overview-and-navigation.md',
  },
  {
    route: '/help-center',
    articleId: 'help/README.md',
  },
]
