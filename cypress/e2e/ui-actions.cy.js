describe('lasso-@serviceadmin operator actions', () => {
  beforeEach(() => {
    cy.request('POST', '/api/runtime/actions/start')
    cy.visit('/services/localcert')
  })

  it('runs install/config style actions through the real served stub API', () => {
    cy.contains('button', 'install').click()
    cy.contains('Stubbed install request applied for localcert.').should('be.visible')
    cy.contains('Generated fresh local certificate bundle.').should('be.visible')

    cy.visit('/services/traefik')
    cy.contains('button', 'config').click()
    cy.contains('Stubbed config request applied for traefik.').should('be.visible')
    cy.contains('Config action refreshed routes and TLS material.').should('be.visible')
  })

  it('shows runtime actions affecting the UI state', () => {
    cy.visit('/runtime')
    cy.contains('button', 'stop').click()
    cy.contains('Stubbed runtime stop request applied.').should('be.visible')

    cy.visit('/services')
    cy.contains('localcert').parents('tr').should('contain.text', 'stopped')

    cy.visit('/runtime')
    cy.contains('button', 'start').click()
    cy.contains('Stubbed runtime start request applied.').should('be.visible')

    cy.visit('/services')
    cy.contains('localcert').parents('tr').should('contain.text', 'running')
  })

  it('records log-oriented actions on the service detail route', () => {
    cy.visit('/services/openobserve')
    cy.contains('button', 'logs').click()
    cy.contains('Stubbed logs request applied for openobserve.').should('be.visible')
    cy.contains('Logs action requested a fresh tail snapshot.').should('be.visible')
  })
})
