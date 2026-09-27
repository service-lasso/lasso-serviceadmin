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
      const renderState = {
        skeletonPresent: $body.find('[data-slot="skeleton"]').length > 0,
        serviceNotFoundPresent: $body
          .find('[data-slot="card-title"]')
          .toArray()
          .some((element) => element.textContent?.trim() === 'Service not found'),
        generalErrorPresent: $body
          .find('span')
          .toArray()
          .some((element) =>
            element.textContent?.startsWith('Oops! Something went wrong')
          ),
        pageNotFoundPresent: $body
          .find('span')
          .toArray()
          .some((element) =>
            element.textContent?.trim() === 'Oops! Page Not Found!'
          ),
      }
      expect(
        matches.length,
        JSON.stringify(observation.snapshot(matches.length > 0, renderState))
      ).to.equal(1)
    })
    .find(lifecycleControlsSelector)
}
