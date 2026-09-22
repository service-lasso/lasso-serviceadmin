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
      const matches = $body.find(lifecycleControlsSelector)
      expect(
        matches.length,
        JSON.stringify(observation.snapshot(matches.length > 0))
      ).to.equal(1)
    })
    .find(lifecycleControlsSelector)
}
