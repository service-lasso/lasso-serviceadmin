import {
  isManagedServiceStoppedResponse,
  managedServiceStartMutationRequestOptions,
  managedServiceStopReadinessAttempts,
  managedServiceStopMutationRequestOptions,
  managedServiceStopRequestOptions,
  managedServiceStopRetryDelayMs,
} from '../../../scripts/real-browser-qualification-budget.mjs'
import { unlockTrustedIdentity } from '../../support/trusted-identity.js'

const expectedRef = 'services/sample-service/sample.GENERATED_TOKEN'

function waitForManagedServiceStopped(
  serviceId,
  remainingAttempts = managedServiceStopReadinessAttempts
) {
  return cy
    .request(
      managedServiceStopRequestOptions(
        `/api/services/${encodeURIComponent(serviceId)}`
      )
    )
    .then((response) => {
      if (isManagedServiceStoppedResponse(response)) return
      if (remainingAttempts <= 1) {
        throw new Error(
          `Managed service ${serviceId} did not reach the stopped lifecycle state.`
        )
      }
      return cy.wait(managedServiceStopRetryDelayMs, { log: false }).then(() =>
        waitForManagedServiceStopped(serviceId, remainingAttempts - 1)
      )
    })
}

describe('packaged Service Admin stopped Broker recovery', () => {
  before(() => {
    Cypress.config('screenshotOnRunFailure', false)
  })

  it('renders unavailable management and recovers inventory after one restart', () => {
    cy.visit('/services/%40secretsbroker')
    unlockTrustedIdentity()
    cy.contains('[role="tab"]', /^Secrets\b/, { timeout: 20_000 }).click()
    cy.contains(expectedRef, { timeout: 30_000 }).then(($cell) => {
      $cell[0].scrollIntoView({ block: 'center', inline: 'nearest' })
    })
    cy.contains(expectedRef, { timeout: 30_000 }).should('be.visible')

    cy.request(
      managedServiceStopMutationRequestOptions(
        '/api/services/%40secretsbroker/stop'
      )
    )
      .its('status')
      .should('equal', 200)
    waitForManagedServiceStopped('@secretsbroker')

    cy.intercept('GET', '**/secrets/management*').as(
      'stoppedBrokerManagement'
    )
    cy.reload()
    unlockTrustedIdentity()
    cy.contains('[role="tab"]', /^Secrets\b/, { timeout: 20_000 }).click()
    cy.wait('@stoppedBrokerManagement', { timeout: 20_000 }).then(
      ({ response }) => {
        expect(response?.statusCode).to.be.within(400, 599)
      }
    )
    cy.contains('Secrets Broker management is unavailable.', {
      timeout: 30_000,
    }).should('be.visible')
    cy.contains('button', 'Retry inventory').should('be.visible')

    cy.request(
      managedServiceStartMutationRequestOptions(
        '/api/services/%40secretsbroker/start'
      )
    )
      .its('status')
      .should('equal', 200)
    cy.contains('button', 'Retry inventory').click()
    cy.contains(expectedRef, { timeout: 30_000 }).then(($cell) => {
      $cell[0].scrollIntoView({ block: 'center', inline: 'nearest' })
    })
    cy.contains(expectedRef, { timeout: 30_000 }).should('be.visible')

    cy.get('[data-testid="secret-reveal-value"]').should('not.exist')
    cy.get('input[type="password"]').should('not.exist')
    cy.contains(/error boundary|uncaught error|failed to load/i).should(
      'not.exist'
    )
  })
})
