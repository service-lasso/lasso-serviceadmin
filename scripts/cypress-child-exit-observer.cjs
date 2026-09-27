const path = require('node:path')

function installCypressChildExitObserver(api, write) {
  const originalSpawn = api.spawn
  let events = 0
  api.spawn = function (...parameters) {
    const child = Reflect.apply(originalSpawn, this, parameters)
    const [command, args] = parameters
    if (
      typeof command !== 'string' ||
      !['cypress', 'cypress.exe'].includes(path.basename(command).toLowerCase())
    )
      return child
    const phase =
      Array.isArray(args) && args.includes('--smoke-test')
        ? 'smoke_test'
        : 'run'
    const observe = (event) => (code, signal) => {
      if (events >= 8) return
      events += 1
      const evidence = {
        schema: 'service-admin.cypress-child-exit.v1',
        phase,
        event,
        exitCode:
          code === null || (Number.isInteger(code) && code >= 0 && code <= 255)
            ? code
            : 'unavailable',
        signal:
          signal === null || ['SIGINT', 'SIGTERM', 'SIGKILL'].includes(signal)
            ? signal
            : 'other',
      }
      // Observation must not replace the caller's outcome if its sink fails.
      try {
        write(`${JSON.stringify(evidence)}\n`)
      } catch {}
    }
    child.once('exit', observe('exit'))
    child.once('close', observe('close'))
    // No error listener: preserve the caller's original unhandled-error behavior.
    return child
  }
}

module.exports = { installCypressChildExitObserver }
