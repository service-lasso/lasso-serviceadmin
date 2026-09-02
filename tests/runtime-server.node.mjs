import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  resolvePackagedProxyHeaders,
  rotationProxyLifecycleEvidence,
  runtimeApiTimeoutMs,
  startServiceAdminServer,
  TrustedIngressProxyError,
} from '../runtime/server.js'
import {
  brokerMetadataEndpointCount,
  brokerMetadataReadinessAttempts,
  brokerMetadataRequestOptions,
  brokerMetadataRequestTimeoutMs,
  brokerMetadataRetryDelayMs,
  isManagedServiceStoppedResponse,
  boundedProviderMetadataExecuteNetworkWaitsMs,
  cypressQualificationTimeoutMs,
  linkedRotationExecuteCount,
  linkedRotationResponseTimeoutMs,
  managedServiceStartMutationRequestOptions,
  managedServiceStopReadinessAttempts,
  managedServiceStopReadinessWorstCaseMs,
  managedServiceStopMutationRequestOptions,
  managedServiceStopRequestOptions,
  createProviderUiConvergenceRecorder,
  parseProviderUiConvergenceEvidence,
  providerFinalLifecycleDiagnosticCount,
  providerFinalLifecycleDiagnosticRequestOptions,
  providerFinalLifecycleDiagnosticTimeoutMs,
  providerLifecycleDiagnostic,
  providerMigrationApplyDiagnostic,
  providerMigrationApplyErrorCodes,
  providerMigrationApplyFailureOutcomes,
  providerMigrationReadinessAttempts,
  providerMigrationReadinessCallCount,
  providerMigrationReadinessConvergenceWindowMs,
  providerMigrationReadinessWorstCaseMs,
  providerPointInTimeApplyReadinessAttempts,
  providerPointInTimeApplyReadinessCallCount,
  providerPointInTimeApplyReadinessWorstCaseMs,
  providerReadinessAttempts,
  providerReadinessCallCount,
  providerReadinessCheckpointCount,
  providerReadinessErrorCode,
  providerReadinessRequestOptions,
  providerReadinessReservedLifecycleMs,
  providerReadinessWorstCaseMs,
  providerUiConvergenceAttempts,
  providerUiConvergenceDiagnostic,
} from '../scripts/real-browser-qualification-budget.mjs'
import {
  buildQualificationFailureDiagnostic,
  classifyQualificationFailure,
  createQualificationProgressRecorder,
  parseQualificationProgressDiagnostic,
  qualificationProgressPhases,
} from '../scripts/real-browser-qualification-progress.mjs'
import {
  buildTransportDiagnostic,
  parseRotationProxyLifecycleDiagnostic,
  probeAdminReachability,
} from '../scripts/real-browser-transport-diagnostics.mjs'

test('bounded provider, metadata, and execute network waits retain exact source counts', async () => {
  assert.equal(cypressQualificationTimeoutMs, 720_000)
  assert.equal(linkedRotationExecuteCount, 2)
  assert.equal(linkedRotationResponseTimeoutMs, 120_000)
  assert.equal(brokerMetadataEndpointCount, 2)
  assert.equal(brokerMetadataReadinessAttempts, 5)
  assert.equal(managedServiceStopReadinessAttempts, 5)
  assert.equal(managedServiceStopReadinessWorstCaseMs(), 54_000)
  assert.equal(providerReadinessAttempts, 3)
  assert.equal(providerMigrationReadinessAttempts, 6)
  assert.equal(providerPointInTimeApplyReadinessAttempts, 1)
  assert.equal(providerReadinessCheckpointCount, 4)
  assert.equal(providerReadinessCallCount, 11)
  assert.equal(providerMigrationReadinessCallCount, 3)
  assert.equal(providerPointInTimeApplyReadinessCallCount, 1)
  assert.equal(providerReadinessWorstCaseMs(), 26_000)
  assert.equal(providerMigrationReadinessConvergenceWindowMs(), 5_000)
  assert.equal(providerMigrationReadinessWorstCaseMs(), 53_000)
  assert.equal(providerPointInTimeApplyReadinessWorstCaseMs(), 8_000)
  assert.equal(providerReadinessReservedLifecycleMs(), 349_000)
  assert.equal(providerFinalLifecycleDiagnosticCount, 1)
  assert.equal(providerFinalLifecycleDiagnosticTimeoutMs, 5_000)
  const brokerMetadataWorstCaseMs =
    brokerMetadataEndpointCount *
    (brokerMetadataReadinessAttempts * brokerMetadataRequestTimeoutMs +
      (brokerMetadataReadinessAttempts - 1) * brokerMetadataRetryDelayMs)
  assert.equal(brokerMetadataWorstCaseMs, 108_000)
  assert.equal(
    linkedRotationExecuteCount * linkedRotationResponseTimeoutMs,
    240_000
  )
  assert.equal(boundedProviderMetadataExecuteNetworkWaitsMs(), 702_000)
  // This network-only subtotal must never be presented as a whole-spec bound.
  // Lifecycle transitions, page loads, UI waits, tasks, and cleanup are
  // source-accounted separately against the fixed Cypress wrapper.
  for (const endpoint of ['telemetry', 'events']) {
    assert.deepEqual(brokerMetadataRequestOptions(`/operations/${endpoint}`), {
      method: 'GET',
      url: `/operations/${endpoint}`,
      failOnStatusCode: false,
      retryOnNetworkFailure: false,
      timeout: 10_000,
    })
  }
  assert.deepEqual(managedServiceStopRequestOptions('/api/services/broker'), {
    method: 'GET',
    url: '/api/services/broker',
    failOnStatusCode: false,
    retryOnNetworkFailure: false,
    timeout: 10_000,
  })
  assert.deepEqual(
    providerReadinessRequestOptions('/api/providers/config/status'),
    {
      method: 'GET',
      url: '/api/providers/config/status',
      failOnStatusCode: false,
      retryOnNetworkFailure: false,
      retryOnStatusCodeFailure: false,
      timeout: 8_000,
    }
  )
  assert.deepEqual(
    providerFinalLifecycleDiagnosticRequestOptions('/api/services/broker'),
    {
      method: 'GET',
      url: '/api/services/broker',
      failOnStatusCode: false,
      retryOnNetworkFailure: false,
      retryOnStatusCodeFailure: false,
      timeout: 5_000,
    }
  )
  assert.equal(
    isManagedServiceStoppedResponse({
      status: 200,
      body: {
        service: { status: 'discovered', lifecycle: { running: false } },
      },
    }),
    true
  )
  assert.equal(
    isManagedServiceStoppedResponse({
      status: 200,
      body: {
        service: { status: 'discovered', lifecycle: { running: true } },
      },
    }),
    false
  )
  assert.deepEqual(
    managedServiceStopMutationRequestOptions('/api/services/broker/stop'),
    {
      method: 'POST',
      url: '/api/services/broker/stop',
      body: { confirm: true },
      failOnStatusCode: true,
      retryOnNetworkFailure: false,
      retryOnStatusCodeFailure: false,
      timeout: 120_000,
    }
  )
  assert.deepEqual(
    managedServiceStartMutationRequestOptions('/api/services/broker/start'),
    {
      method: 'POST',
      url: '/api/services/broker/start',
      body: { confirm: false },
      failOnStatusCode: true,
      retryOnNetworkFailure: false,
      retryOnStatusCodeFailure: false,
      timeout: 120_000,
    }
  )
  const lifecycleSource = await readFile(
    new URL(
      '../cypress/e2e/secrets-broker/real-lifecycle.cy.js',
      import.meta.url
    ),
    'utf8'
  )
  const restartUiSource = lifecycleSource.slice(
    lifecycleSource.indexOf(
      'function restartBrokerFromUi(expectedRequestCount, requestCount)'
    ),
    lifecycleSource.indexOf(
      'function restartBrokerAndOpenSecrets(expectedRequestCount, requestCount)'
    )
  )
  const restartHelperSource = lifecycleSource.slice(
    lifecycleSource.indexOf(
      'function restartBrokerAndOpenSecrets(expectedRequestCount, requestCount)'
    ),
    lifecycleSource.indexOf('function assertSecretValuesAbsentFromBrowser')
  )
  assert.ok(restartUiSource.length > 0)
  assert.ok(restartHelperSource.length > 0)
  for (const uiRestartProof of [
    'cy.reload()',
    'unlockTrustedIdentity()',
    'cy.get(\'[data-testid="service-detail-lifecycle-controls"]\').within(() => {',
    "cy.contains('button', /^Restart service$/, { timeout: 20_000 })",
    "cy.contains('[role=\"alertdialog\"]', 'Confirm elevated action')",
    "cy.wait('@restartBrokerFromUi', { timeout: 120_000 })",
    'expect(request.body).to.deep.equal({ confirm: true })',
    'expect(response?.statusCode).to.equal(200)',
    'expect(requestCount()).to.equal(expectedRequestCount)',
  ]) {
    assert.equal(restartUiSource.split(uiRestartProof).length - 1, 1)
  }
  assert.equal(restartHelperSource.includes('cy.request('), false)
  assert.equal(
    restartHelperSource.split(
      'restartBrokerFromUi(expectedRequestCount, requestCount)'
    ).length - 1,
    1
  )
  const restartInterceptPattern =
    /cy\.intercept\(\r?\n[ \t]*'POST',\r?\n[ \t]*'\*\*\/api\/services\/%40secretsbroker\/restart'/g
  for (const source of [
    lifecycleSource.replace(/\r?\n/g, '\n'),
    lifecycleSource.replace(/\r?\n/g, '\r\n'),
  ]) {
    assert.equal([...source.matchAll(restartInterceptPattern)].length, 1)
  }
  assert.equal(
    lifecycleSource.includes("url: '/api/services/%40secretsbroker/restart'"),
    false
  )
  assert.equal(
    lifecycleSource.split('brokerRestartUiRequests += 1').length - 1,
    1
  )
  for (const requestCount of [1, 2]) {
    assert.equal(
      lifecycleSource.split(
        `restartBrokerAndOpenSecrets(${requestCount}, () => brokerRestartUiRequests)`
      ).length - 1,
      1
    )
  }
  assert.equal(
    lifecycleSource.split(
      'restartBrokerFromUi(3, () => brokerRestartUiRequests)'
    ).length - 1,
    1
  )
  const stoppedLifecycleSource = await readFile(
    new URL(
      '../cypress/e2e/secrets-broker/real-stopped-lifecycle.cy.js',
      import.meta.url
    ),
    'utf8'
  )
  const packageManifest = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  )
  const browserWorkflowSource = await readFile(
    new URL('../.github/workflows/real-secrets-broker.yml', import.meta.url),
    'utf8'
  )
  const verifierSource = await readFile(
    new URL('../scripts/verify-real-broker-browser.mjs', import.meta.url),
    'utf8'
  )
  const stoppedLifecycleVerifierSource = await readFile(
    new URL(
      '../scripts/verify-real-broker-stopped-lifecycle-browser.mjs',
      import.meta.url
    ),
    'utf8'
  )
  assert.equal(
    packageManifest.scripts['test:secrets:real-stopped-lifecycle-browser'],
    'node scripts/verify-real-broker-stopped-lifecycle-browser.mjs'
  )
  assert.equal(
    browserWorkflowSource.split(
      'pnpm test:secrets:real-stopped-lifecycle-browser'
    ).length - 1,
    1
  )
  assert.equal(
    stoppedLifecycleVerifierSource.split(
      "SERVICE_LASSO_REAL_BROWSER_MODE: 'stopped-lifecycle'"
    ).length - 1,
    1
  )
  assert.equal(
    verifierSource.split("? 'real-stopped-lifecycle.cy.js'").length - 1,
    1
  )
  assert.equal(
    verifierSource.split(
      "['first-run', 'stopped-lifecycle'].includes(qualificationMode)"
    ).length - 1,
    1
  )
  assert.equal(
    [...lifecycleSource.matchAll(/cy\.wait\('@executeLinkedRotation'/g)].length,
    1
  )
  assert.equal(
    [...lifecycleSource.matchAll(/cy\.wait\('@executeRollbackRotation'/g)]
      .length,
    1
  )
  assert.equal(
    [
      ...lifecycleSource.matchAll(
        /responseTimeout: linkedRotationResponseTimeoutMs/g
      ),
    ].length,
    2
  )
  assert.equal(
    [
      ...lifecycleSource.matchAll(
        /waitForManagedServiceStopped\('@secretsbroker'\)/g
      ),
    ].length,
    0
  )
  assert.equal(
    [
      ...lifecycleSource.matchAll(
        /managedServiceStopMutationRequestOptions\(\s*'\/api\/services\/%40secretsbroker\/stop'\s*\)/g
      ),
    ].length,
    0
  )
  assert.equal(
    [...lifecycleSource.matchAll(/cy\.wait\('@stoppedBrokerManagement'/g)]
      .length,
    0
  )
  assert.equal(
    [
      ...lifecycleSource.matchAll(
        /expect\(response\?\.statusCode\)\.to\.be\.within\(400, 599\)/g
      ),
    ].length,
    0
  )
  assert.equal(
    [
      ...stoppedLifecycleSource.matchAll(
        /waitForManagedServiceStopped\('@secretsbroker'\)/g
      ),
    ].length,
    1
  )
  assert.equal(
    [
      ...stoppedLifecycleSource.matchAll(
        /managedServiceStopMutationRequestOptions\(\s*'\/api\/services\/%40secretsbroker\/stop'\s*\)/g
      ),
    ].length,
    1
  )
  assert.equal(
    [
      ...stoppedLifecycleSource.matchAll(
        /managedServiceStartMutationRequestOptions\(\s*'\/api\/services\/%40secretsbroker\/start'\s*\)/g
      ),
    ].length,
    1
  )
  assert.equal(
    [
      ...stoppedLifecycleSource.matchAll(
        /cy\.wait\('@stoppedBrokerManagement'/g
      ),
    ].length,
    1
  )
  assert.equal(
    [
      ...stoppedLifecycleSource.matchAll(
        /expect\(response\?\.statusCode\)\.to\.be\.within\(400, 599\)/g
      ),
    ].length,
    1
  )
  for (const checkpoint of [
    'single_migration',
    'single_migration_apply',
    'policy_denied_migration_apply',
    'unavailable_migration',
    'unavailable_migration_apply',
    'bulk_migration',
    'post_rotation',
  ]) {
    assert.equal(
      [
        ...lifecycleSource.matchAll(
          new RegExp(`checkpoint: '${checkpoint}'`, 'g')
        ),
      ].length,
      1
    )
  }
  const standaloneProviderReadinessCalls = [
    ...lifecycleSource.matchAll(
      /^\s*waitForBrokerProviderStatusReadiness\(\)$/gm
    ),
  ].length
  const checkpointProviderReadinessCalls = providerReadinessCheckpointCount
  const checkpointInventoryReadinessCalls = [
    ...lifecycleSource.matchAll(
      /waitForBrokerInventoryReadiness\(\s*targetInventoryRef,\s*providerReadinessAttempts,/g
    ),
  ].length
  assert.equal(standaloneProviderReadinessCalls, 3)
  assert.equal(checkpointInventoryReadinessCalls, 1)
  const migrationBackendReadinessCalls = [
    ...lifecycleSource.matchAll(
      /backendReadinessAttempts:\s*providerMigrationReadinessAttempts/g
    ),
  ].length
  const migrationApplyReadinessCalls = [
    ['vault-browser', 'single_migration_apply'],
    ['vault-policy-denied', 'policy_denied_migration_apply'],
  ].reduce((count, [providerId, checkpoint]) => {
    const exactCall = new RegExp(
      `waitForBrokerProviderStatusReadiness\\(\\s*'${providerId}',\\s*providerMigrationReadinessAttempts,\\s*\\{ checkpoint: '${checkpoint}' \\}`,
      'g'
    )
    return count + [...lifecycleSource.matchAll(exactCall)].length
  }, 0)
  const pointInTimeApplyReadinessCalls = [
    ...lifecycleSource.matchAll(
      /waitForBrokerProviderStatusReadiness\(\s*'vault-unavailable',\s*providerPointInTimeApplyReadinessAttempts,\s*\{ checkpoint: 'unavailable_migration_apply' \}/g
    ),
  ].length
  assert.equal(migrationBackendReadinessCalls, 1)
  assert.equal(migrationApplyReadinessCalls, 2)
  assert.equal(pointInTimeApplyReadinessCalls, 1)
  assert.equal(
    standaloneProviderReadinessCalls +
      checkpointProviderReadinessCalls +
      checkpointInventoryReadinessCalls +
      migrationApplyReadinessCalls +
      pointInTimeApplyReadinessCalls,
    providerReadinessCallCount
  )
  assert.equal(
    migrationBackendReadinessCalls + migrationApplyReadinessCalls,
    providerMigrationReadinessCallCount
  )
  assert.equal(
    pointInTimeApplyReadinessCalls,
    providerPointInTimeApplyReadinessCallCount
  )
  assert.equal(
    [
      ...lifecycleSource.matchAll(
        /providerFinalLifecycleDiagnosticRequestOptions\(\s*'\/api\/services\/%40secretsbroker'\s*\)/g
      ),
    ].length,
    providerFinalLifecycleDiagnosticCount
  )
  assert.equal(
    [...lifecycleSource.matchAll(/cy\.wait\('@migrationApply'/g)].length,
    1
  )
  assert.equal(
    [
      ...lifecycleSource.matchAll(
        /cy\.intercept\('POST', '\*\*\/providers\/migration\/apply'\)/g
      ),
    ].length,
    3
  )
  assert.equal(
    [
      ...lifecycleSource.matchAll(
        /cy\.contains\('button', 'Apply migration'\)\.click\(\)/g
      ),
    ].length,
    3
  )
  for (const responseAlias of [
    'migrationApply',
    'policyDeniedMigration',
    'unavailableMigration',
  ]) {
    assert.equal(
      lifecycleSource.split(`cy.wait('@${responseAlias}',`).length - 1,
      1
    )
  }
  const dryRunReadyIndex = lifecycleSource.indexOf(
    "cy.contains('Migration dry run ready'"
  )
  const applyReadinessIndex = lifecycleSource.indexOf(
    "{ checkpoint: 'single_migration_apply' }"
  )
  const confirmMigrationIndex = lifecycleSource.indexOf(
    'cy.get(\'[aria-label="Confirm provider migration"]\').click()'
  )
  const migrationRevalidationIndex = lifecycleSource.indexOf(
    "revalidateMigrationPlan('migrationRevalidation')"
  )
  const applyMigrationIndex = lifecycleSource.indexOf(
    "cy.contains('button', 'Apply migration').click()"
  )
  assert.ok(dryRunReadyIndex < applyReadinessIndex)
  assert.ok(applyReadinessIndex < migrationRevalidationIndex)
  assert.ok(migrationRevalidationIndex < confirmMigrationIndex)
  assert.ok(confirmMigrationIndex < applyMigrationIndex)
  const policyDeniedDryRunIndex = lifecycleSource.indexOf(
    "cy.wait('@policyDeniedMigrationPreview'"
  )
  const policyDeniedApplyReadinessIndex = lifecycleSource.indexOf(
    "{ checkpoint: 'policy_denied_migration_apply' }"
  )
  const policyDeniedConfirmIndex = lifecycleSource.indexOf(
    'cy.get(\'[aria-label="Confirm provider migration"]\').click()',
    policyDeniedApplyReadinessIndex
  )
  const policyDeniedRevalidationIndex = lifecycleSource.indexOf(
    "revalidateMigrationPlan('policyDeniedMigrationRevalidation')"
  )
  const policyDeniedApplyIndex = lifecycleSource.indexOf(
    "cy.contains('button', 'Apply migration').click()",
    policyDeniedConfirmIndex
  )
  const policyDeniedResponseIndex = lifecycleSource.indexOf(
    "cy.wait('@policyDeniedMigration'",
    policyDeniedApplyIndex
  )
  assert.ok(policyDeniedDryRunIndex < policyDeniedApplyReadinessIndex)
  assert.ok(policyDeniedApplyReadinessIndex < policyDeniedRevalidationIndex)
  assert.ok(policyDeniedRevalidationIndex < policyDeniedConfirmIndex)
  assert.ok(policyDeniedConfirmIndex < policyDeniedApplyIndex)
  assert.ok(policyDeniedApplyIndex < policyDeniedResponseIndex)
  const unavailableDryRunIndex = lifecycleSource.indexOf(
    "cy.wait('@unavailableMigrationPreview'"
  )
  const unavailableApplyReadinessIndex = lifecycleSource.indexOf(
    "{ checkpoint: 'unavailable_migration_apply' }"
  )
  const unavailableConfirmIndex = lifecycleSource.indexOf(
    'cy.get(\'[aria-label="Confirm provider migration"]\').click()',
    unavailableApplyReadinessIndex
  )
  const unavailableRevalidationIndex = lifecycleSource.indexOf(
    "revalidateMigrationPlan('unavailableMigrationRevalidation')"
  )
  const unavailableApplyIndex = lifecycleSource.indexOf(
    "cy.contains('button', 'Apply migration').click()",
    unavailableConfirmIndex
  )
  const unavailableResponseIndex = lifecycleSource.indexOf(
    "cy.wait('@unavailableMigration'",
    unavailableApplyIndex
  )
  assert.ok(unavailableDryRunIndex < unavailableApplyReadinessIndex)
  assert.ok(unavailableApplyReadinessIndex < unavailableRevalidationIndex)
  assert.ok(unavailableRevalidationIndex < unavailableConfirmIndex)
  assert.ok(unavailableConfirmIndex < unavailableApplyIndex)
  assert.ok(unavailableApplyIndex < unavailableResponseIndex)
  // Bulk campaign apply is a distinct durable-campaign contract. Its exact
  // response-bound revalidation must complete before the one campaign apply.
  const bulkRevalidationIndex = lifecycleSource.indexOf(
    "cy.wait('@revalidateBulkMigrationCampaign'"
  )
  const bulkReadyIndex = lifecycleSource.indexOf(
    "cy.contains('Durable campaign ready'"
  )
  const bulkApplyInterceptIndex = lifecycleSource.indexOf(
    "cy.intercept('POST', '**/secrets/campaigns/apply')"
  )
  const bulkApplyClickIndex = lifecycleSource.indexOf(
    "cy.contains('button', 'Apply exact campaign').click()"
  )
  const bulkApplyResponseIndex = lifecycleSource.indexOf(
    "cy.wait('@applyBulkMigrationCampaign'"
  )
  assert.ok(bulkRevalidationIndex < bulkReadyIndex)
  assert.ok(bulkReadyIndex < bulkApplyInterceptIndex)
  assert.ok(bulkApplyInterceptIndex < bulkApplyClickIndex)
  assert.ok(bulkApplyClickIndex < bulkApplyResponseIndex)
  for (const bulkApplyProof of [
    "cy.intercept('POST', '**/secrets/campaigns/apply')",
    'cy.get(\'[aria-label="Confirm exact bulk migration campaign"]\').click()',
    "cy.contains('button', 'Apply exact campaign').click()",
    "cy.wait('@applyBulkMigrationCampaign'",
  ]) {
    assert.equal(lifecycleSource.split(bulkApplyProof).length - 1, 1)
  }
  assert.equal(
    [
      ...lifecycleSource.matchAll(
        /providerMigrationApplyDiagnostic\(response\)/g
      ),
    ].length,
    3
  )

  const postRotationStart = lifecycleSource.indexOf(
    "waitForProviderUiStatusAfterReload({ checkpoint: 'post_rotation' })"
  )
  const acceptanceComplete = lifecycleSource.indexOf(
    "qualificationCheckpoint('acceptance_complete')"
  )
  assert.ok(postRotationStart >= 0)
  assert.ok(acceptanceComplete > postRotationStart)
  const lateLifecycleSource = lifecycleSource.slice(
    postRotationStart,
    acceptanceComplete
  )
  const rawLifecycleRequestCount = [
    ...lateLifecycleSource.matchAll(/timeout:\s*120_000/g),
  ].length
  const sharedStopMutationCount = [
    ...lateLifecycleSource.matchAll(
      /managedServiceStopMutationRequestOptions\(/g
    ),
  ].length
  const controlRequestCount = [
    ...lateLifecycleSource.matchAll(
      /cy\.request\(\s*'POST',\s*`\$\{controlUrl\}\/(?:lock|unlock)-wrapper`\s*\)/g
    ),
  ].length
  const reloadCount = [...lateLifecycleSource.matchAll(/cy\.reload\(\)/g)]
    .length
  const directTwentySecondWaitCount = [
    ...lateLifecycleSource.matchAll(/timeout:\s*20_000/g),
  ].length
  const trustedIdentityWaitCount = [
    ...lateLifecycleSource.matchAll(/unlockTrustedIdentity\(\)/g),
  ].length
  const directThirtySecondWaitCount = [
    ...lateLifecycleSource.matchAll(/timeout:\s*30_000/g),
  ].length
  const openSecretsCount = [...lateLifecycleSource.matchAll(/openSecrets\(\)/g)]
    .length
  const visibleTableRowCount = [
    ...lateLifecycleSource.matchAll(/visibleTableRow\(/g),
  ].length
  const validationDialogCount = [
    ...lateLifecycleSource.matchAll(
      /dialog\('Validate provider configuration'\)/g
    ),
  ].length
  const lateCheckpointCount = [
    ...lateLifecycleSource.matchAll(/qualificationCheckpoint\('/g),
  ].length
  assert.equal(rawLifecycleRequestCount, 3)
  assert.equal(sharedStopMutationCount, 0)
  assert.equal(controlRequestCount, 2)
  assert.equal(reloadCount, 3)
  assert.equal(directTwentySecondWaitCount, 2)
  assert.equal(trustedIdentityWaitCount, 3)
  assert.equal(directThirtySecondWaitCount, 3)
  assert.equal(openSecretsCount, 2)
  assert.equal(visibleTableRowCount, 4)
  for (const lockedWrapperProof of [
    'failOnStatusCode: false',
    'expect(status).to.equal(409)',
    "error: 'invalid_lifecycle_state'",
    '/root exited during ownership enrollment/i',
    "cy.contains('Secrets Broker management is unavailable.'",
    "expect(body).to.deep.equal({ outcome: 'wrapper_restored' })",
  ]) {
    assert.equal(lateLifecycleSource.split(lockedWrapperProof).length - 1, 1)
  }
  assert.equal(
    lateLifecycleSource.split(
      'restartBrokerFromUi(3, () => brokerRestartUiRequests)'
    ).length - 1,
    1
  )
  assert.equal(validationDialogCount, 1)
  assert.equal(lateCheckpointCount, 4)
  assert.equal(
    [
      ...lateLifecycleSource.matchAll(
        /waitForManagedServiceStopped\('@secretsbroker'\)/g
      ),
    ].length,
    0
  )
  const lifecycleMutationWaitMs =
    (rawLifecycleRequestCount + sharedStopMutationCount) * 120_000
  const controlRequestWaitMs = controlRequestCount * 30_000
  const reloadWaitMs = reloadCount * 60_000
  const longUiWaitMs =
    (directTwentySecondWaitCount +
      trustedIdentityWaitCount +
      openSecretsCount * 2 +
      visibleTableRowCount * 2 +
      validationDialogCount) *
      20_000 +
    directThirtySecondWaitCount * 30_000
  const progressTaskWaitMs = (lateCheckpointCount + 1) * 60_000
  const uiRestartActionWaitMs =
    (lateLifecycleSource.split(
      'restartBrokerFromUi(3, () => brokerRestartUiRequests)'
    ).length -
      1) *
    140_000
  const enumeratedLateLifecycleWaitMs =
    lifecycleMutationWaitMs +
    controlRequestWaitMs +
    reloadWaitMs +
    longUiWaitMs +
    progressTaskWaitMs +
    uiRestartActionWaitMs
  assert.equal(enumeratedLateLifecycleWaitMs, 1_490_000)
  assert.ok(enumeratedLateLifecycleWaitMs > cypressQualificationTimeoutMs)
  // Default four-second UI commands and Cypress's implicit network retries are
  // deliberately excluded, so this is not a whole-spec maximum either.

  const stoppedLifecycleMutationCount = [
    ...stoppedLifecycleSource.matchAll(
      /managedService(?:Stop|Start)MutationRequestOptions\(/g
    ),
  ].length
  const stoppedLifecycleReloadCount = [
    ...stoppedLifecycleSource.matchAll(/cy\.reload\(\)/g),
  ].length
  const stoppedLifecycleTwentySecondWaitCount = [
    ...stoppedLifecycleSource.matchAll(/timeout:\s*20_000/g),
  ].length
  const stoppedLifecycleTrustedIdentityWaitCount = [
    ...stoppedLifecycleSource.matchAll(/unlockTrustedIdentity\(\)/g),
  ].length
  const stoppedLifecycleThirtySecondWaitCount = [
    ...stoppedLifecycleSource.matchAll(/timeout:\s*30_000/g),
  ].length
  assert.equal(stoppedLifecycleMutationCount, 2)
  assert.equal(stoppedLifecycleReloadCount, 1)
  assert.equal(stoppedLifecycleTwentySecondWaitCount, 3)
  assert.equal(stoppedLifecycleTrustedIdentityWaitCount, 2)
  assert.equal(stoppedLifecycleThirtySecondWaitCount, 5)
  const stoppedLifecycleEnumeratedWaitMs =
    stoppedLifecycleMutationCount * 120_000 +
    managedServiceStopReadinessWorstCaseMs() +
    stoppedLifecycleReloadCount * 60_000 +
    (stoppedLifecycleTwentySecondWaitCount +
      stoppedLifecycleTrustedIdentityWaitCount) *
      20_000 +
    stoppedLifecycleThirtySecondWaitCount * 30_000
  assert.equal(stoppedLifecycleEnumeratedWaitMs, 604_000)
  assert.ok(stoppedLifecycleEnumeratedWaitMs < cypressQualificationTimeoutMs)
})

test('provider UI convergence diagnostics expose only bounded allowlisted metadata', () => {
  assert.equal(providerUiConvergenceAttempts, 3)
  assert.equal(
    providerUiConvergenceDiagnostic({
      checkpoint: 'post_rotation',
      component: 'row_render',
      attempt: 2,
      statusCode: 200,
      errorCode: 'unknown',
      serviceRunning: true,
      serviceHealthy: true,
    }),
    'checkpoint=post_rotation, component=row_render, attempt=2, status=200, errorCode=unknown, serviceRunning=true, serviceHealthy=true'
  )

  const sanitized = providerUiConvergenceDiagnostic({
    checkpoint: 'private-provider-ref',
    component: 'response-body-value',
    attempt: 99,
    statusCode: 700,
  })
  assert.equal(
    sanitized,
    'checkpoint=unknown, component=unknown, attempt=6, status=unavailable, errorCode=unknown, serviceRunning=unavailable, serviceHealthy=unavailable'
  )
  assert.equal(sanitized.includes('private-provider-ref'), false)
  assert.equal(sanitized.includes('response-body-value'), false)

  const finalMigrationAttempt = {
    schema: 'service-admin.provider-ui-convergence.v1',
    checkpoint: 'policy_denied_migration_apply',
    component: 'response_metadata',
    attempt: 6,
    statusCode: 503,
    errorCode: 'broker_unavailable',
    serviceRunning: true,
    serviceHealthy: true,
  }
  assert.deepEqual(
    parseProviderUiConvergenceEvidence(JSON.stringify(finalMigrationAttempt)),
    {
      checkpoint: 'policy_denied_migration_apply',
      component: 'response_metadata',
      attempt: 6,
      statusCode: 503,
      errorCode: 'broker_unavailable',
      serviceRunning: true,
      serviceHealthy: true,
    }
  )
  assert.equal(
    parseProviderUiConvergenceEvidence(
      JSON.stringify({ ...finalMigrationAttempt, attempt: 7 })
    ),
    null
  )
  const pointInTimeUnavailableAttempt = {
    ...finalMigrationAttempt,
    checkpoint: 'unavailable_migration_apply',
    attempt: 1,
    statusCode: 200,
    errorCode: 'unknown',
  }
  assert.deepEqual(
    parseProviderUiConvergenceEvidence(
      JSON.stringify(pointInTimeUnavailableAttempt)
    ),
    {
      checkpoint: 'unavailable_migration_apply',
      component: 'response_metadata',
      attempt: 1,
      statusCode: 200,
      errorCode: 'unknown',
      serviceRunning: true,
      serviceHealthy: true,
    }
  )

  const writes = []
  const recorder = createProviderUiConvergenceRecorder({
    enabled: true,
    write: (line) => writes.push(line),
    maxEvents: 2,
  })
  recorder.setSpecPath(
    'C:/candidate/cypress/e2e/secrets-broker/real-lifecycle.cy.js'
  )
  assert.deepEqual(
    recorder.record({
      checkpoint: 'single_migration',
      component: 'response_metadata',
      attempt: 1,
      statusCode: 503,
      errorCode: 'secrets_broker_not_ready',
      serviceRunning: true,
      serviceHealthy: false,
    }),
    {
      checkpoint: 'single_migration',
      component: 'response_metadata',
      attempt: 1,
      statusCode: 503,
      errorCode: 'secrets_broker_not_ready',
      serviceRunning: true,
      serviceHealthy: false,
    }
  )
  recorder.record({
    checkpoint: 'post_rotation',
    component: 'row_render',
    attempt: 2,
    statusCode: 200,
    errorCode: 'unknown',
    serviceRunning: true,
    serviceHealthy: true,
  })
  assert.equal(
    recorder.record({
      checkpoint: 'bulk_migration',
      component: 'row_render',
      attempt: 3,
      statusCode: 200,
    }),
    null
  )
  assert.equal(writes.length, 2)
  assert.deepEqual(parseProviderUiConvergenceEvidence(writes[1].trim()), {
    checkpoint: 'post_rotation',
    component: 'row_render',
    attempt: 2,
    statusCode: 200,
    errorCode: 'unknown',
    serviceRunning: true,
    serviceHealthy: true,
  })
  assert.equal(
    parseProviderUiConvergenceEvidence(
      JSON.stringify({
        schema: 'service-admin.provider-ui-convergence.v1',
        checkpoint: 'private-provider-ref',
        component: 'response_metadata',
        attempt: 1,
        statusCode: 200,
        errorCode: 'unknown',
        serviceRunning: 'unavailable',
        serviceHealthy: 'unavailable',
      })
    ),
    null
  )

  const disabledWrites = []
  const disabled = createProviderUiConvergenceRecorder({
    enabled: false,
    write: (line) => disabledWrites.push(line),
  })
  disabled.setSpecPath(
    'C:/candidate/cypress/e2e/secrets-broker/real-lifecycle.cy.js'
  )
  assert.equal(
    disabled.record({
      checkpoint: 'post_rotation',
      component: 'row_render',
      attempt: 1,
      statusCode: 200,
    }),
    null
  )
  const otherSpec = createProviderUiConvergenceRecorder({
    enabled: true,
    write: (line) => disabledWrites.push(line),
  })
  otherSpec.setSpecPath('C:/candidate/cypress/e2e/other.cy.js')
  assert.equal(
    otherSpec.record({
      checkpoint: 'post_rotation',
      component: 'row_render',
      attempt: 1,
      statusCode: 200,
    }),
    null
  )
  assert.deepEqual(disabledWrites, [])
  assert.equal(
    providerReadinessErrorCode({
      error: 'secrets_broker_not_ready',
      message: 'private',
      path: 'private-path',
      value: 'private-value',
    }),
    'secrets_broker_not_ready'
  )
  assert.equal(
    providerReadinessErrorCode({
      error: { code: 'secrets_broker_not_ready', message: 'private' },
    }),
    'secrets_broker_not_ready'
  )
  assert.equal(
    providerReadinessErrorCode({ code: 'security_not_configured' }),
    'security_not_configured'
  )
  assert.equal(
    providerReadinessErrorCode({ error: 'broker_unavailable' }),
    'broker_unavailable'
  )
  assert.equal(
    providerReadinessErrorCode({ error: { code: 'private-path-or-ref' } }),
    'unknown'
  )
  assert.equal(
    providerReadinessErrorCode({
      error: 'private-code',
      code: 'broker_unavailable',
      message: 'private-message',
      ref: 'private-ref',
    }),
    'unknown'
  )
  assert.deepEqual(
    providerLifecycleDiagnostic({
      service: {
        lifecycle: { running: true },
        health: { healthy: false, message: 'private' },
      },
    }),
    { serviceRunning: true, serviceHealthy: false }
  )
  assert.deepEqual(providerLifecycleDiagnostic({ private: 'value' }), {
    serviceRunning: 'unavailable',
    serviceHealthy: 'unavailable',
  })
  assert.deepEqual(providerMigrationApplyFailureOutcomes, [
    'audit_unavailable',
    'degraded',
    'locked',
    'missing_ref',
    'source_auth_required',
    'source_unavailable',
  ])
  assert.deepEqual(providerMigrationApplyErrorCodes, [
    'broker_unavailable',
    'secrets_broker_not_ready',
    'security_not_configured',
  ])
  const safeMigrationFailure = providerMigrationApplyDiagnostic({
    statusCode: 503,
    body: {
      outcome: 'audit_unavailable',
      error: { code: 'broker_unavailable', message: 'private message' },
      ref: 'private ref',
      value: 'private value',
    },
  })
  assert.equal(
    safeMigrationFailure,
    'status=503, outcome=audit_unavailable, errorCode=broker_unavailable'
  )
  assert.equal(safeMigrationFailure.includes('private'), false)
  assert.equal(
    providerMigrationApplyDiagnostic({
      statusCode: 700,
      body: {
        outcome: 'private-outcome',
        code: 'private-code',
        path: 'private-path',
      },
    }),
    'status=unavailable, outcome=unknown, errorCode=unknown'
  )
})

test('qualification progress is allowlisted, ordered, integral, and capped', () => {
  const writes = []
  let now = 1_000.5
  const recorder = createQualificationProgressRecorder({
    enabled: true,
    write: (line) => writes.push(line),
    now: () => now,
    maxEvents: 2,
  })
  recorder.setSpecPath(
    'C:/candidate/cypress/e2e/secrets-broker/real-lifecycle.cy.js'
  )
  now = 1_123.9
  assert.deepEqual(recorder.record('lifecycle_started'), {
    phase: 'lifecycle_started',
    elapsedMs: 123,
  })
  now = 1_456.2
  assert.deepEqual(recorder.record('committed_rotation_complete'), {
    phase: 'committed_rotation_complete',
    elapsedMs: 455,
  })
  assert.equal(recorder.record('rollback_fixture_armed'), null)
  assert.equal(writes.length, 2)
  assert.deepEqual(parseQualificationProgressDiagnostic(writes[1].trim()), {
    phase: 'committed_rotation_complete',
    elapsedMs: 455,
  })
  assert.equal(
    parseQualificationProgressDiagnostic(
      JSON.stringify({
        schema: 'service-admin.real-browser-progress.v1',
        phase: 'not_allowed',
        elapsedMs: 1,
      })
    ),
    null
  )
  assert.equal(
    parseQualificationProgressDiagnostic(
      JSON.stringify({
        schema: 'service-admin.real-browser-progress.v1',
        phase: 'wrapper_recovery_complete',
        elapsedMs: 1,
        raw: 'discard-me',
      })
    ),
    null
  )
  assert.deepEqual(qualificationProgressPhases, [
    'lifecycle_started',
    'committed_rotation_complete',
    'rollback_fixture_armed',
    'rollback_rotation_complete',
    'metadata_ready',
    'rollback_rehydrated',
    'provider_validation_complete',
    'broker_restart_rehydrated',
    'wrapper_locked',
    'wrapper_recovery_complete',
    'acceptance_complete',
  ])

  const outOfOrder = createQualificationProgressRecorder({ enabled: true })
  outOfOrder.setSpecPath(
    'C:/candidate/cypress/e2e/secrets-broker/real-lifecycle.cy.js'
  )
  outOfOrder.record('rollback_fixture_armed')
  assert.throws(
    () => outOfOrder.record('committed_rotation_complete'),
    /invalid or out of order/
  )
})

test('qualification progress emits nothing when disabled or outside the lifecycle spec', () => {
  const writes = []
  const disabled = createQualificationProgressRecorder({
    enabled: false,
    write: (line) => writes.push(line),
  })
  disabled.setSpecPath(
    'C:/candidate/cypress/e2e/secrets-broker/real-lifecycle.cy.js'
  )
  assert.equal(disabled.record('lifecycle_started'), null)

  const otherSpec = createQualificationProgressRecorder({
    enabled: true,
    write: (line) => writes.push(line),
  })
  otherSpec.setSpecPath('C:/candidate/real-first-run.cy.js')
  assert.equal(otherSpec.record('lifecycle_started'), null)
  otherSpec.setSpecPath('C:/other-suite/real-lifecycle.cy.js')
  assert.equal(otherSpec.record('lifecycle_started'), null)
  assert.deepEqual(writes, [])
})

test('qualification progress call sites are exact, ordered, and bounded', async () => {
  const lifecycleSource = await readFile(
    new URL(
      '../cypress/e2e/secrets-broker/real-lifecycle.cy.js',
      import.meta.url
    ),
    'utf8'
  )
  let previousIndex = -1
  for (const phase of qualificationProgressPhases) {
    const call = `qualificationCheckpoint('${phase}')`
    assert.equal(lifecycleSource.split(call).length - 1, 1)
    const nextIndex = lifecycleSource.indexOf(call)
    assert.ok(nextIndex > previousIndex)
    previousIndex = nextIndex
  }

  const writes = []
  let now = 10_000
  const recorder = createQualificationProgressRecorder({
    enabled: true,
    write: (line) => writes.push(line),
    now: () => now,
  })
  recorder.setSpecPath(
    'C:/candidate/cypress/e2e/secrets-broker/real-lifecycle.cy.js'
  )
  for (const phase of qualificationProgressPhases) {
    now += 1_000
    assert.deepEqual(recorder.record(phase), {
      phase,
      elapsedMs: now - 10_000,
    })
  }
  assert.equal(writes.length, qualificationProgressPhases.length)
  assert.equal(recorder.record('acceptance_complete'), null)
})

test('qualification failures retain only bounded phase and transport metadata', () => {
  assert.equal(classifyQualificationFailure({ timedOut: true }), 'timeout')
  assert.equal(classifyQualificationFailure({ exitCode: 1 }), 'nonzero_exit')
  assert.equal(classifyQualificationFailure({ exitCode: 0 }), null)
  assert.equal(classifyQualificationFailure({ exitCode: null }), 'nonzero_exit')
  assert.deepEqual(
    buildQualificationFailureDiagnostic({
      failure: 'timeout',
      progressEvents: [
        { phase: 'lifecycle_started', elapsedMs: 20 },
        { phase: 'wrapper_recovery_complete', elapsedMs: 80_000 },
      ],
      providerUiDiagnostic: {
        checkpoint: 'single_migration_apply',
        component: 'response_metadata',
        attempt: 6,
        statusCode: 503,
        errorCode: 'secrets_broker_not_ready',
        serviceRunning: true,
        serviceHealthy: false,
      },
      transportDiagnostic: {
        phases: ['upstream_started', 'headers_received', 'body_received'],
        statuses: [200, 200],
        adminReachability: 'reachable',
      },
    }),
    {
      schema: 'service-admin.real-browser-qualification-diagnostic.v1',
      failure: 'timeout',
      lastPhase: 'wrapper_recovery_complete',
      elapsedMs: 80_000,
      transportPhases: [
        'upstream_started',
        'headers_received',
        'body_received',
      ],
      statuses: [200, 200],
      adminReachability: 'reachable',
      providerUi: {
        checkpoint: 'single_migration_apply',
        component: 'response_metadata',
        attempt: 6,
        statusCode: 503,
        errorCode: 'secrets_broker_not_ready',
        serviceRunning: true,
        serviceHealthy: false,
      },
    }
  )
  assert.equal(
    buildQualificationFailureDiagnostic({
      failure: 'nonzero_exit',
      providerUiDiagnostic: {
        checkpoint: 'single_migration_apply',
        component: 'response_metadata',
        attempt: 7,
        statusCode: 503,
        errorCode: 'broker_unavailable',
        serviceRunning: true,
        serviceHealthy: true,
      },
    }).providerUi,
    null
  )
  assert.deepEqual(
    buildQualificationFailureDiagnostic({
      failure: 'nonzero_exit',
      progressEvents: [
        { phase: 'wrapper_recovery_complete', elapsedMs: 1_234 },
      ],
      transportDiagnostic: { adminReachability: 'unreachable' },
    }),
    {
      schema: 'service-admin.real-browser-qualification-diagnostic.v1',
      failure: 'nonzero_exit',
      lastPhase: 'wrapper_recovery_complete',
      elapsedMs: 1_234,
      transportPhases: [],
      statuses: [],
      adminReachability: 'unreachable',
      providerUi: null,
    }
  )
})

async function listen(server, host = '127.0.0.1') {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, host, resolve)
  })
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  return `http://${host}:${address.port}`
}

async function close(server) {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
}

test('packaged proxy binds loopback and normalizes only safe ingress identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'serviceadmin-runtime-'))
  await writeFile(path.join(root, 'index.html'), '<h1>Service Admin</h1>')
  let observed = null
  const upstream = http.createServer((request, response) => {
    observed = { headers: request.headers, url: request.url }
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ auth: 'safe' }))
  })
  const upstreamUrl = await listen(upstream)
  const serviceAdmin = await startServiceAdminServer({
    host: '127.0.0.1',
    port: 0,
    distDir: root,
    runtimeApiBaseUrl: upstreamUrl,
  })
  const address = serviceAdmin.address()
  assert.ok(address && typeof address === 'object')

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/runtime/security`,
      {
        headers: {
          Authorization: 'Bearer browser-token-must-not-forward',
          Cookie: 'session=must-not-forward',
          'X-Forwarded-For': '192.0.2.40',
          'X-Service-Lasso-User': 'usr_trusted_operator',
          'X-Service-Lasso-Workspace': 'workspace-a',
          'X-Service-Lasso-Roles': 'operator, VIEWER, invalid role,operator',
          'X-Service-Lasso-Zitadel-User-Id': 'spoofed-normalized-user',
          'X-Service-Lasso-Client-Address': '127.0.0.1',
          'X-Service-Lasso-Proxy': 'spoofed-browser-proxy',
          'X-Service-Lasso-Trusted-Ingress': 'spoofed-browser-ingress',
        },
      }
    )
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { auth: 'safe' })
    assert.equal(observed.url, '/api/runtime/security')
    assert.equal(
      observed.headers['x-service-lasso-internal-proxy'],
      'serviceadmin'
    )
    assert.equal(observed.headers['x-service-lasso-proxy'], 'serviceadmin')
    assert.equal(
      observed.headers['x-service-lasso-trusted-ingress'],
      'serviceadmin-loopback'
    )
    assert.equal(
      observed.headers['x-service-lasso-client-address'],
      '192.0.2.40'
    )
    assert.equal(
      observed.headers['x-service-lasso-zitadel-user-id'],
      'usr_trusted_operator'
    )
    assert.equal(
      observed.headers['x-service-lasso-workspace-id'],
      'workspace-a'
    )
    assert.equal(
      observed.headers['x-service-lasso-zitadel-roles'],
      'operator,viewer'
    )
    assert.equal(
      observed.headers['x-service-lasso-user'],
      'usr_trusted_operator'
    )
    assert.equal(
      observed.headers['x-service-lasso-actor'],
      'usr_trusted_operator'
    )
    assert.equal(observed.headers['x-service-lasso-workspace'], 'workspace-a')
    assert.equal(observed.headers['x-service-lasso-roles'], 'operator,viewer')
    assert.equal(observed.headers.authorization, undefined)
    assert.equal(observed.headers.cookie, undefined)
    assert.equal(
      JSON.stringify(observed).includes('browser-token-must-not-forward'),
      false
    )
    assert.equal(
      JSON.stringify(observed).includes('spoofed-normalized-user'),
      false
    )
    assert.equal(
      JSON.stringify(observed).includes('spoofed-browser-proxy'),
      false
    )
    assert.equal(
      JSON.stringify(observed).includes('spoofed-browser-ingress'),
      false
    )
  } finally {
    await close(serviceAdmin)
    await close(upstream)
    await rm(root, { recursive: true, force: true })
  }
})

test('packaged proxy fails closed on missing Traefik original-client context', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'serviceadmin-runtime-'))
  await writeFile(path.join(root, 'index.html'), '<h1>Service Admin</h1>')
  let upstreamHits = 0
  const upstream = http.createServer((_request, response) => {
    upstreamHits += 1
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ auth: 'leaked' }))
  })
  const upstreamUrl = await listen(upstream)
  const serviceAdmin = await startServiceAdminServer({
    host: '127.0.0.1',
    port: 0,
    distDir: root,
    runtimeApiBaseUrl: upstreamUrl,
  })
  const address = serviceAdmin.address()
  assert.ok(address && typeof address === 'object')

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/runtime/security`,
      { headers: { 'X-Service-Lasso-User': 'usr_missing_client' } }
    )
    assert.equal(response.status, 403)
    const body = await response.json()
    assert.equal(body.error, 'trusted_ingress_identity_invalid')
    assert.equal(upstreamHits, 0)
    assert.equal(JSON.stringify(body).includes('usr_missing_client'), false)
    assert.doesNotMatch(JSON.stringify(body), /Bearer |cookie|password/i)
  } finally {
    await close(serviceAdmin)
    await close(upstream)
    await rm(root, { recursive: true, force: true })
  }
})

test('packaged proxy fails closed on mismatched Traefik actor', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'serviceadmin-runtime-'))
  await writeFile(path.join(root, 'index.html'), '<h1>Service Admin</h1>')
  let upstreamHits = 0
  const upstream = http.createServer((_request, response) => {
    upstreamHits += 1
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ auth: 'leaked' }))
  })
  const upstreamUrl = await listen(upstream)
  const serviceAdmin = await startServiceAdminServer({
    host: '127.0.0.1',
    port: 0,
    distDir: root,
    runtimeApiBaseUrl: upstreamUrl,
  })
  const address = serviceAdmin.address()
  assert.ok(address && typeof address === 'object')

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/runtime/security`,
      {
        headers: {
          'X-Forwarded-For': '192.0.2.44',
          'X-Service-Lasso-User': 'usr_trusted_operator',
          'X-Service-Lasso-Actor': 'usr_other_actor',
        },
      }
    )
    assert.equal(response.status, 403)
    assert.equal(upstreamHits, 0)
    assert.doesNotMatch(await response.text(), /usr_other_actor|Bearer /)
  } finally {
    await close(serviceAdmin)
    await close(upstream)
    await rm(root, { recursive: true, force: true })
  }
})

test('direct-port spoofed identity stays local-root and never reaches Core', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'serviceadmin-runtime-'))
  await writeFile(path.join(root, 'index.html'), '<h1>Service Admin</h1>')
  let observed = null
  const upstream = http.createServer((request, response) => {
    observed = { headers: request.headers }
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ auth: 'safe' }))
  })
  const upstreamUrl = await listen(upstream)
  const serviceAdmin = await startServiceAdminServer({
    host: '127.0.0.1',
    port: 0,
    distDir: root,
    runtimeApiBaseUrl: upstreamUrl,
  })
  const address = serviceAdmin.address()
  assert.ok(address && typeof address === 'object')

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/runtime/security`,
      {
        headers: {
          Authorization: 'Bearer browser-token-must-not-forward',
          Cookie: 'session=must-not-forward',
          'X-Forwarded-For': '192.0.2.41',
          'X-Service-Lasso-Zitadel-User-Id': 'spoofed-normalized-user',
          'X-Service-Lasso-User-Id': 'spoofed-user-id',
          'X-Service-Lasso-Client-Address': '203.0.113.9',
          'X-Service-Lasso-Trusted-Ingress': 'serviceadmin-loopback',
          'X-Service-Lasso-Internal-Proxy': 'spoofed-browser-proxy',
          'X-Service-Lasso-Admin-Token': 'must-not-forward',
        },
      }
    )
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { auth: 'safe' })
    assert.equal(
      observed.headers['x-service-lasso-internal-proxy'],
      'serviceadmin'
    )
    assert.equal(observed.headers['x-service-lasso-proxy'], 'serviceadmin')
    assert.equal(observed.headers['x-service-lasso-trusted-ingress'], undefined)
    assert.equal(observed.headers['x-service-lasso-client-address'], undefined)
    assert.equal(observed.headers['x-service-lasso-zitadel-user-id'], undefined)
    assert.equal(observed.headers['x-service-lasso-user'], undefined)
    assert.equal(observed.headers['x-service-lasso-actor'], undefined)
    assert.equal(observed.headers.authorization, undefined)
    assert.equal(observed.headers.cookie, undefined)
    assert.equal(observed.headers['x-service-lasso-admin-token'], undefined)
    const serialized = JSON.stringify(observed)
    assert.equal(serialized.includes('browser-token-must-not-forward'), false)
    assert.equal(serialized.includes('spoofed-normalized-user'), false)
    assert.equal(serialized.includes('must-not-forward'), false)
  } finally {
    await close(serviceAdmin)
    await close(upstream)
    await rm(root, { recursive: true, force: true })
  }
})

test('loopback without Traefik identity stays local-root', () => {
  const headers = resolvePackagedProxyHeaders({
    headers: {
      accept: 'application/json',
      authorization: 'Bearer browser-token-must-not-forward',
    },
    socket: { remoteAddress: '127.0.0.1' },
  })
  assert.equal(headers.get('x-service-lasso-internal-proxy'), 'serviceadmin')
  assert.equal(headers.get('x-service-lasso-proxy'), 'serviceadmin')
  assert.equal(headers.get('x-service-lasso-trusted-ingress'), null)
  assert.equal(headers.get('x-service-lasso-client-address'), null)
  assert.equal(headers.get('x-service-lasso-zitadel-user-id'), null)
  assert.equal(headers.get('authorization'), null)
})

test('malformed Traefik identity fails closed before Core', () => {
  assert.throws(
    () =>
      resolvePackagedProxyHeaders({
        headers: {
          'x-service-lasso-user': 'usr_missing_client',
        },
        socket: { remoteAddress: '127.0.0.1' },
      }),
    (error) =>
      error instanceof TrustedIngressProxyError &&
      error.code === 'trusted_ingress_identity_missing'
  )
  assert.throws(
    () =>
      resolvePackagedProxyHeaders({
        headers: {
          'x-forwarded-for': '192.0.2.44',
          'x-service-lasso-user': 'usr_trusted_operator',
          'x-service-lasso-actor': 'usr_other_actor',
        },
        socket: { remoteAddress: '127.0.0.1' },
      }),
    (error) =>
      error instanceof TrustedIngressProxyError &&
      error.code === 'trusted_ingress_identity_mismatch'
  )
})

test('packaged proxy gives consumer-converging rotation a bounded cross-platform window', () => {
  assert.equal(
    runtimeApiTimeoutMs('POST', '/api/services/%40secretsbroker/restart'),
    120_000
  )
  assert.equal(
    runtimeApiTimeoutMs('POST', '/api/services/sample/config'),
    120_000
  )
  assert.equal(
    runtimeApiTimeoutMs('POST', '/api/services/sample/reload'),
    120_000
  )
  assert.equal(
    runtimeApiTimeoutMs('POST', '/api/services/sample/start'),
    120_000
  )
  assert.equal(
    runtimeApiTimeoutMs('POST', '/api/secrets/rotation/execute'),
    300_000
  )
  assert.equal(runtimeApiTimeoutMs('POST', '/api/setup/bootstrap'), 180_000)
  assert.equal(
    runtimeApiTimeoutMs('GET', '/api/services/sample/restart'),
    30_000
  )
  assert.equal(
    runtimeApiTimeoutMs('GET', '/api/secrets/rotation/execute'),
    30_000
  )
  assert.equal(
    runtimeApiTimeoutMs('POST', '/api/services/sample/secrets/reveal'),
    30_000
  )
})

test('rotation proxy lifecycle evidence is bounded to safe metadata', async () => {
  assert.deepEqual(rotationProxyLifecycleEvidence('headers_received', 200), {
    schema: 'service-admin.rotation-proxy-lifecycle.v1',
    phase: 'headers_received',
    status: 200,
  })
  assert.deepEqual(rotationProxyLifecycleEvidence('downstream_closed'), {
    schema: 'service-admin.rotation-proxy-lifecycle.v1',
    phase: 'downstream_closed',
  })
  assert.equal(rotationProxyLifecycleEvidence('raw_response', 200), null)

  const parsed = parseRotationProxyLifecycleDiagnostic(
    JSON.stringify(rotationProxyLifecycleEvidence('body_received', 200))
  )
  assert.deepEqual(parsed, { phase: 'body_received', status: 200 })
  assert.equal(
    parseRotationProxyLifecycleDiagnostic(
      JSON.stringify({
        schema: 'service-admin.rotation-proxy-lifecycle.v1',
        phase: 'body_received',
        status: 200,
        url: 'must-not-be-retained',
      })
    ),
    null
  )
  assert.equal(
    parseRotationProxyLifecycleDiagnostic(
      JSON.stringify({
        schema: 'service-admin.rotation-proxy-lifecycle.v1',
        phase: 'body_received',
        status: 999,
      })
    ),
    null
  )

  assert.equal(
    await probeAdminReachability('http://127.0.0.1:17700', async () => ({
      body: null,
    })),
    'reachable'
  )
  assert.equal(
    await probeAdminReachability('http://127.0.0.1:17700', async () => {
      throw new Error('connection closed')
    }),
    'unreachable'
  )
  assert.deepEqual(
    buildTransportDiagnostic(
      [
        { phase: 'upstream_started' },
        { phase: 'headers_received', status: 200 },
        { phase: 'raw_body', status: 200, value: 'must-not-be-retained' },
      ],
      'reachable'
    ),
    {
      schema: 'service-admin.real-browser-transport-diagnostic.v1',
      phases: ['upstream_started', 'headers_received'],
      statuses: [200],
      adminReachability: 'reachable',
    }
  )
})

test('rotation proxy reports response lifecycle without request or response material', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'serviceadmin-runtime-'))
  await writeFile(path.join(root, 'index.html'), '<h1>Service Admin</h1>')
  const privateMaterial = 'private-rotation-material-must-not-be-retained'
  const upstream = http.createServer(async (request, response) => {
    for await (const _chunk of request) {
      // Consume the request before returning the typed result.
    }
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ outcome: 'rolled_back' }))
  })
  const upstreamUrl = await listen(upstream)
  const lifecycleLines = []
  const originalStderrWrite = process.stderr.write
  process.stderr.write = function (chunk, ...args) {
    const line = String(chunk)
    if (line.includes('service-admin.rotation-proxy-lifecycle.v1')) {
      lifecycleLines.push(line.trim())
      return true
    }
    return originalStderrWrite.call(process.stderr, chunk, ...args)
  }
  const serviceAdmin = await startServiceAdminServer({
    host: '127.0.0.1',
    port: 0,
    distDir: root,
    runtimeApiBaseUrl: upstreamUrl,
    rotationProxyLifecycleDiagnostics: true,
  })
  const address = serviceAdmin.address()
  assert.ok(address && typeof address === 'object')

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/secrets/rotation/execute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate: privateMaterial }),
      }
    )
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { outcome: 'rolled_back' })
    const deadline = Date.now() + 1_000
    while (
      !lifecycleLines.some((line) => line.includes('downstream_closed')) &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    const lifecycleEvents = lifecycleLines.map((line) => JSON.parse(line))
    assert.deepEqual(
      lifecycleEvents.map(({ phase }) => phase),
      [
        'upstream_started',
        'headers_received',
        'body_received',
        'downstream_closed',
      ]
    )
    assert.deepEqual(
      lifecycleEvents.flatMap(({ status }) =>
        status === undefined ? [] : [status]
      ),
      [200, 200]
    )
    assert.equal(
      JSON.stringify(lifecycleEvents).includes(privateMaterial),
      false
    )
    assert.equal(JSON.stringify(lifecycleEvents).includes('/api/'), false)
  } finally {
    process.stderr.write = originalStderrWrite
    await close(serviceAdmin)
    await close(upstream)
    await rm(root, { recursive: true, force: true })
  }
})

test('packaged runtime refuses a non-loopback listener and non-loopback core origin', async () => {
  await assert.rejects(
    startServiceAdminServer({
      host: '0.0.0.0',
      port: 0,
      runtimeApiBaseUrl: 'http://127.0.0.1:17883',
    }),
    /loopback host/i
  )
  await assert.rejects(
    startServiceAdminServer({
      host: '127.0.0.1',
      port: 0,
      runtimeApiBaseUrl: 'http://192.0.2.10:17883',
    }),
    /loopback origin/i
  )
})

test('static serving is confined and carries browser hardening headers', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'serviceadmin-static-'))
  await writeFile(
    path.join(root, 'index.html'),
    '<h1>Service Admin safe shell</h1>'
  )
  const server = await startServiceAdminServer({
    host: '127.0.0.1',
    port: 0,
    distDir: root,
    runtimeApiBaseUrl: 'http://127.0.0.1:9',
  })
  const address = server.address()
  assert.ok(address && typeof address === 'object')

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/../../outside`
    )
    assert.equal(response.status, 200)
    assert.match(await response.text(), /Service Admin safe shell/)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(response.headers.get('x-frame-options'), 'DENY')
    assert.match(
      response.headers.get('content-security-policy') ?? '',
      /frame-ancestors 'none'/
    )
  } finally {
    await close(server)
    await rm(root, { recursive: true, force: true })
  }
})
