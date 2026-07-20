import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import contractFixtures from './fixtures/contract-states.json'

const pinnedFixtureSha256 =
  '2bb6332b131cd3f867ef6f0d8f31d00c630857bfa25fe383aa89fc5796e2bcef'

describe('Secrets Broker pinned consumer contract', () => {
  it('keeps the upstream fixture byte-for-byte pinned', () => {
    const bytes = readFileSync(
      resolve(
        process.cwd(),
        'src/lib/secrets-broker/fixtures/contract-states.json'
      )
    )
    const digest = createHash('sha256').update(bytes).digest('hex')

    expect(digest).toBe(pinnedFixtureSha256)
  })

  it('contains the canonical states consumed by Service Admin', () => {
    const cases = contractFixtures.cases.map((fixture) => ({
      name: fixture.name,
      path: fixture.path,
      responseSchema: fixture.responseSchema,
    }))

    expect(cases).toEqual(
      expect.arrayContaining([
        {
          name: 'capabilities-operation-manifest',
          path: '/capabilities',
          responseSchema: 'CapabilitiesResponse',
        },
        {
          name: 'state-ready',
          path: '/state',
          responseSchema: 'StateResponse',
        },
        {
          name: 'source-local-ready',
          path: '/v1/sources/status',
          responseSchema: 'sourceStatusResponse',
        },
        {
          name: 'source-openbao-auth-required',
          path: '/v1/sources/status',
          responseSchema: 'sourceStatusResponse',
        },
        {
          name: 'source-vault-policy-denied',
          path: '/v1/sources/status',
          responseSchema: 'sourceStatusResponse',
        },
        {
          name: 'source-vault-audit-unavailable',
          path: '/v1/sources/status',
          responseSchema: 'sourceStatusResponse',
        },
        {
          name: 'events-empty-safe',
          path: '/v1/events',
          responseSchema: 'eventsResponse',
        },
      ])
    )
  })
})
