const path = require('node:path')
const safeErrorCodes = new Set([
  'EACCES',
  'EAGAIN',
  'EMFILE',
  'ENFILE',
  'ENOENT',
  'ENOMEM',
  'EPERM',
  'UNKNOWN',
])

function installCypressChildExitObserver(api, write) {
  const originalSpawn = api.spawn
  let events = 0
  const publish = (phase, event, details = {}) => {
    if (events >= 16) return
    events += 1
    const evidence = {
      schema: 'service-admin.cypress-child-exit.v1',
      phase,
      event,
      ...details,
    }
    // Observation must not replace the caller's outcome if its sink fails.
    try {
      write(`${JSON.stringify(evidence)}\n`)
    } catch {}
  }
  api.spawn = function (...parameters) {
    const [command, args] = parameters
    if (
      typeof command !== 'string' ||
      !['cypress', 'cypress.exe'].includes(path.basename(command).toLowerCase())
    )
      return Reflect.apply(originalSpawn, this, parameters)
    const phase =
      Array.isArray(args) && args.includes('--smoke-test')
        ? 'smoke_test'
        : 'run'
    let child
    try {
      child = Reflect.apply(originalSpawn, this, parameters)
    } catch (error) {
      publish(phase, 'spawn_throw', { errorCode: safeErrorCode(error) })
      throw error
    }
    publish(phase, 'spawn')
    const observe = (event) => (code, signal) => {
      publish(phase, event, {
        exitCode:
          code === null || (Number.isInteger(code) && code >= 0 && code <= 255)
            ? code
            : 'unavailable',
        signal:
          signal === null || ['SIGINT', 'SIGTERM', 'SIGKILL'].includes(signal)
            ? signal
            : 'other',
      })
    }
    child.once('error', (error) => {
      publish(phase, 'error', { errorCode: safeErrorCode(error) })
      // Keep the original unhandled-error terminal behavior after observation.
      throw error
    })
    child.once('exit', observe('exit'))
    child.once('close', observe('close'))
    return child
  }
}

function safeErrorCode(error) {
  return typeof error?.code === 'string' && safeErrorCodes.has(error.code)
    ? error.code
    : 'unavailable'
}

module.exports = { installCypressChildExitObserver }
