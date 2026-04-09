describe('Service Lasso stub API contract', () => {
  it('serves the expected top-level endpoints', () => {
    cy.request('/api/health').its('body').should((body) => {
      expect(body.ok).to.equal(true)
      expect(body.source).to.equal('service-lasso-stub-api')
    })

    cy.request('/api/runtime/status').its('body').should((body) => {
      expect(body).to.have.property('status')
      expect(body).to.have.nested.property('serviceCounts.total')
      expect(body).to.have.property('uptime')
    })

    cy.request('/api/services').its('body').should((body) => {
      expect(body).to.be.an('array').and.have.length.greaterThan(0)
      expect(body[0]).to.have.property('id')
      expect(body[0]).to.have.property('actions')
    })

    cy.request('/api/services/service-lasso').its('body').should((body) => {
      expect(body.id).to.equal('service-lasso')
      expect(body.logs).to.be.an('array').and.have.length.greaterThan(0)
    })

    cy.request('/api/dependencies').its('body').should((body) => {
      expect(body.nodes).to.be.an('array').and.have.length.greaterThan(0)
      expect(body.edges).to.be.an('array').and.have.length.greaterThan(0)
    })

    cy.request('/api/network').its('body').should('be.an', 'array')
    cy.request('/api/installed').its('body').should('be.an', 'array')
    cy.request('/api/settings').its('body').should('be.an', 'array')
  })

  it('mutates stub state through runtime and service action endpoints', () => {
    cy.request('POST', '/api/services/localcert/actions/install').its('body').should((body) => {
      expect(body.ok).to.equal(true)
      expect(body.serviceId).to.equal('localcert')
      expect(body.action).to.equal('install')
    })

    cy.request('/api/services/localcert').its('body').should((body) => {
      expect(body.status).to.equal('running')
      expect(body.note).to.include('installed')
    })

    cy.request('POST', '/api/services/traefik/actions/config').its('body').should((body) => {
      expect(body.ok).to.equal(true)
    })

    cy.request('/api/services/traefik').its('body').should((body) => {
      expect(body.status).to.equal('running')
    })

    cy.request('POST', '/api/runtime/actions/stop').its('body').should((body) => {
      expect(body.ok).to.equal(true)
      expect(body.action).to.equal('stop')
    })

    cy.request('/api/services/lasso-%40serviceadmin').its('body').should((body) => {
      expect(body.status).to.equal('stopped')
    })

    cy.request('POST', '/api/runtime/actions/start').its('body').should((body) => {
      expect(body.ok).to.equal(true)
      expect(body.action).to.equal('start')
    })

    cy.request('/api/services/lasso-%40serviceadmin').its('body').should((body) => {
      expect(body.status).to.equal('running')
    })
  })
})
