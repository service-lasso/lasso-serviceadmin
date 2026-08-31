export function unlockTrustedIdentity(timeout = 20_000) {
  cy.contains(/Trusted identity verified|Continue as local-root/, {
    timeout,
  }).then(($marker) => {
    if ($marker.is('button')) {
      cy.wrap($marker).click()
    }
  })
  cy.contains('Trusted identity verified', { timeout }).should('exist')
}
