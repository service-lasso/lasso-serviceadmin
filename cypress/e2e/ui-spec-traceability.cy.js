describe('SPEC-UI-ADMIN-SERVICE traceability coverage', () => {
  beforeEach(() => {
    cy.request('POST', '/api/runtime/actions/start')
  })

  it('AC-UI-001 and section 1: treats the admin UI as an operator service rather than privileged core', () => {
    cy.visit('/')
    cy.contains('Service Lasso operator dashboard').should('be.visible')
    cy.contains('Optional operator UI').should('be.visible')
  })

  it('AC-UI-002 and section 2: consumes API state over HTTP rather than inline unmanaged state', () => {
    cy.request('/api/health').its('status').should('eq', 200)
    cy.request('/api/services').its('body').should('be.an', 'array')
    cy.visit('/services')
    cy.contains('Traefik Router').should('be.visible')
  })

  it('AC-UI-003 and section 3: exposes the operator route model', () => {
    const routes = [
      ['/services', 'Services'],
      ['/dependencies', 'Dependencies'],
      ['/runtime', 'Runtime overview'],
      ['/logs', 'Logs'],
      ['/network', 'Network'],
      ['/installed', 'Installed'],
      ['/settings', 'Operator settings'],
    ]

    routes.forEach(([path, text]) => {
      cy.visit(path)
      cy.contains(text).should('be.visible')
    })
  })

  it('AC-UI-004 and section 4: provides the minimum dashboard surface', () => {
    cy.visit('/')
    cy.contains('Runtime').should('be.visible')
    cy.contains('Services').should('be.visible')
    cy.contains('Problem and transition services').should('be.visible')
    cy.contains('Reload runtime').should('be.visible')
  })

  it('AC-UI-005 and section 5: provides the minimum service detail surface', () => {
    cy.visit('/services/service-lasso')
    cy.contains('Operator controls').should('be.visible')
    cy.contains('Reachability').should('be.visible')
    cy.contains('Dependencies').should('be.visible')
    cy.contains('Recent logs').should('be.visible')
    cy.contains('Selected version').should('be.visible')
    cy.contains('State path').should('be.visible')
  })

  it('AC-UI-006 and section 6: exposes visible named service actions with feedback', () => {
    cy.visit('/services/openobserve')
    cy.contains('button', 'logs').click()
    cy.contains('Stubbed logs request applied for openobserve.').should('be.visible')
    cy.contains('Logs action requested a fresh tail snapshot.').should('be.visible')
  })

  it('AC-UI-007 and section 7: surfaces logs, runtime, network, and installed views', () => {
    cy.visit('/logs')
    cy.contains('Logs').should('be.visible')
    cy.contains('OpenObserve').should('be.visible')

    cy.visit('/runtime')
    cy.contains('Runtime overview').should('be.visible')
    cy.contains('Host').should('be.visible')

    cy.visit('/network')
    cy.contains('Network').should('be.visible')
    cy.contains('admin.servicelasso.localhost').should('be.visible')

    cy.visit('/installed')
    cy.contains('Installed').should('be.visible')
    cy.contains('selected').should('exist')
  })

  it('section 8: keeps dependency visibility as a first-class operator concern', () => {
    cy.visit('/dependencies')
    cy.contains('Dependencies').should('be.visible')
    cy.contains('lasso-@serviceadmin').should('be.visible')
    cy.contains('depends on').should('be.visible')
  })

  it('AC-UI-008, AC-UI-009, and section 9 are captured by the local spec/docs bundle', () => {
    cy.readFile('docs/openspec-drafts/SPEC-UI-ADMIN-SERVICE.md').should((content) => {
      expect(content).to.include('The UI should consume a stable Service Lasso API/control surface.')
      expect(content).to.include('The donor UI should be treated as feature reference, not implementation shape.')
      expect(content).to.include('## Current Open Questions')
      expect(content).to.include('shadcn-admin')
    })
  })
})
