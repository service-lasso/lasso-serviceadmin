const providerActivationEnvironment = [
  'SERVICE_LASSO_ADMIN_PROVIDER_OBSERVER_ROOT',
  'SERVICE_LASSO_ADMIN_PROVIDER_OBSERVER_NONCE',
]

// A trusted-unlock receipt consumer binds the Admin verifier as the observed
// provider. The nested Core runner is not that provider, so it must not inherit
// the outer activation tuple and re-enforce it against its own process identity.
export function nestedCoreRunnerEnvironment(environment, additions = {}) {
  const next = { ...environment, ...additions }
  for (const name of providerActivationEnvironment) delete next[name]
  return next
}
