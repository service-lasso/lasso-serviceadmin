import {
  createTrustedUnlockObservation,
  observeTrustedUnlockFailure,
} from '../../scripts/trusted-unlock-diagnostic.mjs'

export function unlockTrustedIdentity(timeout = 20_000) {
  const observation = createTrustedUnlockObservation()
  let complete
  cy.intercept('GET', /\/api\/runtime\/security(?:\?|$)/, (request) => {
    const token = observation.started()
    if (token !== null) {
      request.on('response', (response) => {
        observation.responded(token, response.statusCode)
      })
    }
  })
  cy.then(() => {
    observation.begin()
    complete = observeTrustedUnlockFailure(cy, observation, () => {
      const text = Cypress.$('body').text()
      return {
        verifiedMarkerPresent: text.includes('Trusted identity verified'),
        localRootButtonPresent: Cypress.$('button').toArray().some(
          (button) => button.textContent?.trim() === 'Continue as local-root'
        ),
        loadingMarkerPresent: text.includes('Verifying trusted Service Lasso identity'),
        unavailableMarkerPresent: text.includes('Trusted identity unavailable'),
      }
    })
  })
  cy.contains(/Trusted identity verified|Continue as local-root/, {
    timeout,
  }).then(($marker) => {
    if ($marker.is('button')) {
      cy.wrap($marker).click()
    }
  })
  cy.then(() => observation.verifying())
  cy.contains('Trusted identity verified', { timeout }).should('exist')
  cy.then(() => complete())
}
