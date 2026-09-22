import { createServiceDetailReadinessObservation } from '../../scripts/service-detail-readiness-diagnostic.mjs'

export const lifecycleControlsSelector =
  '[data-testid="service-detail-lifecycle-controls"]'

export function observeBrokerDetailReadiness() {
  const observation = createServiceDetailReadinessObservation()
  cy.intercept(
    'GET',
    /\/api\/dashboard\/services\/(?:%40|@)secretsbroker(?:\?|$)/,
    (request) => {
      const token = observation.started()
      request.on('response', (response) => {
        observation.responded(
          token,
          response.statusCode,
          Boolean(response.body?.service)
        )
      })
    }
  )
  return observation
}

export function brokerLifecycleControls(observation) {
  // Use Cypress's existing default command timeout; no extra mutation or retry.
  return cy
    .get('body')
    .should(($body) => {
      const present = $body.find(lifecycleControlsSelector).length > 0
      expect(present, JSON.stringify(observation.snapshot(present))).to.equal(
        true
      )
    })
    .find(lifecycleControlsSelector)
}
