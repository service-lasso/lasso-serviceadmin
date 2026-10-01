const { createHash } = require('node:crypto')
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
    return {
      sha256: createHash('sha256').update(readFileSync(candidate)).digest('hex'),
      size: info.size,
    }
  } catch {
    return null
  }
}

function observedParentPid(pid) {
  try {
    if (process.platform === 'linux') {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
      const tail = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)
      return Number(tail[1])
    }
    const command = process.platform === 'win32' ? 'powershell.exe' : 'ps'
    const args = process.platform === 'win32'
      ? ['-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter \"ProcessId=${pid}\").ParentProcessId`]
      : ['-o', 'ppid=', '-p', String(pid)]
    const value = childProcess.execFileSync(command, args, { encoding: 'utf8', windowsHide: true }).trim()
    return Number(value)
  } catch {
    return null
  }
}

function classify(command, args) {
  const executable = hashRegularFile(command)
  if (!executable) return null
  for (const candidate of [command, ...(Array.isArray(args) ? args : [])]) {
    if (typeof candidate !== 'string') continue
    const source = hashRegularFile(candidate)
    const role = source && expectedSources.get(source.sha256)
    const ownerNonce = process.env[`SERVICE_LASSO_QUALIFICATION_${role?.toUpperCase()}_NONCE`]
    if (role && /^[a-f0-9]{64}$/.test(ownerNonce)) {
      return { role, ownerNonce, sourceSha256: source.sha256, sourceSize: source.size, executableSha256: executable.sha256, executableSize: executable.size }
    }
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
  const pid = Number.isInteger(child.pid) && child.pid > 0 ? child.pid : null
  let born = false
  if (pid !== null) {
    try {
      process.kill(pid, 0)
      born = true
    } catch {}
  }
  const parentPid = pid === null ? null : observedParentPid(pid)
  if (!born || parentPid !== process.pid) return child
  const identity = {
    ...source,
    pid,
    parentPid,
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
