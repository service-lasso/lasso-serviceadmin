import { describe, expect, it } from 'vitest'
import {
  buildSecretAccessAssignmentRows,
  parseManifestAccessPolicyGrants,
  secretAccessAssignmentsHaveSecretMaterial,
} from './secret-access-policy'
import type { SecretAccessAssignmentAudit } from './types'

const grantedManifest = `{
  "id": "api-service",
  "broker": {
    "enabled": true,
    "imports": [
      {
        "namespace": "shared/database",
        "ref": "database.PASSWORD",
        "as": "DB_PASSWORD",
        "required": true
      }
    ],
    "accessPolicy": {
      "serviceId": "api-service",
      "workspace": "local-demo",
      "grants": [
        {
          "namespace": "shared/database",
          "scope": "shared",
          "refs": ["database.PASSWORD"],
          "operations": ["resolve"],
          "purpose": "connect api-service to the shared database"
        }
      ]
    }
  }
}
`

function emptyAudit(
  grants: SecretAccessAssignmentAudit['grants'] = []
): SecretAccessAssignmentAudit {
  return {
    services: [],
    summary: {
      services: 0,
      references: 0,
      present: 0,
      missing: 0,
      malformed: 0,
    },
    grants,
  }
}

describe('broker.accessPolicy assignment parser', () => {
  it('reads grant metadata from a live service.json without env values', () => {
    const grants = parseManifestAccessPolicyGrants(grantedManifest, 'api-service')

    expect(grants).toEqual([
      {
        id: 'api-service:shared/database:0',
        serviceId: 'api-service',
        workspace: 'local-demo',
        namespace: 'shared/database',
        scope: 'shared',
        refs: ['database.PASSWORD'],
        namespaceWide: false,
        operations: ['resolve'],
        purpose: 'connect api-service to the shared database',
      },
    ])
  })

  it('returns no grants for empty manifests and ignores secret-bearing env maps', () => {
    expect(parseManifestAccessPolicyGrants('{"id":"empty"}', 'empty')).toEqual(
      []
    )
    expect(
      parseManifestAccessPolicyGrants(
        JSON.stringify({
          id: 'unsafe',
          env: { TOKEN: 'must-not-become-an-assignment-row' },
          broker: {},
        }),
        'unsafe'
      )
    ).toEqual([])
  })

  it('builds assigned and missing inspector rows without secret material', () => {
    const grants = parseManifestAccessPolicyGrants(grantedManifest, 'api-service')
    const audit: SecretAccessAssignmentAudit = {
      services: [
        {
          serviceId: 'api-service',
          manifestPath: 'services/api-service/service.json',
          findings: [
            {
              serviceId: 'api-service',
              ref: 'database.ROOT_PASSWORD',
              namespace: 'shared/database',
              status: 'present',
              source: 'broker.import',
              location: 'broker.imports[0].ref',
              required: true,
              reason: 'Broker reference is declared in the service manifest.',
              accessPolicy: {
                operation: 'resolve',
                status: 'missing',
                reason:
                  'broker.accessPolicy is present but does not grant resolve access for this namespace/ref.',
              },
            },
          ],
          summary: { present: 1, missing: 0, malformed: 0 },
        },
      ],
      summary: {
        services: 1,
        references: 1,
        present: 1,
        missing: 0,
        malformed: 0,
      },
      grants,
    }

    const rows = buildSecretAccessAssignmentRows(audit)
    expect(rows.map((row) => row.status)).toEqual(['assigned', 'missing'])
    expect(rows[0]?.purpose).toBe(
      'connect api-service to the shared database'
    )
    expect(secretAccessAssignmentsHaveSecretMaterial(audit)).toBe(false)
    expect(secretAccessAssignmentsHaveSecretMaterial(emptyAudit())).toBe(false)
  })
})
