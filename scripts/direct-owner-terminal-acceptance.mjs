import { waitForCapturedChildClose } from './captured-child-close.mjs'

export async function closeSuccessfulCoreRunner(runner, owner) {
  if (runner.exitCode === null && runner.signalCode === null) {
    runner.send({ type: 'service-lasso-real-admin-shutdown' })
  }
  // Always drain output, including when exit happened before this caller.
  const exitCode = await waitForCapturedChildClose(runner, 180_000)
  if (
    exitCode !== 0 || runner.exitCode !== 0 || runner.signalCode !== null ||
    owner.close !== 'observed' || owner.exitCode !== 0 ||
    owner.signal !== null || owner.error !== null ||
    ![runner.stdout, runner.stderr].every((stream) => !stream || stream.readableEnded)
  ) {
    throw new Error('Owned Core browser runner did not reach successful captured terminal closure.')
  }
}

export function hasAcceptedDirectOwnerClosure(owners, context) {
  if (owners.length !== 2 ||
    owners.filter(({ role }) => role === 'core_runner').length !== 1 ||
    owners.filter(({ role }) => role === 'cypress').length !== 1) return false
  const controlledCypress =
    context.controlledNegative === true &&
    context.controlledProviderFaultVerified === true &&
    context.failureDiagnostic?.lastPhase === 'provider_validation_complete' &&
    context.failureDiagnostic?.cypressRunSummary?.state === 'complete' &&
    context.failureDiagnostic.cypressRunSummary.totalFailed === 1 &&
    context.failureDiagnostic.failure === 'nonzero_exit' &&
    Number.isInteger(context.cypressExit) && context.cypressExit > 0
  return owners.every((owner) =>
    owner.birth === 'observed' && owner.parentPid === context.parentPid &&
    owner.close === 'observed' && owner.error === null &&
    owner.signal === null && /^[a-f0-9]{64}$/.test(owner.sourceSha256) &&
    (owner.role === 'core_runner'
      ? owner.exitCode === 0
      : context.controlledNegative
        ? controlledCypress && owner.exitCode === context.cypressExit
        : owner.exitCode === 0 && context.cypressExit === 0)
  )
}
