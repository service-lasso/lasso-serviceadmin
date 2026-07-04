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
    exception: {
      kind: 'article-planned',
      issue: 'service-lasso/lasso-serviceadmin#327',
      reason:
        'Dashboard coverage belongs with the Service Admin overview and navigation guide.',
    },
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
    exception: {
      kind: 'article-planned',
      issue: 'service-lasso/lasso-serviceadmin#333',
      reason:
        'Routes documentation is planned as the Network and Service Routes operator guide.',
    },
  },
  {
    route: '/logs',
    exception: {
      kind: 'article-planned',
      issue: 'service-lasso/lasso-serviceadmin#330',
      reason:
        'Logs coverage is planned with the Runtime and Logs operator runbook.',
    },
  },
  {
    route: '/runtime',
    articleId: 'help/health-checks.md',
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
    articleId: 'help/environment-variables-global-and-service-reuse.md',
  },
  {
    route: '/network',
    exception: {
      kind: 'article-planned',
      issue: 'service-lasso/lasso-serviceadmin#333',
      reason:
        'Network documentation is planned with the Network and Service Routes operator guide.',
    },
  },
  {
    route: '/operations/telemetry',
    exception: {
      kind: 'article-planned',
      issue: 'service-lasso/lasso-serviceadmin#334',
      reason:
        'Telemetry coverage is planned as a dedicated export and redaction guide.',
    },
  },
  {
    route: '/operations/audit-logging',
    exception: {
      kind: 'article-planned',
      issue: 'service-lasso/lasso-serviceadmin#335',
      reason:
        'Audit coverage is planned as a durable action logging contract guide.',
    },
  },
  {
    route: '/secrets-broker',
    exception: {
      kind: 'article-planned',
      issue: 'service-lasso/lasso-serviceadmin#331',
      reason:
        'Secrets Broker overview coverage is planned with the variables and broker safety guide.',
    },
  },
  {
    route: '/secrets-broker/secrets',
    exception: {
      kind: 'article-planned',
      issue: 'service-lasso/lasso-serviceadmin#331',
      reason:
        'Secret inventory safety coverage is planned with the variables and broker safety guide.',
    },
  },
  {
    route: '/secrets-broker/sources',
    articleId: 'help/service-install-and-setup-config.md',
  },
  {
    route: '/secrets-broker/topology',
    exception: {
      kind: 'article-planned',
      issue: 'service-lasso/lasso-serviceadmin#331',
      reason:
        'Broker topology coverage is planned with the variables and broker safety guide.',
    },
  },
  {
    route: '/settings/appearance',
    exception: {
      kind: 'article-planned',
      issue: 'service-lasso/lasso-serviceadmin#327',
      reason:
        'Appearance settings belong in the Service Admin overview and navigation guide.',
    },
  },
  {
    route: '/help-center',
    articleId: 'help/README.md',
  },
]
