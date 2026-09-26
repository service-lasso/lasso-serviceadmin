import { unlockTrustedIdentity } from '../../support/trusted-identity.js'

describe('RD-006 through RD-009 trusted unlock observer lifetime', () => {
  let expectedFailure
  let observedFailure
  beforeEach(() => { cy.visit('/') })

  afterEach(() => { expect(observedFailure).to.equal(expectedFailure) })

  it('keeps verified-marker success and removes its failure observer', () => {
    let baseline
    cy.document().then((document) => {
      document.body.innerHTML = '<p>Trusted identity verified</p>'
      baseline = cy.listenerCount('fail')
    })
    unlockTrustedIdentity()
    unlockTrustedIdentity()
    cy.then(() => { expect(cy.listenerCount('fail')).to.equal(baseline) })
  })

  it('preserves the explicit local-root click and the final verified assertion', () => {
    cy.document().then((document) => {
      document.body.innerHTML = '<button>Continue as local-root</button>'
      const button = document.querySelector('button')
      button.addEventListener('click', () => {
        document.body.innerHTML = '<p>Trusted identity verified</p>'
      }, { once: true })
    })
    unlockTrustedIdentity()
    cy.contains('Trusted identity verified').should('exist')
  })

  it('does not attribute an unrelated failure after successful unlock', () => {
    expectedFailure = true
    cy.document().then((document) => {
      document.body.innerHTML = '<p>Trusted identity verified</p>'
    })
    unlockTrustedIdentity()
    cy.then(() => {
      cy.on('fail', (error) => {
        expect(error.message).not.to.contain('trusted-unlock-readiness')
        observedFailure = true
        return false
      })
    })
    cy.get('[data-owned-unrelated-missing]', { timeout: 100 }).should('exist')
  })
})