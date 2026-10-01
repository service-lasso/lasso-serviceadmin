const roles = Object.freeze(['broker_binary', 'admin_runtime'])
const sha256 = /^[a-f0-9]{64}$/
const nonce = /^[a-f0-9]{32,128}$/

function isPid(value) {
  return Number.isSafeInteger(value) && value > 0
}

function hasOnlyKeys(value, keys) {
  return Object.keys(value).sort().join(',') === [...keys].sort().join(',')
}

function validBirth(record, expected) {
  return (
    hasOnlyKeys(record, [
      'event',
      'executableSha256',
      'ownerNonce',
      'parentPid',
      'pid',
      'role',
      'sourceSha256',
      'sourceSize',
      'executableSize',
    ]) &&
    record.event === 'birth' &&
    roles.includes(record.role) &&
    nonce.test(record.ownerNonce) &&
    isPid(record.pid) &&
    isPid(record.parentPid) &&
    sha256.test(record.executableSha256) &&
    Number.isSafeInteger(record.sourceSize) && record.sourceSize > 0 &&
    Number.isSafeInteger(record.executableSize) && record.executableSize > 0 &&
    record.sourceSha256 === expected[record.role]?.sourceSha256 &&
    record.executableSha256 === expected[record.role]?.executableSha256 &&
    record.sourceSize === expected[record.role]?.sourceSize &&
    record.executableSize === expected[record.role]?.executableSize &&
    record.parentPid === expected[record.role]?.parentPid &&
    record.ownerNonce === expected[record.role]?.ownerNonce
  )
}

function validClose(record, expected) {
  const terminal =
    (Number.isInteger(record.exitCode) && record.exitCode >= 0 && record.signal === null) ||
    (record.exitCode === null && typeof record.signal === 'string' && /^[A-Z0-9_]{1,32}$/.test(record.signal))
  return (
    hasOnlyKeys(record, [
      'event',
      'executableSha256',
      'exitCode',
      'ownerNonce',
      'parentPid',
      'pid',
      'role',
      'signal',
      'sourceSha256',
      'sourceSize',
      'executableSize',
    ]) &&
    record.event === 'close' &&
    roles.includes(record.role) &&
    nonce.test(record.ownerNonce) &&
    isPid(record.pid) &&
    isPid(record.parentPid) &&
    sha256.test(record.executableSha256) &&
    Number.isSafeInteger(record.sourceSize) && record.sourceSize > 0 &&
    Number.isSafeInteger(record.executableSize) && record.executableSize > 0 &&
    terminal &&
    record.sourceSha256 === expected[record.role]?.sourceSha256 &&
    record.executableSha256 === expected[record.role]?.executableSha256 &&
    record.sourceSize === expected[record.role]?.sourceSize &&
    record.executableSize === expected[record.role]?.executableSize &&
    record.parentPid === expected[record.role]?.parentPid &&
    record.ownerNonce === expected[record.role]?.ownerNonce
  )
}

// The sidecar stays private.  Its records carry no path, command line, or
// environment value; this parser rejects every record that cannot be paired to
// exactly one observed child object from this invocation.
export function parseOwnedProcessCustody(bytes, expected) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > 64 * 1024) {
    return []
  }
  const records = []
  for (const line of bytes.toString('utf8').split(/\r?\n/).filter(Boolean)) {
    let record
    try {
      record = JSON.parse(line)
    } catch {
      return []
    }
    if (!record || typeof record !== 'object' || Array.isArray(record)) return []
    if (record.event === 'birth' ? !validBirth(record, expected) : !validClose(record, expected)) {
      return []
    }
    records.push(record)
  }

  const paired = new Map()
  for (const record of records) {
    const key = `${record.role}:${record.ownerNonce}:${record.pid}:${record.parentPid}`
    const current = paired.get(key) ?? {}
    if (record.event === 'birth') {
      if (current.birth) return []
      current.birth = record
    } else {
      if (current.close) return []
      current.close = record
    }
    paired.set(key, current)
  }
  if (paired.size !== roles.length) return []
  for (const role of roles) {
    const matches = [...paired.values()].filter((pair) => pair.birth?.role === role)
    if (matches.length !== 1 || !matches[0].birth || !matches[0].close) return []
    const { birth, close } = matches[0]
    if (
      birth.sourceSha256 !== close.sourceSha256 ||
      birth.executableSha256 !== close.executableSha256 ||
      birth.ownerNonce !== close.ownerNonce ||
      birth.pid !== close.pid ||
      birth.parentPid !== close.parentPid
      || birth.sourceSize !== close.sourceSize
      || birth.executableSize !== close.executableSize
    ) {
      return []
    }
  }
  return records
}

export function hasClosedOwnedProcessCustody(records) {
  return (
    Array.isArray(records) &&
    records.length === roles.length * 2 &&
    roles.every((role) =>
      records.some(
        (record) =>
          record.role === role &&
          record.event === 'birth' &&
          records.some(
            (close) =>
              close.role === role &&
              close.event === 'close' &&
              close.ownerNonce === record.ownerNonce &&
              close.pid === record.pid &&
              close.parentPid === record.parentPid &&
              close.sourceSha256 === record.sourceSha256 &&
              close.executableSha256 === record.executableSha256
          )
      )
    )
  )
}
