export const lockedWrapperContainmentMessages = Object.freeze([
  'Cannot start service "@secretsbroker" because process spawn failed: Cannot start managed process "@secretsbroker": root exited during ownership enrollment.',
  'Cannot start service "@secretsbroker" because process spawn failed: Windows managed launcher exited before the service launch was acknowledged (exit 1).',
])

export function isLockedWrapperContainmentFailure(message) {
  return typeof message === 'string' && lockedWrapperContainmentMessages.includes(message)
}
