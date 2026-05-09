export type SecretLeakSurface = unknown

export interface SecretLeakFinding {
  path: string
  kind: 'sentinel' | 'credential-shape'
  label: string
  excerpt: string
}

export const serviceLassoSecretLeakSentinels = [
  {
    label: 'service-lasso-fake-token',
    value: 'SERVICE_LASSO_FAKE_SECRET_SENTINEL_TOKEN_DO_NOT_USE',
  },
  {
    label: 'service-lasso-fake-password',
    value: 'SERVICE_LASSO_FAKE_SECRET_SENTINEL_PASSWORD_DO_NOT_USE',
  },
  {
    label: 'service-lasso-fake-private-key',
    value: '-----BEGIN SERVICE LASSO FAKE PRIVATE KEY-----',
  },
] as const

const credentialShapePatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: 'bearer-token', pattern: /Bearer\s+[A-Za-z0-9._~+/-]{24,}/g },
  { label: 'basic-auth-url', pattern: /https?:\/\/[^\s/:]+:[^\s/@]{6,}@/g },
  { label: 'github-token', pattern: /gh[pousr]_[A-Za-z0-9_]{30,}/g },
  {
    label: 'private-key-block',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  },
]

function collectStrings(
  input: unknown,
  path: string,
  output: Array<{ path: string; value: string }>
): void {
  if (typeof input === 'string') {
    output.push({ path, value: input })
    return
  }
  if (input === null || input === undefined) return
  if (typeof input !== 'object') return
  if (Array.isArray(input)) {
    input.forEach((entry, index) =>
      collectStrings(entry, `${path}[${index}]`, output)
    )
    return
  }
  for (const [key, value] of Object.entries(input)) {
    collectStrings(value, `${path}.${key}`, output)
  }
}

function excerpt(value: string, index: number, length: number): string {
  return value.slice(
    Math.max(0, index - 16),
    Math.min(value.length, index + length + 16)
  )
}

export function scanForSecretMaterial(
  input: SecretLeakSurface
): SecretLeakFinding[] {
  const strings: Array<{ path: string; value: string }> = []
  collectStrings(input, '$', strings)
  const findings: SecretLeakFinding[] = []

  for (const item of strings) {
    for (const sentinel of serviceLassoSecretLeakSentinels) {
      const index = item.value.indexOf(sentinel.value)
      if (index >= 0) {
        findings.push({
          path: item.path,
          kind: 'sentinel',
          label: sentinel.label,
          excerpt: excerpt(item.value, index, sentinel.value.length),
        })
      }
    }
    for (const { label, pattern } of credentialShapePatterns) {
      pattern.lastIndex = 0
      for (const match of item.value.matchAll(pattern)) {
        findings.push({
          path: item.path,
          kind: 'credential-shape',
          label,
          excerpt: excerpt(item.value, match.index ?? 0, match[0].length),
        })
      }
    }
  }

  return findings
}

export function assertNoSecretMaterial(input: SecretLeakSurface): void {
  const findings = scanForSecretMaterial(input)
  if (findings.length > 0) {
    throw new Error(
      `Secret material leak detected: ${findings
        .map((finding) => `${finding.kind}:${finding.label}@${finding.path}`)
        .join(', ')}`
    )
  }
}

export function collectBrowserLeakSurfaces() {
  return {
    title: document.title,
    text: document.body.textContent ?? '',
    localStorage: Object.fromEntries(
      Array.from({ length: window.localStorage.length }, (_, index) => {
        const key = window.localStorage.key(index) ?? ''
        return [key, window.localStorage.getItem(key)]
      })
    ),
    sessionStorage: Object.fromEntries(
      Array.from({ length: window.sessionStorage.length }, (_, index) => {
        const key = window.sessionStorage.key(index) ?? ''
        return [key, window.sessionStorage.getItem(key)]
      })
    ),
  }
}
