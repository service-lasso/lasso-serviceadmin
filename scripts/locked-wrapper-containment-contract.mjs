export const lockedWrapperContainmentBoundaries = Object.freeze({
  ownershipEnrollment: 'root exited during ownership enrollment',
  targetAcknowledgement:
    'Windows managed launcher exited before the service launch was acknowledged (exit 1).',
})

export function isLockedWrapperContainmentFailure(message) {
  return (
    typeof message === 'string' &&
    Object.values(lockedWrapperContainmentBoundaries).some((boundary) =>
      message.includes(boundary)
    )
  )
}
