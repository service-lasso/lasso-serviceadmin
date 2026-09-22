import { createServiceDetailReadinessObservation } from '../../../scripts/service-detail-readiness-diagnostic.mjs'
import {
  brokerLifecycleControls,
  observeBrokerDetailReadiness,
} from '../../support/broker-detail-readiness.js'

describe('RD-003/RD-004 lifecycle readiness diagnostic browser contract', () => {
  let expectedFailure
  let observedFailure

  beforeEach(() => {
    expectedFailure = false
    observedFailure = false
    cy.visit('/')
  })

  afterEach(() => {
    expect(observedFailure).to.equal(expectedFailure)
  })

  it('returns present controls without mutation', () => {
    const observation = createServiceDetailReadinessObservation()
    cy.document().then((document) => {
      document.body.innerHTML =
        '<div data-testid="service-detail-lifecycle-controls"><button>Restart service</button></div>'
    })
    brokerLifecycleControls(observation).should('have.length', 1)
  })

  it('observes the real detail request without retaining its response values', () => {
    cy.intercept('GET', '**/api/dashboard/services/%40secretsbroker', {
      statusCode: 200,
      body: { service: { id: 'PRIVATE-RESPONSE-SENTINEL' } },
    })
    const observation = observeBrokerDetailReadiness()
    cy.window().then((window) =>
      window.fetch('/api/dashboard/services/%40secretsbroker')
    )
    cy.then(() => {
      expect(observation.snapshot(false)).to.include({
        requestCount: 1,
        state: 'responded',
        httpStatus: 200,
        servicePresent: true,
      })
      expect(JSON.stringify(observation.snapshot(false))).not.to.contain(
        'PRIVATE-RESPONSE-SENTINEL'
      )
    })
  })

  it('fails missing controls with closed metadata, not DOM text', () => {
    expectedFailure = true
    const observation = createServiceDetailReadinessObservation()
    const request = observation.started()
    observation.responded(request, 503, false)
    cy.document().then((document) => {
      document.body.innerHTML = '<p>PRIVATE-DOM-SENTINEL</p>'
    })
    cy.on('fail', (error) => {
      expect(error.message).to.contain('broker-detail-readiness')
      expect(error.message).to.contain('"httpStatus":503')
      expect(error.message).not.to.contain('PRIVATE-DOM-SENTINEL')
      observedFailure = true
      return false
    })
    brokerLifecycleControls(observation)
  })
})
