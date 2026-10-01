/**
 * Cypress-only, closed metadata for the trusted-identity qualification path.
 * It is never enabled for ordinary Admin sessions and contains no runtime data.
 */
export type RuntimeIdentityCausalPhase =
  | 'request_started'
  | 'response_delivered'
  | 'contract_parsed'
  | 'contract_rejected'
  | 'query_settled'
  | 'query_failed'
  | 'render_loading'
  | 'render_unavailable'
  | 'render_unlocked'
  | 'render_login'

type RuntimeIdentityCausalSnapshot = {
  sequence: number
  request: 'unobserved' | 'started' | 'response_delivered'
  contract: 'unobserved' | 'parsed' | 'rejected'
  query: 'unobserved' | 'pending' | 'settled' | 'failed'
  render: 'unobserved' | 'loading' | 'unavailable' | 'unlocked' | 'login'
}

declare global {
  interface Window {
    Cypress?: unknown
    __serviceAdminRuntimeIdentityCausal?: RuntimeIdentityCausalSnapshot
  }
}

const initialSnapshot = (): RuntimeIdentityCausalSnapshot => ({
  sequence: 0,
  request: 'unobserved',
  contract: 'unobserved',
  query: 'unobserved',
  render: 'unobserved',
})

export function observeRuntimeIdentityCausalPhase(
  phase: RuntimeIdentityCausalPhase
) {
  if (typeof window === 'undefined' || !window.Cypress) return
  const current =
    window.__serviceAdminRuntimeIdentityCausal ?? initialSnapshot()
  const next = { ...current }
  if (phase === 'request_started') {
    next.sequence = Math.min(999, current.sequence + 1)
    next.request = 'started'
    next.contract = 'unobserved'
    next.query = 'pending'
    next.render = 'unobserved'
  } else if (phase === 'response_delivered') {
    next.request = 'response_delivered'
  } else if (phase === 'contract_parsed') {
    next.contract = 'parsed'
  } else if (phase === 'contract_rejected') {
    next.contract = 'rejected'
  } else if (phase === 'query_settled') {
    next.query = 'settled'
  } else if (phase === 'query_failed') {
    next.query = 'failed'
  } else if (phase === 'render_loading') {
    next.render = 'loading'
  } else if (phase === 'render_unavailable') {
    next.render = 'unavailable'
  } else if (phase === 'render_unlocked') {
    next.render = 'unlocked'
  } else if (phase === 'render_login') {
    next.render = 'login'
  }
  window.__serviceAdminRuntimeIdentityCausal = next
}
