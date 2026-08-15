const expectedRef = 'services/sample-service/sample.GENERATED_TOKEN'

describe('packaged Service Admin first-run Secrets Broker enrollment', () => {
  before(() => {
    Cypress.config('screenshotOnRunFailure', false)
  })

  it('initializes the vault, provisions declared secrets, and starts the linked consumer', () => {
    cy.visit('/services/%40secretsbroker')
    cy.contains('Service Lasso first-run setup', { timeout: 30_000 }).should(
      'be.visible'
    )
    cy.contains('Setup required').should('be.visible')
    cy.contains('Not initialized').should('be.visible')

    cy.intercept('POST', '**/api/setup/bootstrap').as('bootstrapBroker')
    cy.contains('button', 'Initialize Secrets Broker').click()
    cy.wait('@bootstrapBroker', { timeout: 180_000 }).then(({ response }) => {
      const responseCode = [response?.body?.error?.code, response?.body?.code].find(
        (code) => typeof code === 'string' && /^[a-z0-9_]+$/u.test(code)
      )
      expect(
        response?.statusCode,
        `bootstrap HTTP status (code=${responseCode ?? 'unclassified_error'})`
      ).to.equal(201)
      expect(response?.body?.bootstrap).to.include({
        ok: true,
        state: 'setup_complete',
      })
      expect(response?.body?.bootstrap?.provisionedSecretCount).to.be.greaterThan(
        0
      )
    })

    cy.contains('Service Lasso first-run setup', { timeout: 30_000 }).should(
      'not.exist'
    )
    cy.contains('Trusted identity verified', { timeout: 30_000 }).should('exist')
    cy.contains('[role="tab"]', /^Secrets\b/, { timeout: 30_000 }).click()
    cy.contains(expectedRef, { timeout: 60_000 }).should('be.visible')

    cy.request({
      method: 'POST',
      url: '/api/services/sample-service/start',
      body: { confirm: false },
      timeout: 180_000,
    }).then(({ status, body }) => {
      expect(status).to.equal(200)
      expect(body?.ok).to.equal(true)
      expect(body?.state?.running).to.equal(true)
    })
    cy.visit('/services/sample-service')
    cy.contains('Running', { timeout: 30_000 }).should('be.visible')
    cy.get('[data-testid="secret-reveal-value"]').should('not.exist')
    cy.get('input[type="password"]').should('not.exist')
  })
})
