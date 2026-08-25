describe('packaged Service Admin active Broker lockout recovery', () => {
  before(() => {
    Cypress.config('screenshotOnRunFailure', false)
  })

  it('clears the exact active IPC scope and renders its durable event', () => {
    cy.visit('/services/%40secretsbroker')
    cy.contains('Trusted identity verified', { timeout: 20_000 }).should('exist')
    cy.request({
      method: 'POST',
      url: '/api/services/%40secretsbroker/start',
      body: { confirm: false },
      timeout: 120_000,
    })
      .its('status')
      .should('equal', 200)

    cy.env(['testControlUrl']).then(({ testControlUrl: controlUrl }) => {
      expect(controlUrl).to.match(
        /^http:\/\/127\.0\.0\.1:\d+\/__service_lasso_test$/
      )
      cy.request(
        'POST',
        `${controlUrl}/induce-local-api-lockout`
      ).then(({ body }) => {
        expect(body.outcome).to.equal('lockout_active')
        expect(body.lockoutScope).to.be.a('string').and.match(/^local_api:/)

        cy.reload()
        cy.contains('Trusted identity verified', { timeout: 20_000 }).should(
          'exist'
        )
        cy.visit('/services/%40secretsbroker')
        cy.contains('[role="tab"]', /^Secrets\b/, { timeout: 20_000 }).click()
        cy.contains('[data-slot="card"]', 'Operational controls', {
          timeout: 30_000,
        }).should('be.visible')

        cy.intercept('GET', '**/operations/telemetry').as('lockoutTelemetry')
        cy.contains('[data-slot="card"]', 'Operational controls').within(() => {
          cy.contains('button', 'Refresh', { timeout: 60_000 })
            .should('not.be.disabled')
            .click()
        })
        cy.wait('@lockoutTelemetry', { timeout: 60_000 }).then(
          ({ response }) => {
            expect(response?.statusCode).to.equal(200)
            expect(response?.body?.counters?.activeLockouts).to.equal(1)
          }
        )

        cy.intercept('POST', '**/secrets/lockouts/clear').as(
          'clearActiveLockout'
        )
        cy.intercept(
          'GET',
          '**/operations/events?family=lockout_cleared*'
        ).as('clearedLockoutEvents')
        cy.contains('[data-slot="card"]', 'Operational controls').within(() => {
          cy.get('#broker-lockout-scope').clear().type(body.lockoutScope)
          cy.get('#broker-lockout-reason')
            .clear()
            .type('Real browser qualification active lockout recovery')
          cy.get(
            '[aria-label="Confirm this exact audited lockout clear"]'
          ).click()
          cy.contains('button', 'Clear exact lockout').click()
        })
        cy.wait('@clearActiveLockout', { timeout: 60_000 }).then(
          ({ response }) => {
            expect(response?.statusCode).to.equal(200)
            expect(response?.body).to.include({
              operation: 'lockout_clear',
              outcome: 'cleared',
              cleared: true,
              lockoutScope: body.lockoutScope,
              auditStatus: 'audit_recorded',
            })
          }
        )
        cy.contains('[data-slot="card"]', 'Operational controls').within(() => {
          cy.contains(
            `Lockout ${body.lockoutScope} was cleared and audited.`,
            { timeout: 30_000 }
          ).should('be.visible')
          cy.contains('Active lockouts')
            .parent()
            .contains(/^0$/, { timeout: 60_000 })
            .should('be.visible')
          cy.get('#broker-event-family').select('lockout_cleared')
        })
        cy.wait('@clearedLockoutEvents', { timeout: 60_000 }).then(
          ({ response }) => {
            expect(response?.statusCode).to.equal(200)
            const event = response?.body?.events?.find(
              (candidate) => candidate.operation === 'lockout_clear'
            )
            expect(event).to.include({
              family: 'lockout_cleared',
              operation: 'lockout_clear',
              outcome: 'cleared',
            })
          }
        )
        cy.contains('[data-slot="card"]', 'Operational controls').within(() => {
          cy.contains('td', 'lockout_clear', { timeout: 30_000 }).should(
            'be.visible'
          )
          cy.contains('td', 'cleared').should('be.visible')
        })
      })
    })
  })
})
