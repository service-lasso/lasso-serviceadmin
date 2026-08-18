const MAX_BROKER_DISPLAY_TEXT_LENGTH = 512
const MAX_BROKER_IDENTIFIER_LENGTH = 512
const credentialAssignment =
  /\b(?:api[_ -]?key|authorization|bearer|client[_ -]?secret|cookie|credential|master[_ -]?key|pass(?:word|wd)?|private[_ -]?key|secret(?:[_ -]?(?:key|token|value))?|session[_ -]?token|token)\b\s*[:=]\s*\S+/i
const authorizationValue = /\bbearer\s+[a-z0-9._~+/-]{8,}/i
const privateKeyMaterial = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/i
const jwtMaterial = /\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/i
const urlUserInfo = /:\/\/[^\s/@:]+:[^\s/@]+@/i
const safeIdentifier = /^[a-z0-9@._:/+~-]+$/i

export const withheldBrokerText = '[unsafe metadata withheld]'

function hasUnsafeControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return (
      code === 0x7f ||
      (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d)
    )
  })
}

export function containsUnsafeBrokerText(value: string) {
  return (
    hasUnsafeControlCharacters(value) ||
    credentialAssignment.test(value) ||
    authorizationValue.test(value) ||
    privateKeyMaterial.test(value) ||
    jwtMaterial.test(value) ||
    urlUserInfo.test(value)
  )
}

export function sanitizeBrokerDisplayText(value: unknown) {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return undefined
  if (
    normalized.length > MAX_BROKER_DISPLAY_TEXT_LENGTH ||
    containsUnsafeBrokerText(normalized)
  ) {
    return withheldBrokerText
  }
  return normalized
}

export function requireSafeBrokerIdentifier(
  value: unknown,
  field: string,
  options: { allowEmpty?: boolean } = {}
) {
  if (typeof value !== 'string') {
    throw new Error(`Secrets Broker returned an invalid ${field}.`)
  }
  const normalized = value.trim()
  if (options.allowEmpty && !normalized) return ''
  if (
    !normalized ||
    normalized.length > MAX_BROKER_IDENTIFIER_LENGTH ||
    !safeIdentifier.test(normalized) ||
    containsUnsafeBrokerText(normalized)
  ) {
    throw new Error(`Secrets Broker returned an invalid ${field}.`)
  }
  return normalized
}

export function validateBrokerSearchInput(value: string) {
  const normalized = value.trim()
  if (!normalized) return ''
  if (
    normalized.length > 256 ||
    containsUnsafeBrokerText(normalized) ||
    hasUnsafeControlCharacters(normalized)
  ) {
    throw new Error('Secret search contains unsafe input.')
  }
  return normalized
}
