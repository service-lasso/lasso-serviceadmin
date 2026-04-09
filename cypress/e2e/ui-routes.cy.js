describe('lasso-@serviceadmin UI routes', () => {
  beforeEach(() => {
    cy.request('POST', '/api/runtime/actions/start')
  })

  it('renders the dashboard and current operator warnings', () => {
    cy.visit('/')
    cy.contains('h1', 'Service Lasso operator dashboard').should('be.visible')
    cy.contains('Runtime').should('be.visible')
    cy.contains('Services').should('be.visible')
    cy.contains('Current warnings').should('be.visible')
  })

  it('covers every main route in the sidebar surface', () => {
    cy.visit('/services')
    cy.contains('Services').should('be.visible')
    cy.contains('Traefik Router').should('be.visible')

    cy.visit('/services/service-lasso')
    cy.contains('h1', 'Service Lasso Core').should('be.visible')
    cy.contains('Operator controls').should('be.visible')
    cy.contains('Reachability').should('be.visible')

    cy.visit('/dependencies')
    cy.contains('Dependencies').should('be.visible')
    cy.contains('lasso-@serviceadmin').should('be.visible')

    cy.visit('/runtime')
    cy.contains('Runtime overview').should('be.visible')
    cy.contains('button', 'reload').should('be.visible')

    cy.visit('/logs')
    cy.contains('Logs').should('be.visible')
    cy.contains('OpenObserve').should('be.visible')

    cy.visit('/network')
    cy.contains('Network').should('be.visible')
    cy.contains('admin.servicelasso.localhost').should('be.visible')

    cy.visit('/installed')
    cy.contains('Installed').should('be.visible')
    cy.contains('localcert').should('be.visible')

    cy.visit('/settings')
    cy.contains('Operator settings').should('be.visible')
    cy.contains('Refresh interval').should('be.visible')
  })
})
