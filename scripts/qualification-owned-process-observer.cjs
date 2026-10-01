const { createHash, randomBytes } = require('node:crypto')
const { appendFileSync, lstatSync, readFileSync } = require('node:fs')
const { syncBuiltinESMExports } = require('node:module')
const childProcess = require('node:child_process')

const eventsPath = process.env.SERVICE_LASSO_QUALIFICATION_OWNED_PROCESS_EVENTS_PATH
const expectedSources = new Map([
  [process.env.SERVICE_LASSO_QUALIFICATION_BROKER_SHA256, 'broker_binary'],
  [process.env.SERVICE_LASSO_QUALIFICATION_ADMIN_RUNTIME_SHA256, 'admin_runtime'],
])

function hashRegularFile(candidate) {
  try {
    const info = lstatSync(candidate)
    if (!info.isFile() || info.isSymbolicLink()) return null
    return createHash('sha256').update(readFileSync(candidate)).digest('hex')
  } catch {
    return null
  }
}

function classify(command, args) {
  const executableSha256 = hashRegularFile(command)
  if (!executableSha256) return null
  for (const candidate of [command, ...(Array.isArray(args) ? args : [])]) {
    if (typeof candidate !== 'string') continue
    const sourceSha256 = hashRegularFile(candidate)
    const role = expectedSources.get(sourceSha256)
    if (role) return { role, sourceSha256, executableSha256 }
  }
  return null
}

function publish(event) {
  if (!eventsPath) return
  try {
    appendFileSync(eventsPath, `${JSON.stringify(event)}\n`, { encoding: 'utf8', mode: 0o600 })
  } catch {}
}

const originalSpawn = childProcess.spawn
childProcess.spawn = function observedSpawn(command, args, options) {
  const child = Reflect.apply(originalSpawn, this, arguments)
  const source = classify(command, args)
  if (!source) return child
  const ownerNonce = randomBytes(16).toString('hex')
  const pid = Number.isInteger(child.pid) && child.pid > 0 ? child.pid : null
  let born = false
  if (pid !== null) {
    try {
      process.kill(pid, 0)
      born = true
    } catch {}
  }
  if (!born) return child
  const identity = {
    ...source,
    ownerNonce,
    pid,
    parentPid: process.pid,
  }
  publish({ ...identity, event: 'birth' })
  child.once('close', (exitCode, signal) => {
    publish({
      ...identity,
      event: 'close',
      exitCode: Number.isInteger(exitCode) && exitCode >= 0 ? exitCode : null,
      signal: signal === null || typeof signal === 'string' ? signal : 'UNKNOWN',
    })
  })
  return child
}
syncBuiltinESMExports()
