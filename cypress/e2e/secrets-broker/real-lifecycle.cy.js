const expectedRef = 'services/sample-service/sample.GENERATED_TOKEN'

function dialog(title) {
  return cy.contains('[role="dialog"]', title, { timeout: 20_000 })
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

describe('packaged Service Admin with real Core and Secrets Broker', () => {
  before(() => {
    Cypress.config('screenshotOnRunFailure', false)
  })

  it('completes linked rotation, create, reveal, tombstone recovery, backup, key rotation, and provider validation', () => {
    expect(expectedRef).to.be.a('string').and.not.be.empty
    const providerStatusResponses = []
    cy.intercept('GET', '**/providers/config/status', (request) => {
      request.on('response', (response) => {
        providerStatusResponses.push({
          statusCode: response.statusCode,
          outcome:
            typeof response.body?.outcome === 'string'
              ? response.body.outcome
              : null,
        })
      })
    }).as('providerStatus')
    cy.visit('/services/%40secretsbroker')
    cy.contains('Trusted identity verified', { timeout: 20_000 }).should('exist')
    cy.request({
      method: 'POST',
      url: '/api/services/sample-service/start',
      body: { confirm: false },
      timeout: 120_000,
    }).its('status').should('equal', 200)
    cy.visit('/services/%40secretsbroker')
    cy.contains('Secrets Broker', { timeout: 20_000 }).should('be.visible')
    openSecrets()
    cy.wait('@providerStatus', { timeout: 60_000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200)
      expect(response?.body?.providers).to.satisfy((providers) =>
        Array.isArray(providers) &&
        providers.some(
          (provider) =>
            provider?.providerId !== 'generated:sample-service' &&
            provider?.outcome === 'ready'
        )
      )
    })
    cy.contains('Provider status is unavailable; migration remains disabled.').should(
      'not.exist'
    )
    cy.contains('tr', 'vault-auth-required').within(() => {
      cy.contains('source_auth_required').should('be.visible')
      cy.contains('metadata').should('exist')
      cy.contains('reveal').should('exist')
    })
    cy.contains('tr', 'vault-invalid').within(() => {
      cy.contains('invalid_ref').should('be.visible')
      cy.contains('metadata').should('exist')
      cy.contains('reveal').should('exist')
    })

    cy.contains('Operational controls').should('be.visible')
    cy.contains('Active lockouts').parent().find('p').should('not.contain', '—')
    cy.contains('Local API auth failures')
      .parent()
      .find('p')
      .should('not.contain', '—')
    cy.intercept('GET', '**/operations/telemetry').as('brokerTelemetry')
    cy.intercept('GET', '**/operations/events*').as('brokerEvents')
    cy.contains('button', 'Refresh').click()
    cy.wait('@brokerTelemetry', { timeout: 60_000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200)
      expect(response?.body?.safety).to.include({
        lowCardinalityLabels: true,
        valueMaterialIncluded: false,
      })
    })
    cy.wait('@brokerEvents', { timeout: 60_000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200)
      expect(response?.body?.safety).to.deep.equal({
        metadataOnly: true,
        rawRefIncluded: false,
        valueMaterialIncluded: false,
      })
    })

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
      cy.get('#secret-rotation-value').type(
        'browser-rotation-candidate-2026-08-14-verified'
      )
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
          expect(response?.body?.operation?.completedOperations).to.have.length(
            1
          )
        }
      )
      cy.contains('Core rotation committed', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.contains('1 consumer actions completed').should('be.visible')
      cy.wait('@providerStatus', { timeout: 60_000 }).then(({ response }) => {
        expect(response?.statusCode).to.equal(200)
        expect(response?.body?.providers).to.satisfy((providers) =>
          Array.isArray(providers) &&
          providers.some(
            (provider) =>
              provider?.providerId !== 'generated:sample-service' &&
              provider?.outcome === 'ready'
          )
        )
      })
      cy.get('#secret-rotation-value').should('not.exist')
      cy.contains('button', 'Close').click()
    })

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
      cy.get('#secret-replacement-value').type(
        'browser-edited-candidate-2026-08-14-verified'
      )
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

    cy.contains('tr', 'services/sample-service/browser.CREATED_TOKEN', {
      timeout: 20_000,
    }).within(() => {
      cy.contains('button', /^Reset\b/).click()
    })
    dialog('Reset secret').within(() => {
      cy.get('#secret-mutation-reason').type('Release browser qualification')
      cy.get('#secret-replacement-value').type(
        'browser-reset-candidate-2026-08-14-verified'
      )
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

    cy.then(() => {
      const failedResponses = providerStatusResponses.filter(
        ({ statusCode }) => statusCode < 200 || statusCode >= 300
      )
      if (failedResponses.length > 0) {
        throw new Error(
          `Provider status request failed: ${JSON.stringify(failedResponses)}`
        )
      }
    })
    cy.contains('Provider status is unavailable; migration remains disabled.', {
      timeout: 20_000,
    }).should('not.exist')
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
      cy.contains('button', 'Preview migration').click()
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

    cy.contains('tr', expectedRef, { timeout: 20_000 }).within(() => {
      cy.contains('button', /^Migrate\b/).click()
    })
    dialog('Migrate secret provider').within(() => {
      cy.get('#migration-target-provider').select('vault-unavailable')
      cy.get('#migration-audit-reason').type(
        'Release browser unavailable remote provider qualification'
      )
      cy.contains('button', 'Preview migration').click()
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

    cy.contains('button', 'Bulk provider migration').click()
    dialog('Bulk provider migration').within(() => {
      cy.get('#bulk-migration-target-provider').select('vault-browser')
      cy.get(
        '[aria-label="Select services/sample-service/sample.GENERATED_TOKEN for bulk migration"]'
      ).click()
      cy.get('#bulk-migration-audit-reason').type(
        'Release browser verified bulk Vault migration'
      )
      cy.contains('button', 'Create and revalidate campaign').click()
      cy.contains('Durable campaign ready', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.contains('concurrency 1').should('be.visible')
      cy.contains('stop_and_defer_remaining').should('exist')
      cy.get('[aria-label="Confirm exact bulk migration campaign"]').click()
      cy.contains('button', 'Apply exact campaign').click()
      cy.contains('Campaign outcome: applied', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.contains('1 verified').should('be.visible')
      cy.contains(
        'services/sample-service/sample.GENERATED_TOKEN: migrated'
      ).should('be.visible')
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

    cy.reload()
    openSecrets()
    cy.contains('tr', 'services/sample-service/browser.CREATED_TOKEN', {
      timeout: 20_000,
    }).within(() => {
      cy.contains('button', /^Restore\b/).click()
    })
    dialog('Restore secret').within(() => {
      cy.get('#secret-decommission-reason').type('Release browser qualification')
      cy.get('[aria-label="Confirm secret restore"]').click()
      cy.contains('button', /^Restore secret$/).click()
      cy.contains('Secret restored and audit recorded', { timeout: 20_000 }).should(
        'be.visible'
      )
      cy.contains('button', 'Close').click()
    })

    cy.get('#broker-lifecycle-reason').type('Release browser qualification')
    cy.contains('button', 'Create encrypted backup').click()
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
        cy.contains('button', 'Create encrypted backup').click()
        cy.contains(/created and verified/i, {
          timeout: 20_000,
        }).should('be.visible')
      } else {
        cy.contains('button', 'Rotate master key').should('be.disabled')
        cy.contains(
          'Master-key rotation requires a ready OS-backed local wrapper.'
        ).should('be.visible')
        cy.contains('portable key injection').should('be.visible')
      }
    })

    cy.contains('button', 'Validate configuration').first().click()
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
  })
})
