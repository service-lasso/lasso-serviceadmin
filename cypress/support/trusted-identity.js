import {
  createTrustedUnlockDiagnostic,
  createTrustedUnlockObservation,
  observeTrustedUnlockFailure,
} from '../../scripts/trusted-unlock-diagnostic.mjs'

let retainedTrustedUnlockDiagnostic = null

export function flushTrustedUnlockReceipt() {
  const diagnostic = retainedTrustedUnlockDiagnostic
  retainedTrustedUnlockDiagnostic = null
  return diagnostic
    ? cy.task('trustedUnlockDiagnostic', diagnostic, { log: false })
    : undefined
}

export function unlockTrustedIdentity(
  timeout = 20_000,
  { retainFailureReceipt = false } = {}
) {
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
  const readReceiptMarkers = () => {
    const body = Cypress.$('body')
    return {
      verified: body.find('[data-runtime-identity]').length > 0,
      localRoot: body
        .find('button')
        .toArray()
        .some((button) => button.textContent?.trim() === 'Continue as local-root'),
      loading: body
        .find('main')
        .toArray()
        .some(
          (element) =>
            element.textContent?.trim() ===
            'Verifying trusted Service Lasso identity'
        ),
      unavailable: body
        .find('[role="alert"]')
        .toArray()
        .some((element) =>
          element.textContent?.includes('Trusted identity unavailable')
        ),
    }
  }
  cy.then(() => {
    observation.begin()
    complete = observeTrustedUnlockFailure(Cypress, observation, () => {
      observation.causalSnapshot(
        Cypress.state('window')?.__serviceAdminRuntimeIdentityCausal
      )
      const text = Cypress.$('body').text()
      return {
        verifiedMarkerPresent: text.includes('Trusted identity verified'),
        localRootButtonPresent: Cypress.$('button').toArray().some(
          (button) => button.textContent?.trim() === 'Continue as local-root'
        ),
        loadingMarkerPresent: text.includes('Verifying trusted Service Lasso identity'),
        unavailableMarkerPresent: text.includes('Trusted identity unavailable'),
      }
    }, retainFailureReceipt ? readReceiptMarkers : undefined, (receipt) => {
      retainedTrustedUnlockDiagnostic = createTrustedUnlockDiagnostic(
        receipt,
        observation.snapshot({}).causal
      )
    })
  })
  cy.window({ log: false }).then((browserWindow) => {
    observation.causalSnapshot(browserWindow.__serviceAdminRuntimeIdentityCausal)
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
  cy.then(() => {
    complete()
  })
}
