const expectedRef = 'services/sample-service/sample.GENERATED_TOKEN'
const createdRef = 'services/sample-service/browser.CREATED_TOKEN'
const rotationCandidate = 'browser-rotation-candidate-2026-08-14-verified'
const rollbackCandidate =
  '/private/service-lasso/browser-rollback-sentinel-2026-08-26'
const rollbackReason = 'Release browser automatic rollback qualification'
const editedCandidate = 'browser-edited-candidate-2026-08-14-verified'
const resetCandidate = 'browser-reset-candidate-2026-08-14-verified'

function dialog(title) {
  return cy.contains('[role="dialog"]', title, { timeout: 20_000 })
}

function waitForVerifiedBackupCreation(alias) {
  return cy.wait(`@${alias}`, { timeout: 60_000 }).then(({ response }) => {
    const safeBackupResult = {
      status: response?.statusCode,
      outcome: response?.body?.outcome,
      applied: response?.body?.applied,
      auditStatus: response?.body?.auditStatus,
      verification: response?.body?.backup?.verification,
    }
    expect(safeBackupResult, JSON.stringify(safeBackupResult)).to.deep.equal({
      status: 200,
      outcome: 'ready',
      applied: true,
      auditStatus: 'audit_recorded',
      verification: 'verified',
    })
  })
}

function openSecrets() {
  cy.contains('[role="tab"]', /^Secrets\b/, { timeout: 20_000 }).click()
  cy.get('body').then(($body) => {
    if ($body.text().includes('Secrets Broker management is unavailable.')) {
      cy.contains('button', 'Retry inventory').click()
    }
  })
  cy.contains(expectedRef, { timeout: 20_000 }).should('be.visible')
}

function managedSecretsInventory() {
  return cy.get('[data-testid="managed-secrets-inventory"]')
}

function restartBrokerAndOpenSecrets() {
  cy.request({
    method: 'POST',
    url: '/api/services/%40secretsbroker/restart',
    body: { confirm: true },
    timeout: 120_000,
  }).its('status').should('equal', 200)
  waitForManagedServiceReadiness('@secretsbroker')
  cy.reload()
  cy.contains('Trusted identity verified', { timeout: 20_000 }).should('exist')
  openSecrets()
}

function assertSecretValuesAbsentFromBrowser(secretValues) {
  cy.window().then((browserWindow) => {
    const storageValues = [
      browserWindow.localStorage,
      browserWindow.sessionStorage,
    ].flatMap((storage) =>
      Array.from({ length: storage.length }, (_, index) =>
        storage.getItem(storage.key(index))
      ).filter(Boolean)
    )
    const browserSurface = [
      browserWindow.document.documentElement.textContent ?? '',
      browserWindow.location.href,
      browserWindow.document.cookie,
      ...storageValues,
      ...browserWindow.performance
        .getEntriesByType('resource')
        .map((entry) => entry.name),
    ].join('\n')
    expect(
      secretValues.some((value) => browserSurface.includes(value)),
      'secret values are absent from DOM, URL, cookies, storage, and resource URLs'
    ).to.equal(false)
  })
}

function containsPrivateMaterial(value, privateValues) {
  let serialized = ''
  try {
    serialized = `${String(value)}\n${JSON.stringify(value)}`
  } catch {
    serialized = String(value)
  }
  return privateValues.some((privateValue) => serialized.includes(privateValue))
}

function installPrivateConsoleGuard(browserWindow, privateValues, onLeak) {
  for (const method of ['debug', 'error', 'info', 'log', 'warn']) {
    const original = browserWindow.console[method]
    browserWindow.console[method] = (...values) => {
      if (values.some((value) => containsPrivateMaterial(value, privateValues))) {
        onLeak()
        return
      }
      original.apply(browserWindow.console, values)
    }
  }
}

function assertPrivateMaterialAbsentFromMetadata(
  metadata,
  privateValues,
  assertion
) {
  expect(
    containsPrivateMaterial(metadata, privateValues),
    assertion
  ).to.equal(false)
}

function waitForManagedServiceReadiness(serviceId, remainingAttempts = 60) {
  cy.request({
    method: 'GET',
    url: `/api/services/${encodeURIComponent(serviceId)}`,
    failOnStatusCode: false,
    timeout: 20_000,
  }).then(({ status, body }) => {
    const service = body?.service
    if (
      status === 200 &&
      service?.lifecycle?.running === true &&
      service?.health?.healthy === true
    ) {
      return
    }

    if (remainingAttempts <= 1) {
      throw new Error(
        `Managed service ${serviceId} did not become healthy before the linked rotation.`
      )
    }

    cy.wait(1_000).then(() =>
      waitForManagedServiceReadiness(serviceId, remainingAttempts - 1)
    )
  })
}

function waitForBrokerProviderStatusReadiness(
  targetProviderId = 'vault-browser',
  remainingAttempts = 60
) {
  cy.request({
    method: 'GET',
    url: '/api/services/%40secretsbroker/providers/config/status',
    failOnStatusCode: false,
    timeout: 20_000,
  }).then(({ status, body }) => {
    const providers = body?.providers
    if (
      status === 200 &&
      Array.isArray(providers) &&
      providers.some((provider) =>
        provider?.providerId === targetProviderId &&
        provider?.outcome === 'ready' &&
        provider?.operations?.some(
          (operation) =>
            operation?.path === '/v1/providers/migration/apply' &&
            (operation?.maturity === 'validated' ||
              operation?.maturity === 'executable')
        )
      )
    ) {
      return
    }

    if (remainingAttempts <= 1) {
      throw new Error(
        'Broker provider status did not become ready after the linked rotation.'
      )
    }

    cy.wait(1_000).then(() =>
      waitForBrokerProviderStatusReadiness(
        targetProviderId,
        remainingAttempts - 1
      )
    )
  })
}

function waitForBrokerInventoryReadiness(
  targetRef = createdRef,
  remainingAttempts = 60
) {
  cy.request({
    method: 'GET',
    url: '/api/services/%40secretsbroker/secrets/management',
    failOnStatusCode: false,
    timeout: 20_000,
  }).then(({ status, body }) => {
    const records = body?.results
    if (
      status === 200 &&
      Array.isArray(records) &&
      records.some(
        (record) =>
          record?.ref === targetRef &&
          record?.providerKind === 'local-encrypted-store' &&
          record?.outcome === 'ready'
      )
    ) {
      return
    }

    if (remainingAttempts <= 1) {
      throw new Error(
        `Broker inventory did not expose ready local candidate ${targetRef}.`
      )
    }

    cy.wait(1_000).then(() =>
      waitForBrokerInventoryReadiness(targetRef, remainingAttempts - 1)
    )
  })
}

function waitForProviderUiStatusAfterReload({
  targetProviderId = 'vault-browser',
  targetInventoryRef,
  remainingAttempts = 3,
} = {}) {
  waitForBrokerProviderStatusReadiness(targetProviderId)
  if (targetInventoryRef) {
    waitForBrokerInventoryReadiness(targetInventoryRef)
  }
  cy.intercept('GET', '**/providers/config/status').as(
    'providerStatusAfterReload'
  )
  if (targetInventoryRef) {
    cy.intercept('GET', '**/secrets/management*').as(
      'secretsInventoryAfterReload'
    )
  }
  cy.reload()
  cy.contains('Trusted identity verified', { timeout: 20_000 }).should('exist')
  openSecrets()
  return waitForSuccessfulProviderUiStatusResponse(targetProviderId).then(
    (hasTargetProvider) => {
      const inventoryReadiness = targetInventoryRef
        ? waitForSuccessfulInventoryUiResponse(targetInventoryRef)
        : cy.wrap(true, { log: false })

      return inventoryReadiness.then((hasTargetInventoryRecord) => {
        const providerRowReadiness = hasTargetProvider
          ? waitForProviderRowRender(targetProviderId)
          : cy.wrap(false, { log: false })

        return providerRowReadiness.then((hasTargetProviderRow) => {
          if (
            hasTargetProvider &&
            hasTargetInventoryRecord &&
            hasTargetProviderRow
          ) {
            return
          }
          if (remainingAttempts <= 1) {
            throw new Error(
              `Secrets UI metadata did not converge after the bounded reloads (provider=${targetProviderId}, inventory=${targetInventoryRef ?? 'not-required'}).`
            )
          }

          return waitForProviderUiStatusAfterReload({
            targetProviderId,
            targetInventoryRef,
            remainingAttempts: remainingAttempts - 1,
          })
        })
      })
    }
  )
}

function waitForSuccessfulProviderUiStatusResponse(
  targetProviderId,
  remainingAttempts = 5
) {
  return cy
    .wait('@providerStatusAfterReload', { timeout: 20_000 })
    .then(({ response }) => {
      const providers = response?.body?.providers
      const successfulMetadataResponse =
        response?.statusCode === 200 && Array.isArray(providers)
      if (
        successfulMetadataResponse &&
        providers.some(
          (provider) =>
            provider?.providerId === targetProviderId &&
            provider?.outcome === 'ready' &&
            provider?.operations?.some(
              (operation) =>
                operation?.path === '/v1/providers/migration/apply' &&
                (operation?.maturity === 'validated' ||
                  operation?.maturity === 'executable')
            )
        )
      ) {
        return true
      }
      if (successfulMetadataResponse || remainingAttempts <= 1) return false

      return waitForSuccessfulProviderUiStatusResponse(
        targetProviderId,
        remainingAttempts - 1
      )
    })
}

function waitForProviderRowRender(targetProviderId, remainingAttempts = 20) {
  return cy.get('body', { log: false }).then(($body) => {
    const hasTargetProviderRow = Array.from(
      $body[0].querySelectorAll('tr')
    ).some((row) =>
      Array.from(
        row.querySelectorAll('.font-mono.text-xs.text-muted-foreground')
      ).some((metadata) =>
        metadata.textContent?.trim().startsWith(`${targetProviderId} ·`)
      )
    )
    if (hasTargetProviderRow) return true
    if (remainingAttempts <= 1) return false

    return cy
      .wait(250, { log: false })
      .then(() =>
        waitForProviderRowRender(targetProviderId, remainingAttempts - 1)
      )
  })
}

function waitForSuccessfulInventoryUiResponse(
  targetRef,
  remainingAttempts = 5
) {
  return cy
    .wait('@secretsInventoryAfterReload', { timeout: 20_000 })
    .then(({ response }) => {
      const records = response?.body?.results
      const successfulMetadataResponse =
        response?.statusCode === 200 && Array.isArray(records)
      if (
        successfulMetadataResponse &&
        records.some(
          (record) =>
            record?.ref === targetRef &&
            record?.providerKind === 'local-encrypted-store' &&
            record?.outcome === 'ready'
        )
      ) {
        return true
      }
      if (successfulMetadataResponse || remainingAttempts <= 1) return false

      return waitForSuccessfulInventoryUiResponse(
        targetRef,
        remainingAttempts - 1
      )
    })
}

function waitForSuccessfulBrokerTelemetryUiResponse(
  remainingAttempts = 5,
  alias = 'brokerTelemetry',
  privateValues = []
) {
  return cy
    .wait(`@${alias}`, { timeout: 60_000 })
    .then(({ response }) => {
      if (response?.statusCode === 200) {
        expect(response?.body?.safety).to.include({
          lowCardinalityLabels: true,
          valueMaterialIncluded: false,
        })
        assertPrivateMaterialAbsentFromMetadata(
          response.body,
          privateValues,
          'private material is absent from telemetry metadata'
        )
        return
      }
      if (remainingAttempts <= 1) {
        throw new Error(
          'Broker telemetry UI response did not recover within the bounded query retries.'
        )
      }

      return waitForSuccessfulBrokerTelemetryUiResponse(
        remainingAttempts - 1,
        alias,
        privateValues
      )
    })
}

function waitForSuccessfulBrokerEventsUiResponse(
  remainingAttempts = 5,
  alias = 'brokerEvents',
  privateValues = []
) {
  return cy
    .wait(`@${alias}`, { timeout: 60_000 })
    .then(({ response }) => {
      if (response?.statusCode === 200) {
        expect(response?.body?.safety).to.deep.equal({
          metadataOnly: true,
          rawRefIncluded: false,
          valueMaterialIncluded: false,
        })
        assertPrivateMaterialAbsentFromMetadata(
          response.body,
          privateValues,
          'private material is absent from event metadata'
        )
        return
      }
      if (remainingAttempts <= 1) {
        throw new Error(
          'Broker events UI response did not recover within the bounded query retries.'
        )
      }

      return waitForSuccessfulBrokerEventsUiResponse(
        remainingAttempts - 1,
        alias,
        privateValues
      )
    })
}

describe('packaged Service Admin with real Core and Secrets Broker', () => {
  before(() => {
    Cypress.config('screenshotOnRunFailure', false)
  })

  it('completes linked rotation, create, reveal, tombstone recovery, backup, key rotation, and provider validation', () => {
    let committedRotationVersionId
    let rollbackOperationId
    let rollbackExecuteRequests = 0
    let rollbackConsoleLeakDetected = false
    let rollbackOutboundLeakDetected = false
    const rollbackPrivateMaterial = [rollbackCandidate, rollbackReason]

    cy.on('window:before:load', (browserWindow) => {
      installPrivateConsoleGuard(
        browserWindow,
        rollbackPrivateMaterial,
        () => {
          rollbackConsoleLeakDetected = true
        }
      )
    })
    cy.intercept({ url: '**', middleware: true }, (request) => {
      const requestSurface = [request.url, request.body]
      const requestUrl = new URL(request.url)
      const requestPath = decodeURIComponent(requestUrl.pathname)
      const adminOrigin = new URL(Cypress.config('baseUrl')).origin
      const executePath = '/api/secrets/rotation/execute'
      const previewPath =
        '/api/services/@secretsbroker/secrets/rotation/dry-run'
      const isAuthorizedExecute =
        request.method === 'POST' &&
        requestUrl.origin === adminOrigin &&
        requestPath === executePath
      const isAuthorizedPreview =
        request.method === 'POST' &&
        requestUrl.origin === adminOrigin &&
        requestPath === previewPath
      if (
        (containsPrivateMaterial(requestSurface, [rollbackCandidate]) &&
          !isAuthorizedExecute) ||
        (containsPrivateMaterial(requestSurface, [rollbackReason]) &&
          !isAuthorizedExecute &&
          !isAuthorizedPreview)
      ) {
        rollbackOutboundLeakDetected = true
      }
    })

    expect(expectedRef).to.be.a('string').and.not.be.empty
    cy.visit('/services/%40secretsbroker')
    cy.contains('Trusted identity verified', { timeout: 20_000 }).should('exist')
    cy.request({
      method: 'POST',
      url: '/api/services/sample-service/start',
      body: { confirm: false },
      timeout: 120_000,
    }).its('status').should('equal', 200)
    waitForManagedServiceReadiness('sample-service')
    waitForBrokerProviderStatusReadiness()
    cy.visit('/services/%40secretsbroker')
    cy.contains('Secrets Broker', { timeout: 20_000 }).should('be.visible')
    cy.intercept('GET', '**/operations/telemetry').as('brokerTelemetry')
    cy.intercept('GET', '**/operations/events*').as('brokerEvents')
    openSecrets()
    cy.contains('Provider status is unavailable; migration remains disabled.').should(
      'not.exist'
    )
    managedSecretsInventory().contains('tr', 'vault-auth-required').within(() => {
      cy.contains('source_auth_required').should('be.visible')
      cy.contains('metadata').should('exist')
      cy.contains('reveal').should('exist')
    })
    managedSecretsInventory().contains('tr', 'vault-invalid').within(() => {
      cy.contains('invalid_ref').should('be.visible')
      cy.contains('metadata').should('exist')
      cy.contains('reveal').should('exist')
    })

    cy.contains('Operational controls').should('be.visible')
    waitForSuccessfulBrokerTelemetryUiResponse()
    waitForSuccessfulBrokerEventsUiResponse()
    cy.contains('Active lockouts')
      .parent()
      .find('p', { timeout: 20_000 })
      .should('not.contain', '—')
    cy.contains('Local API auth failures')
      .parent()
      .find('p', { timeout: 20_000 })
      .should('not.contain', '—')

    cy.get('#broker-lockout-scope').type(
      'management:browser-release-qualification'
    )
    cy.get('#broker-lockout-reason').type(
      'Release browser audited lockout recovery check'
    )
    cy.get('[aria-label="Confirm this exact audited lockout clear"]').click()
    cy.intercept('POST', '**/secrets/lockouts/clear').as('clearLockout')
    cy.contains('button', 'Clear exact lockout').click()
    cy.wait('@clearLockout', { timeout: 60_000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200)
      expect(response?.body).to.include({
        operation: 'lockout_clear',
        outcome: 'not_found',
        cleared: false,
        auditStatus: 'audit_recorded',
      })
    })
    cy.contains('audited check completed safely', { timeout: 20_000 }).should(
      'be.visible'
    )
    cy.get('#broker-event-family').select('lockout_cleared')
    cy.wait('@brokerEvents', { timeout: 60_000 })
    cy.contains('td', 'lockout_clear', { timeout: 20_000 }).should('be.visible')
    cy.get('#broker-event-family').select('all')

    cy.contains('tr', expectedRef, { timeout: 20_000 }).within(() => {
      cy.contains('button', /^Rotate\b/).click()
    })
    dialog('Rotate secret').within(() => {
      cy.get('#secret-rotation-reason').type(
        'Release browser linked consumer qualification'
      )
      cy.get('#secret-rotation-value').type(rotationCandidate)
      cy.contains('button', 'Preview rotation').click()
      cy.contains('Linked consumers', { timeout: 20_000 }).should('be.visible')
      cy.contains('Core orchestrated').should('be.visible')
      cy.contains('sample-service').should('be.visible')
      cy.contains('restart').should('be.visible')
      cy.get('[aria-label="Confirm secret rotation transition"]').click()
      cy.intercept('POST', '**/api/secrets/rotation/execute').as(
        'executeLinkedRotation'
      )
      cy.contains('button', 'Rotate and converge consumers').click()
      cy.wait('@executeLinkedRotation', { timeout: 120_000 }).then(
        ({ response }) => {
          const safeRotationFailure = {
            status: response?.statusCode,
            outcome: response?.body?.operation?.outcome,
            phase: response?.body?.operation?.phase,
            failureCode: response?.body?.operation?.failureCode,
            code:
              typeof response?.body?.error === 'string' &&
              /^[a-z0-9_]{1,64}$/i.test(response.body.error)
                ? response.body.error
                : response?.body?.code,
          }
          expect(
            response?.statusCode,
            JSON.stringify(safeRotationFailure)
          ).to.equal(200)
          expect(response?.body?.operation?.outcome).to.equal('committed')
          committedRotationVersionId =
            response?.body?.operation?.activeVersionId
          expect(committedRotationVersionId).to.match(/^[A-Za-z0-9._-]{1,128}$/)
          expect(response?.body?.operation?.completedOperations).to.have.length(
            1
          )
        }
      )
      cy.contains('Core rotation committed', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.contains('1 consumer actions completed').should('be.visible')
      cy.get('#secret-rotation-value').should('not.exist')
      cy.contains('button', 'Close').click()
    })
    waitForManagedServiceReadiness('sample-service')
    waitForBrokerProviderStatusReadiness()
    cy.reload()
    cy.contains('Trusted identity verified', { timeout: 20_000 }).should('exist')
    cy.contains('Secrets Broker', { timeout: 20_000 }).should('be.visible')
    openSecrets()

    cy.contains('tr', expectedRef, { timeout: 20_000 }).within(() => {
      cy.contains('button', /^Rotate\b/).click()
    })
    dialog('Rotate secret').within(() => {
      cy.get('#secret-rotation-reason').type(rollbackReason)
      cy.get('#secret-rotation-value').type(rollbackCandidate, { log: false })
      cy.contains('button', 'Preview rotation').click()
      cy.contains('Linked consumers', { timeout: 20_000 }).should('be.visible')
      cy.contains('Core orchestrated').should('be.visible')
      cy.contains('sample-service').should('be.visible')
      cy.contains('Restart service').should('be.visible')
      cy.get('[aria-label="Confirm secret rotation transition"]').click()
      cy.env(['testControlUrl']).then(({ testControlUrl: controlUrl }) => {
        expect(controlUrl).to.match(
          /^http:\/\/127\.0\.0\.1:\d+\/__service_lasso_test$/
        )
        cy.request({
          method: 'POST',
          url: `${controlUrl}/fail-next-sample-start`,
          failOnStatusCode: false,
        }).then(({ status, body }) => {
          expect(status).to.equal(200)
          expect(body).to.deep.equal({
            outcome: 'sample_start_failure_armed',
          })
        })
      })
      cy.intercept(
        'POST',
        '**/api/secrets/rotation/execute',
        (request) => {
          rollbackExecuteRequests += 1
          request.continue()
        }
      ).as('executeRollbackRotation')
      cy.contains('button', 'Rotate and converge consumers').click()
      cy.wait('@executeRollbackRotation', { timeout: 120_000 }).then(
        ({ request, response }) => {
          rollbackOperationId = request.body?.operationId
          const operation = response?.body?.operation
          const safeRollbackResult = {
            status: response?.statusCode,
            operationId: operation?.operationId,
            outcome: operation?.outcome,
            phase: operation?.phase,
            failureCode: operation?.failureCode,
            activeVersionId: operation?.activeVersionId,
            previousVersionId: operation?.previousVersionId,
            stagedVersionId: operation?.stagedVersionId,
            rollbackCompletedOperations:
              operation?.rollbackCompletedOperations,
          }
          expect(
            safeRollbackResult,
            JSON.stringify(safeRollbackResult)
          ).to.deep.include({
            status: 200,
            operationId: rollbackOperationId,
            outcome: 'rolled_back',
            phase: 'rolled_back',
            failureCode: 'rotation_consumer_not_ready',
            activeVersionId: committedRotationVersionId,
            previousVersionId: committedRotationVersionId,
          })
          expect(rollbackOperationId).to.match(
            /^serviceadmin-rotate-[A-Za-z0-9._-]+$/
          )
          expect(operation?.stagedVersionId).to.match(
            /^[A-Za-z0-9._-]{1,128}$/
          )
          expect(operation?.stagedVersionId).not.to.equal(
            committedRotationVersionId
          )
          expect(operation?.rollbackCompletedOperations).to.deep.equal([
            'sample-service:restart:',
          ])
        }
      )
      cy.contains('Core rotation rolled_back', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.contains('Phase rolled_back').should('be.visible')
      cy.contains('1 rollback actions completed').should('be.visible')
      cy.contains('Safe failure code:').parent().within(() => {
        cy.contains('rotation_consumer_not_ready').should('be.visible')
      })
      cy.contains(
        'Inspect the failed consumer, correct readiness, then request a fresh impact plan.'
      ).should('be.visible')
      cy.get('#secret-rotation-value').should('not.exist')
    })
    waitForManagedServiceReadiness('sample-service')
    cy.intercept('GET', '**/api/secrets/rotation/operations/*').as(
      'rehydrateRollbackRotation'
    )
    cy.intercept('GET', '**/operations/telemetry').as(
      'rollbackTelemetryAfterReload'
    )
    cy.intercept('GET', '**/operations/events*').as(
      'rollbackEventsAfterReload'
    )
    cy.reload()
    cy.wait('@rehydrateRollbackRotation', { timeout: 60_000 }).then(
      ({ request, response }) => {
        expect(request.url).to.include(
          `/api/secrets/rotation/operations/${rollbackOperationId}`
        )
        expect(response?.statusCode).to.equal(200)
        const operation = response?.body?.operation
        const safeRollbackRehydration = {
          operationId: operation?.operationId,
          outcome: operation?.outcome,
          phase: operation?.phase,
          failureCode: operation?.failureCode,
          activeVersionId: operation?.activeVersionId,
          previousVersionId: operation?.previousVersionId,
          rollbackCompletedOperations:
            operation?.rollbackCompletedOperations,
        }
        expect(
          safeRollbackRehydration,
          JSON.stringify(safeRollbackRehydration)
        ).to.deep.equal({
          operationId: rollbackOperationId,
          outcome: 'rolled_back',
          phase: 'rolled_back',
          failureCode: 'rotation_consumer_not_ready',
          activeVersionId: committedRotationVersionId,
          previousVersionId: committedRotationVersionId,
          rollbackCompletedOperations: ['sample-service:restart:'],
        })
      }
    )
    waitForSuccessfulBrokerTelemetryUiResponse(
      5,
      'rollbackTelemetryAfterReload',
      rollbackPrivateMaterial
    )
    waitForSuccessfulBrokerEventsUiResponse(
      5,
      'rollbackEventsAfterReload',
      rollbackPrivateMaterial
    )
    dialog('Rotate secret').within(() => {
      cy.contains('Core rotation rolled_back', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.contains('sample-service').should('be.visible')
      cy.contains('running · healthy', { timeout: 20_000 }).should('be.visible')
      cy.contains(committedRotationVersionId).should('be.visible')
      cy.contains('rotation_consumer_not_ready').should('be.visible')
      cy.contains('button', 'Close').scrollIntoView().click()
    })
    cy.then(() => {
      expect(rollbackExecuteRequests).to.equal(1)
      expect(
        rollbackConsoleLeakDetected,
        'private rollback material is absent from browser console records'
      ).to.equal(false)
      expect(
        rollbackOutboundLeakDetected,
        'private rollback material is sent only to authorized rotation endpoints'
      ).to.equal(false)
    })
    assertSecretValuesAbsentFromBrowser([rollbackCandidate])

    cy.contains('button', /^Create secret$/).click()
    dialog('Create local secret').within(() => {
      cy.get('#secret-create-ref').type(
        'services/sample-service/browser.CREATED_TOKEN'
      )
      cy.get('#secret-create-reason').type('Release browser qualification')
      cy.contains('button', 'Preview create').click()
      cy.contains('Signed plan ready', { timeout: 20_000 }).should('be.visible')
      cy.get('[aria-label="Confirm secret create"]').click()
      cy.intercept('POST', '**/secrets/create/apply').as('applySecretCreate')
      cy.contains('button', /^Create secret$/).click()
      cy.wait('@applySecretCreate', { timeout: 60_000 }).then(
        ({ response }) => {
          expect(response?.statusCode).to.equal(200)
          expect(response?.body).to.include({
            operation: 'create',
            mode: 'apply',
            outcome: 'applied',
            applied: true,
            auditStatus: 'audit_recorded',
          })
        }
      )
      cy.contains('Secret created and audit recorded', { timeout: 60_000 }).should(
        'be.visible'
      )
      cy.get('#secret-create-value').should('not.exist')
      cy.contains('button', 'Close').click()
    })
    cy.contains('tr', 'services/sample-service/browser.CREATED_TOKEN', {
      timeout: 20_000,
    })
      .scrollIntoView()
      .should('be.visible')

    cy.get('#secret-inventory-search').type('browser.CREATED_TOKEN')
    cy.contains('tr', 'services/sample-service/browser.CREATED_TOKEN', {
      timeout: 20_000,
    }).should('be.visible')
    cy.contains('tr', expectedRef).should('not.exist')
    cy.get('#secret-inventory-search').clear()
    cy.contains('tr', expectedRef, { timeout: 20_000 }).should('be.visible')
    cy.get('#secret-inventory-provider option')
      .eq(1)
      .invoke('val')
      .then((provider) => {
        expect(provider).to.be.a('string').and.not.be.empty
        cy.get('#secret-inventory-provider').select(provider)
      })
    cy.get('table tbody tr').should('have.length.at.least', 1)
    cy.get('#secret-inventory-provider').select('all')
    cy.get('#secret-inventory-outcome').select('ready')
    cy.contains('2 results', { timeout: 20_000 }).should('be.visible')
    cy.get('#secret-inventory-page-size').select('1')
    cy.contains('2 results · page 1 of 2').should('be.visible')
    cy.get('[aria-label="Next secrets page"]').click()
    cy.contains('2 results · page 2 of 2').should('be.visible')
    cy.contains('tr', expectedRef).should('be.visible')
    cy.get('[aria-label="Previous secrets page"]').click()
    cy.contains('2 results · page 1 of 2').should('be.visible')
    cy.get('#secret-inventory-page-size').select('5')

    cy.contains('tr', 'services/sample-service/browser.CREATED_TOKEN', {
      timeout: 20_000,
    }).within(() => {
      cy.contains('button', /^Edit\b/).click()
    })
    dialog('Edit secret').within(() => {
      cy.get('#secret-mutation-reason').type('Release browser qualification')
      cy.get('#secret-replacement-value').type(editedCandidate)
      cy.contains('button', 'Preview mutation').click()
      cy.contains('Dry run ready', { timeout: 20_000 }).should('be.visible')
      cy.get('[aria-label="Confirm secret mutation"]').click()
      cy.intercept('POST', '**/secrets/edit/apply').as('applySecretEdit')
      cy.contains('button', 'Apply mutation').click()
      cy.wait('@applySecretEdit', { timeout: 60_000 }).then(({ response }) => {
        expect(response?.statusCode).to.equal(200)
        expect(response?.body).to.include({
          operation: 'edit',
          mode: 'apply',
          outcome: 'applied',
          applied: true,
          auditStatus: 'audit_recorded',
        })
      })
      cy.contains('Mutation applied and audit recorded', {
        timeout: 60_000,
      }).should('be.visible')
      cy.get('#secret-replacement-value').should('have.value', '')
      cy.contains('button', 'Close').click()
    })

    restartBrokerAndOpenSecrets()
    cy.contains('tr', createdRef, { timeout: 20_000 }).within(() => {
      cy.contains('button', /^Reveal\b/).click()
    })
    dialog('Reveal secret').within(() => {
      cy.get('#secret-reveal-reason').type('Release browser qualification')
      cy.get('[aria-label="Confirm secret reveal"]').click()
      cy.intercept('POST', '**/secrets/reveal').as('revealPersistedEdit')
      cy.contains('button', 'Reveal value').click()
      cy.wait('@revealPersistedEdit', {
        timeout: 60_000,
        log: false,
      }).then(
        ({ response }) => {
          expect(response?.statusCode).to.equal(200)
          expect(
            response?.body?.value === editedCandidate,
            'edited value persisted across Broker restart'
          ).to.equal(true)
        }
      )
      cy.get('[data-testid="secret-reveal-value"]', {
        timeout: 20_000,
        log: false,
      }).should('be.visible')
      cy.contains('button', 'Clear reveal').click()
      cy.get('[data-testid="secret-reveal-value"]').should('not.exist')
      cy.contains('button', 'Close').click()
    })

    cy.contains('tr', 'services/sample-service/browser.CREATED_TOKEN', {
      timeout: 20_000,
    }).within(() => {
      cy.contains('button', /^Reset\b/).click()
    })
    dialog('Reset secret').within(() => {
      cy.get('#secret-mutation-reason').type('Release browser qualification')
      cy.get('#secret-replacement-value').type(resetCandidate)
      cy.contains('button', 'Preview mutation').click()
      cy.contains('Dry run ready', { timeout: 20_000 }).should('be.visible')
      cy.get('[aria-label="Confirm secret mutation"]').click()
      cy.intercept('POST', '**/secrets/reset/apply').as('applySecretReset')
      cy.contains('button', 'Apply mutation').click()
      cy.wait('@applySecretReset', { timeout: 60_000 }).then(({ response }) => {
        expect(response?.statusCode).to.equal(200)
        expect(response?.body).to.include({
          operation: 'reset',
          mode: 'apply',
          outcome: 'applied',
          applied: true,
          auditStatus: 'audit_recorded',
        })
      })
      cy.contains('Mutation applied and audit recorded', {
        timeout: 60_000,
      }).should('be.visible')
      cy.get('#secret-replacement-value').should('have.value', '')
      cy.contains('button', 'Close').click()
    })

    restartBrokerAndOpenSecrets()
    cy.contains('tr', createdRef, { timeout: 20_000 }).within(() => {
      cy.contains('button', /^Reveal\b/).click()
    })
    dialog('Reveal secret').within(() => {
      cy.get('#secret-reveal-reason').type('Release browser qualification')
      cy.get('[aria-label="Confirm secret reveal"]').click()
      cy.intercept('POST', '**/secrets/reveal').as('revealPersistedReset')
      cy.contains('button', 'Reveal value').click()
      cy.wait('@revealPersistedReset', {
        timeout: 60_000,
        log: false,
      }).then(
        ({ response }) => {
          expect(response?.statusCode).to.equal(200)
          expect(
            response?.body?.value === resetCandidate,
            'reset value persisted across Broker restart'
          ).to.equal(true)
          expect(response?.body?.ttlSeconds).to.be.within(1, 300)
          cy.wrap(response.body.ttlSeconds, { log: false }).as('revealTtl')
        }
      )
      cy.get('[data-testid="secret-reveal-value"]', {
        timeout: 20_000,
        log: false,
      }).should('be.visible')
      cy.contains('Expires in').should('be.visible')
      cy.get('@revealTtl', { log: false }).then((ttlSeconds) => {
        cy.get('[data-testid="secret-reveal-value"]', {
          timeout: (ttlSeconds + 5) * 1000,
          log: false,
        }).should('not.exist')
      })
      cy.contains('button', 'Close').click()
    })
    assertSecretValuesAbsentFromBrowser([editedCandidate, resetCandidate])

    cy.contains('tr', 'services/sample-service/browser.CREATED_TOKEN', {
      timeout: 20_000,
    }).within(() => {
      cy.intercept('POST', '**/secrets/policy/preview').as('policyPreview')
      cy.contains('button', /^Policy\b/).click()
    })
    cy.wait('@policyPreview', { timeout: 60_000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200)
      expect(response?.body).to.include({
        outcome: 'unsupported',
        applied: false,
        unsupportedCapability: 'policy_binding_persistence',
      })
    })
    dialog('Secret policy status').within(() => {
      cy.contains('Policy apply unavailable', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.contains('planning only').should('be.visible')
      cy.contains('button', 'Apply policy').should('be.disabled')
      cy.contains('button', 'Close').click()
    })

    waitForProviderUiStatusAfterReload()
    cy.contains('tr', expectedRef, { timeout: 20_000 }).within(() => {
      cy.get('td')
        .eq(2)
        .invoke('text')
        .then((outcome) => {
          expect(outcome.trim()).to.equal('ready')
        })
      cy.contains('button', /^Migrate\b/, { timeout: 20_000 })
        .should('not.be.disabled')
        .click()
    })
    dialog('Migrate secret provider').within(() => {
      cy.get('#migration-target-provider').select('vault-browser')
      cy.get('#migration-audit-reason').type(
        'Release browser verified Vault migration'
      )
      cy.intercept('POST', '**/providers/migration/dry-run').as(
        'migrationPreview'
      )
      cy.contains('button', 'Preview migration').click()
      cy.wait('@migrationPreview', { timeout: 60_000 }).then(({ response }) => {
        expect(response?.statusCode).to.equal(200)
        expect(response?.body).to.include({
          outcome: 'dry_run_ready',
          applied: false,
          auditStatus: 'audit_recorded',
        })
      })
      cy.contains('Migration dry run ready', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.contains('write_value_to_remote_provider_after_revalidation').should(
        'be.visible'
      )
      cy.get('[aria-label="Confirm provider migration"]').click()
      cy.intercept('POST', '**/providers/migration/apply').as(
        'migrationApply'
      )
      cy.contains('button', 'Apply migration').click()
      cy.wait('@migrationApply', { timeout: 60_000 }).then(({ response }) => {
        expect(response?.statusCode).to.equal(200)
        expect(response?.body).to.include({
          outcome: 'applied',
          applied: true,
          auditStatus: 'audit_recorded',
        })
        expect(response?.body?.results?.[0]).to.include({
          outcome: 'migrated',
          verified: true,
        })
      })
      cy.contains('Migration outcome: applied', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.contains(`${expectedRef}: migrated`).should('be.visible')
      cy.contains('button', 'Close').click()
    })
    dialog('Migrate secret provider').should('not.exist')
    cy.get('[data-slot="dialog-overlay"]').should('not.exist')

    cy.contains('tr', expectedRef, { timeout: 20_000 }).within(() => {
      cy.contains('button', /^Migrate\b/).click()
    })
    dialog('Migrate secret provider').within(() => {
      cy.get('#migration-target-provider').select('vault-policy-denied')
      cy.get('#migration-audit-reason').type(
        'Release browser remote policy denial qualification'
      )
      cy.intercept('POST', '**/providers/migration/dry-run').as(
        'policyDeniedMigrationPreview'
      )
      cy.contains('button', 'Preview migration').click()
      cy.wait('@policyDeniedMigrationPreview', { timeout: 60_000 }).then(
        ({ response }) => {
          expect(response?.statusCode).to.equal(200)
          expect(response?.body).to.include({
            outcome: 'dry_run_ready',
            applied: false,
            auditStatus: 'audit_recorded',
          })
        }
      )
      cy.contains('Migration dry run ready', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.get('[aria-label="Confirm provider migration"]').click()
      cy.intercept('POST', '**/providers/migration/apply').as(
        'policyDeniedMigration'
      )
      cy.contains('button', 'Apply migration').click()
      cy.wait('@policyDeniedMigration', { timeout: 60_000 }).then(
        ({ response }) => {
          expect(response?.statusCode).to.equal(200)
          expect(response?.body).to.include({
            outcome: 'partial_failure',
            applied: false,
            auditStatus: 'audit_recorded',
          })
          expect(response?.body?.results?.[0]).to.include({
            outcome: 'policy_denied',
            verified: false,
          })
        }
      )
      cy.get('[data-testid="migration-terminal-outcome"]')
        .should('have.attr', 'data-outcome', 'partial_failure')
        .and('have.class', 'text-destructive')
      cy.contains('policy_denied').should('be.visible')
      cy.contains('source remains authoritative').should('be.visible')
      cy.contains('button', 'Close').click()
    })

    waitForProviderUiStatusAfterReload()
    cy.contains('tr', expectedRef, { timeout: 20_000 }).within(() => {
      cy.contains('button', /^Migrate\b/).click()
    })
    dialog('Migrate secret provider').within(() => {
      cy.get('#migration-target-provider').select('vault-unavailable')
      cy.get('#migration-audit-reason').type(
        'Release browser unavailable remote provider qualification'
      )
      cy.intercept('POST', '**/providers/migration/dry-run').as(
        'unavailableMigrationPreview'
      )
      cy.contains('button', 'Preview migration').click()
      cy.wait('@unavailableMigrationPreview', { timeout: 60_000 }).then(
        ({ response }) => {
          expect(response?.statusCode).to.equal(200)
          expect(response?.body).to.include({
            outcome: 'dry_run_ready',
            applied: false,
            auditStatus: 'audit_recorded',
          })
        }
      )
      cy.contains('Migration dry run ready', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.get('[aria-label="Confirm provider migration"]').click()
      cy.intercept('POST', '**/providers/migration/apply').as(
        'unavailableMigration'
      )
      cy.contains('button', 'Apply migration').click()
      cy.wait('@unavailableMigration', { timeout: 60_000 }).then(
        ({ response }) => {
          expect(response?.statusCode).to.equal(200)
          expect(response?.body).to.include({
            outcome: 'partial_failure',
            applied: false,
            auditStatus: 'audit_recorded',
          })
          expect(response?.body?.results?.[0]).to.include({
            outcome: 'source_unavailable',
            verified: false,
          })
        }
      )
      cy.get('[data-testid="migration-terminal-outcome"]')
        .should('have.attr', 'data-outcome', 'partial_failure')
        .and('have.class', 'text-destructive')
      cy.contains('source_unavailable').should('be.visible')
      cy.contains('button', 'Close').click()
    })

    waitForProviderUiStatusAfterReload({ targetInventoryRef: expectedRef })
    cy.contains('tr', expectedRef, { timeout: 20_000 }).within(() => {
      cy.get('td').eq(1).should('contain.text', 'local-encrypted-store')
      cy.get('td')
        .eq(2)
        .invoke('text')
        .then((outcome) => {
          expect(outcome.trim()).to.equal('ready')
        })
    })
    cy.contains('button', 'Bulk provider migration', { timeout: 20_000 })
      .should('not.be.disabled')
      .click({ waitForAnimations: false })
    dialog('Bulk provider migration').within(() => {
      cy.get('#bulk-migration-target-provider').select('vault-browser')
      cy.get(
        '[aria-label="Select services/sample-service/sample.GENERATED_TOKEN for bulk migration"]'
      ).click()
      cy.get('#bulk-migration-audit-reason').type(
        'Release browser verified bulk Vault migration'
      )
      cy.intercept('POST', '**/secrets/campaigns/create').as(
        'createBulkMigrationCampaign'
      )
      cy.intercept('POST', '**/secrets/campaigns/revalidate').as(
        'revalidateBulkMigrationCampaign'
      )
      cy.contains('button', 'Create and revalidate campaign').click()
      cy.wait('@createBulkMigrationCampaign', { timeout: 60_000 }).then(
        ({ response }) => {
          expect(response?.statusCode).to.equal(200)
          expect(response?.body).to.include({
            outcome: 'dry_run_ready',
            applied: false,
            requiresRevalidation: true,
            auditStatus: 'audit_recorded',
          })
        }
      )
      cy.wait('@revalidateBulkMigrationCampaign', { timeout: 60_000 }).then(
        ({ response }) => {
          expect(response?.statusCode).to.equal(200)
          expect(response?.body).to.include({
            outcome: 'dry_run_ready',
            applied: false,
            requiresRevalidation: false,
            auditStatus: 'audit_recorded',
          })
        }
      )
      cy.contains('Durable campaign ready', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.contains('concurrency 1').should('be.visible')
      cy.contains('stop_and_defer_remaining').should('exist')
      cy.intercept('POST', '**/secrets/campaigns/apply').as(
        'applyBulkMigrationCampaign'
      )
      cy.get('[aria-label="Confirm exact bulk migration campaign"]').click()
      cy.contains('button', 'Apply exact campaign').click()
      cy.wait('@applyBulkMigrationCampaign', { timeout: 60_000 }).then(
        ({ response }) => {
          expect(response?.statusCode).to.equal(200)
          expect(response?.body).to.include({
            outcome: 'applied',
            applied: true,
            requiresRevalidation: false,
            auditStatus: 'audit_recorded',
          })
          expect(response?.body?.results?.[0]).to.include({
            ref: expectedRef,
            outcome: 'migrated',
            applied: true,
            verified: true,
          })
        }
      )
      cy.contains('Campaign outcome: applied', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.contains('1 verified').should('be.visible')
      cy.contains(`${expectedRef}: migrated`).should('be.visible')
      cy.contains('button', 'Close').click()
    })

    cy.contains('tr', 'services/sample-service/browser.CREATED_TOKEN', {
      timeout: 20_000,
    }).within(() => {
      cy.contains('button', /^Reveal\b/).click()
    })
    dialog('Reveal secret').within(() => {
      cy.get('#secret-reveal-reason').type('Release browser qualification')
      cy.get('[aria-label="Confirm secret reveal"]').click()
      cy.contains('button', 'Reveal value').click()
      cy.get('[data-testid="secret-reveal-value"]', { timeout: 20_000 }).should(
        ($value) => {
          expect($value.text().trim().length).to.be.greaterThan(20)
        }
      )
      cy.contains('Expires in').should('be.visible')
      cy.contains('button', 'Clear reveal').click()
      cy.get('[data-testid="secret-reveal-value"]').should('not.exist')
      cy.contains('button', 'Close').click()
    })

    cy.contains('tr', 'services/sample-service/browser.CREATED_TOKEN', {
      timeout: 20_000,
    }).within(() => {
      cy.contains('button', /^Decommission\b/).click()
    })
    dialog('Decommission secret').within(() => {
      cy.contains('button', 'Check dependencies').click()
      cy.contains('Signed plan ready', { timeout: 20_000 }).should('be.visible')
      cy.get('#secret-decommission-reason').type('Release browser qualification')
      cy.get('[aria-label="Confirm secret decommission"]').click()
      cy.contains('button', /^Decommission secret$/).click()
      cy.contains('encrypted tombstone is recoverable', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.contains('button', 'Close').click()
    })

    waitForBrokerProviderStatusReadiness()
    cy.reload()
    cy.contains('Trusted identity verified', { timeout: 20_000 }).should('exist')
    openSecrets()
    cy.contains('tr', 'services/sample-service/browser.CREATED_TOKEN', {
      timeout: 20_000,
    }).within(() => {
      cy.contains('button', /^Restore\b/).click()
    })
    dialog('Restore secret').within(() => {
      cy.get('#secret-decommission-reason').type('Release browser qualification')
      cy.get('[aria-label="Confirm secret restore"]').click()
      cy.intercept('POST', '**/secrets/decommission/restore').as(
        'restoreSecretDecommission'
      )
      cy.contains('button', /^Restore secret$/).click()
      cy.wait('@restoreSecretDecommission', { timeout: 60_000 }).then(
        ({ response }) => {
          expect(response?.statusCode).to.equal(200)
          expect(response?.body).to.include({
            outcome: 'applied',
            applied: true,
            auditStatus: 'audit_recorded',
          })
          expect(response?.body?.tombstone?.state).to.equal('restored')
        }
      )
      cy.contains('Secret restored and audit recorded', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.contains('button', 'Close').click()
    })

    cy.get('#broker-lifecycle-reason').type('Release browser qualification')
    cy.intercept('POST', '**/lifecycle/backups/create').as(
      'createVerifiedBackup'
    )
    cy.contains('button', 'Create encrypted backup').click()
    waitForVerifiedBackupCreation('createVerifiedBackup')
    cy.contains(/created and verified/i, {
      timeout: 20_000,
    }).should('be.visible')
    cy.contains('tr', 'verified').within(() => {
      cy.contains('button', 'Verify').click()
    })
    cy.contains('passed integrity verification', { timeout: 20_000 }).should(
      'be.visible'
    )
    cy.contains('tr', 'verified').within(() => {
      cy.contains('button', 'Restore').click()
    })
    dialog('Restore encrypted Broker backup').within(() => {
      cy.contains('Plan: ready', { timeout: 20_000 }).should('be.visible')
      cy.get('[aria-label="Confirm exact Broker restore"]').click()
      cy.contains('button', 'Apply exact restore').click()
    })
    cy.contains('restored. Restart verification is required', {
      timeout: 20_000,
    }).should('be.visible')

    cy.env(['qualificationPlatform']).then(({ qualificationPlatform }) => {
      if (qualificationPlatform === 'win32') {
        cy.intercept('POST', '**/lifecycle/key/rotate').as('rotateMasterKey')
        cy.contains('button', 'Rotate master key').click()
        dialog('Rotate Broker master key').within(() => {
          cy.get('[aria-label="Confirm Broker master key rotation"]').click()
          cy.contains('button', 'Rotate and rewrap').click()
        })
        cy.wait('@rotateMasterKey', { timeout: 60_000 }).then(({ response }) => {
          const safeRotationResult = {
            status: response?.statusCode,
            outcome: response?.body?.outcome,
            applied: response?.body?.applied,
            requiresConfirmation: response?.body?.requiresConfirmation,
            auditStatus: response?.body?.auditStatus,
            nextAction: response?.body?.nextAction,
            error:
              typeof response?.body?.error === 'string' &&
              /^[a-z0-9_]{1,64}$/i.test(response.body.error)
                ? response.body.error
                : undefined,
          }
          expect(response?.statusCode, JSON.stringify(safeRotationResult)).to.equal(
            200
          )
          expect(response?.body, JSON.stringify(safeRotationResult)).to.include({
            outcome: 'ready',
            applied: true,
            requiresConfirmation: false,
            auditStatus: 'audit_recorded',
          })
          expect(response?.body?.newKeyId).to.match(/^mk-[a-f0-9]{12,64}$/)
        })
        cy.contains(
          /Master key rotated to .*Create and verify a new backup now/i,
          { timeout: 20_000 }
        ).should('be.visible')
        cy.get('#broker-lifecycle-reason')
          .clear()
          .type('Post-rotation qualification')
        cy.intercept('POST', '**/lifecycle/backups/create').as(
          'createVerifiedPostRotationBackup'
        )
        cy.contains('button', 'Create encrypted backup').click()
        waitForVerifiedBackupCreation('createVerifiedPostRotationBackup')
        cy.contains(/created and verified/i, {
          timeout: 20_000,
        }).should('be.visible')
        waitForProviderUiStatusAfterReload()
      } else {
        cy.contains('button', 'Rotate master key').should('be.disabled')
        cy.contains(
          'Master-key rotation requires a ready OS-backed local wrapper.'
        ).should('be.visible')
        cy.contains('portable key injection').should('be.visible')
      }
    })

    cy.contains('Provider status is unavailable; migration remains disabled.').should(
      'not.exist'
    )
    cy.contains('tr', 'vault-browser', { timeout: 20_000 }).within(() => {
      cy.contains('ready').should('be.visible')
      cy.contains('button', 'Validate configuration')
        .scrollIntoView()
        .should('be.visible')
        .and('not.be.disabled')
        .click()
    })
    dialog('Validate provider configuration').within(() => {
      cy.get('#provider-validation-reason').type(
        'Release browser qualification'
      )
      cy.contains('button', 'Validate through Broker').click()
      cy.contains('Validation outcome: ready', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.contains('Review provider capability metadata').should('be.visible')
      cy.contains('button', 'Close').click()
    })

    cy.request({
      method: 'POST',
      url: '/api/services/%40secretsbroker/restart',
      body: { confirm: true },
      timeout: 120_000,
    }).its('status').should('equal', 200)
    cy.reload()
    cy.contains('Trusted identity verified', { timeout: 20_000 }).should('exist')
    openSecrets()
    cy.contains('tr', expectedRef, { timeout: 20_000 }).should('be.visible')
    cy.contains('tr', 'services/sample-service/browser.CREATED_TOKEN').should(
      'be.visible'
    )
    cy.contains('Master key').parent().contains('Available').should('be.visible')
    cy.env(['qualificationPlatform']).then(({ qualificationPlatform }) => {
      if (qualificationPlatform === 'win32') {
        cy.contains('Local wrapper')
          .parent()
          .should('not.contain', 'unavailable')
      }
    })
    cy.contains('tr', 'verified').should('be.visible')
    cy.contains('[data-slot="card"]', 'Operational controls').within(() => {
      cy.contains('button', 'Next').should('not.be.disabled').click()
      cy.contains('button', 'Previous').should('not.be.disabled')
      cy.get('tbody tr').should('have.length.at.least', 1)
    })

    cy.env(['testControlUrl', 'qualificationPlatform']).then(
      ({ testControlUrl: controlUrl, qualificationPlatform }) => {
        if (qualificationPlatform !== 'win32') return
      expect(controlUrl).to.match(
        /^http:\/\/127\.0\.0\.1:\d+\/__service_lasso_test$/
      )
      cy.request({
        method: 'POST',
        url: '/api/services/%40secretsbroker/stop',
        body: { confirm: true },
        timeout: 120_000,
      })
        .its('status')
        .should('equal', 200)
      cy.request('POST', `${controlUrl}/lock-wrapper`).then(({ body }) => {
        expect(body).to.deep.equal({ outcome: 'locked_fixture_ready' })
      })
      cy.request({
        method: 'POST',
        url: '/api/services/%40secretsbroker/start',
        body: { confirm: false },
        timeout: 120_000,
      })
        .its('status')
        .should('equal', 200)
      cy.reload()
      cy.contains('Trusted identity verified', { timeout: 20_000 }).should(
        'exist'
      )
      cy.contains('[role="tab"]', /^Secrets\b/, { timeout: 20_000 }).click()
      cy.contains('Master key', { timeout: 30_000 })
        .parent()
        .contains('Locked', { timeout: 30_000 })
        .should('be.visible')
      cy.get('[data-testid="secret-reveal-value"]').should('not.exist')
      cy.get('input[type="password"]').should('not.exist')
      cy.request({
        method: 'POST',
        url: '/api/services/%40secretsbroker/stop',
        body: { confirm: true },
        timeout: 120_000,
      })
        .its('status')
        .should('equal', 200)
      cy.request('POST', `${controlUrl}/unlock-wrapper`).then(({ body }) => {
        expect(body).to.deep.equal({ outcome: 'wrapper_restored' })
      })
      cy.request({
        method: 'POST',
        url: '/api/services/%40secretsbroker/start',
        body: { confirm: false },
        timeout: 120_000,
      })
        .its('status')
        .should('equal', 200)
      cy.reload()
      cy.contains('Trusted identity verified', { timeout: 20_000 }).should(
        'exist'
      )
      openSecrets()
      cy.contains('Master key', { timeout: 30_000 })
        .parent()
        .contains('Available', { timeout: 30_000 })
        .should('be.visible')
      }
    )

    cy.request({
      method: 'POST',
      url: '/api/services/%40secretsbroker/stop',
      body: { confirm: true },
      timeout: 120_000,
    }).its('status').should('equal', 200)
    cy.reload()
    cy.contains('Trusted identity verified', { timeout: 20_000 }).should('exist')
    cy.contains('[role="tab"]', /^Secrets\b/, { timeout: 20_000 }).click()
    cy.contains('Secrets Broker management is unavailable.', {
      timeout: 30_000,
    }).should('be.visible')
    cy.contains('button', 'Retry inventory').should('be.visible')
    cy.request({
      method: 'POST',
      url: '/api/services/%40secretsbroker/start',
      body: { confirm: false },
      timeout: 120_000,
    }).its('status').should('equal', 200)
    cy.contains('button', 'Retry inventory').click()
    cy.contains(expectedRef, { timeout: 30_000 }).should('be.visible')

    cy.get('[data-testid="secret-reveal-value"]').should('not.exist')
    cy.get('input[type="password"]').should('not.exist')
    cy.contains(/error boundary|uncaught error|failed to load/i).should('not.exist')
    assertSecretValuesAbsentFromBrowser([
      rotationCandidate,
      editedCandidate,
      resetCandidate,
    ])
  })
})
