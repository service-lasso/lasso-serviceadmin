export type WorkflowSecretRefStatus = 'valid' | 'missing' | 'denied' | 'warning'

export type WorkflowSecretRefCheck = {
  id: string
  ref: string
  label: string
  provider: string
  connection: string
  status: WorkflowSecretRefStatus
  policyDecision: string
  message: string
  suggestedFix: string
}

export type WorkflowAuthoringBoundary = {
  id: string
  title: string
  owner: string
  summary: string
  targetRuntime: string
  status: 'ready' | 'needs-action'
  refs: WorkflowSecretRefCheck[]
  snippet: string
  guardrails: string[]
}

export const workflowAuthoringBoundaries: WorkflowAuthoringBoundary[] = [
  {
    id: 'service-start',
    title: 'Service start bootstrap',
    owner: '@serviceadmin',
    summary:
      'Validate startup SecretRefs before a service author saves a bootstrap workflow or service action.',
    targetRuntime:
      'Service Admin workflow metadata; execution stays outside this panel.',
    status: 'ready',
    refs: [
      {
        id: 'serviceadmin-session-secret',
        ref: 'secret://local/default/@serviceadmin/SESSION_SECRET',
        label: 'Service Admin session signing secret',
        provider: 'local encrypted store',
        connection: 'local-default',
        status: 'valid',
        policyDecision:
          'policy/serviceadmin/session-secret allows metadata validation',
        message: 'Ref exists and can be validated without resolving the value.',
        suggestedFix: 'No action required before save.',
      },
      {
        id: 'node-npm-token',
        ref: 'secret://file/global/node/NPM_TOKEN',
        label: 'Node package registry token',
        provider: 'file source',
        connection: 'env-provider',
        status: 'warning',
        policyDecision:
          'policy/node/npm-token requires scoped file grant review',
        message:
          'Ref is known, but the source should be re-tested before a run.',
        suggestedFix:
          'Retest the file source and confirm the narrow grant path.',
      },
    ],
    snippet: [
      'secrets:',
      '  SESSION_SECRET: secret://local/default/@serviceadmin/SESSION_SECRET',
      '  NPM_TOKEN: secret://file/global/node/NPM_TOKEN',
      'validation:',
      '  mode: metadata-only',
      '  revealValues: false',
    ].join('\n'),
    guardrails: [
      'Save-time checks validate ref presence, provider connection state, and policy result only.',
      'The generated snippet contains SecretRef identifiers, never resolved values.',
      'Execution and run details stay in the workflow engine/operator companion.',
    ],
  },
  {
    id: 'deploy-payments-api',
    title: 'Deploy payments API',
    owner: 'payments-api',
    summary:
      'Show authors missing and denied refs before a workflow can be saved or handed to a runner.',
    targetRuntime:
      'Workflow authoring metadata; execution-runner specifics remain out of scope.',
    status: 'needs-action',
    refs: [
      {
        id: 'payments-stripe-key',
        ref: 'secret://vault/payments/STRIPE_KEY',
        label: 'Stripe API key',
        provider: 'Vault',
        connection: 'vault-ops',
        status: 'denied',
        policyDecision: 'policy/payments/prod-deny blocks deploy-payments-api',
        message: 'Policy denies this workflow identity before run.',
        suggestedFix:
          'Request policy review or select a workflow identity allowed to use this ref.',
      },
      {
        id: 'payments-db-password',
        ref: 'secret://local/default/payments-api/DB_PASSWORD',
        label: 'Payments database password',
        provider: 'local encrypted store',
        connection: 'local-default',
        status: 'missing',
        policyDecision:
          'policy/payments/db-password cannot find metadata entry',
        message: 'Ref metadata is missing, so save/run should be blocked.',
        suggestedFix:
          'Create/import the ref metadata in Secrets Broker, then validate again.',
      },
    ],
    snippet: [
      'secrets:',
      '  STRIPE_KEY: secret://vault/payments/STRIPE_KEY',
      '  DB_PASSWORD: secret://local/default/payments-api/DB_PASSWORD',
      'validation:',
      '  mode: metadata-only',
      '  blockOn: [missing, denied]',
      '  revealValues: false',
    ].join('\n'),
    guardrails: [
      'Denied and missing refs are visible before save/run handoff.',
      'Authors get policy and remediation context without broker value resolution.',
      'No runner/editor controls are rendered in Service Admin for this slice.',
    ],
  },
]

export function countWorkflowRefStatuses(
  workflows: WorkflowAuthoringBoundary[] = workflowAuthoringBoundaries
) {
  return workflows
    .flatMap((workflow) => workflow.refs)
    .reduce(
      (counts, ref) => {
        counts[ref.status] += 1
        return counts
      },
      { valid: 0, missing: 0, denied: 0, warning: 0 } as Record<
        WorkflowSecretRefStatus,
        number
      >
    )
}

export function workflowAuthoringHasSecretValue(
  workflows: WorkflowAuthoringBoundary[] = workflowAuthoringBoundaries
) {
  const joined = workflows
    .flatMap((workflow) => [
      workflow.id,
      workflow.title,
      workflow.owner,
      workflow.summary,
      workflow.targetRuntime,
      workflow.snippet,
      ...workflow.guardrails,
      ...workflow.refs.flatMap((ref) => [
        ref.id,
        ref.ref,
        ref.label,
        ref.provider,
        ref.connection,
        ref.policyDecision,
        ref.message,
        ref.suggestedFix,
      ]),
    ])
    .join(' ')

  return /hunter2|correct-horse|plain\s*text\s*secret|sk-[a-z0-9_-]{12,}|ghp_[a-z0-9_]{12,}|AKIA[0-9A-Z]{16}/i.test(
    joined
  )
}
