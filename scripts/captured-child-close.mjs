export function waitForCapturedChildClose(child, timeoutMs) {
  const drained = [child.stdout, child.stderr].every(
    (stream) => !stream || stream.readableEnded
  )
  if ((child.exitCode !== null || child.signalCode !== null) && drained) {
    return Promise.resolve(child.exitCode)
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      child.off('close', onClose)
      child.off('error', onError)
    }
    const onClose = (code) => {
      cleanup()
      resolve(code)
    }
    const onError = (error) => {
      cleanup()
      reject(error)
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Child process output closure timed out.'))
    }, timeoutMs)
    child.once('close', onClose)
    child.once('error', onError)
  })
}
