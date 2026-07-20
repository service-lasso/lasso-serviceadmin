import contractFixtures from '@/lib/secrets-broker/fixtures/contract-states.json'

type ContractFixtureCase = {
  name: string
  expectedResponse: Record<string, unknown>
}

type SourceOverride = {
  sourceId: string
  kind: string
  displayName: string
  state: string
  outcome: string
  nextAction?: string
  capabilities?: string[]
  operations?: unknown[]
}

export type CanonicalBrokerOverviewOptions = {
  description?: string
  source?: SourceOverride
  contractVersion?: string | null
  manifestVersion?: string | null
  omitOperations?: boolean
}

function fixtureResponse(name: string) {
  const fixture = (contractFixtures.cases as ContractFixtureCase[]).find(
    (item) => item.name === name
  )

  if (!fixture) throw new Error(`Missing Broker contract fixture: ${name}`)
  return structuredClone(fixture.expectedResponse)
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  })
}

function sourceOperations(source?: SourceOverride) {
  const sourcePayload = fixtureResponse('source-local-ready')
  const operations = structuredClone(
    ((sourcePayload.sources as Record<string, unknown>[])[0]?.operations as
      | Record<string, unknown>[]
      | undefined) ?? []
  )

  if (!source) return operations
  if (source.operations) return structuredClone(source.operations)

  return operations.map((operation) => {
    operation.providerKinds = [source.kind]
    if (
      source.outcome !== 'ready' &&
      operation.maturity !== 'planned' &&
      operation.maturity !== 'unavailable'
    ) {
      operation.maturity = 'unavailable'
      operation.limitationCode = source.outcome
      operation.reasonCode = 'source_operation_blocked'
      operation.nextAction = source.nextAction ?? 'inspect_source_status'
    }
    return operation
  })
}

export function canonicalBrokerOverviewResponse(
  url: string,
  options: CanonicalBrokerOverviewOptions = {}
): Response | null {
  const canonicalCapabilities = fixtureResponse(
    'capabilities-operation-manifest'
  )
  const contractVersion = Object.prototype.hasOwnProperty.call(
    options,
    'contractVersion'
  )
    ? options.contractVersion
    : canonicalCapabilities.contractVersion
  const manifestVersion = Object.prototype.hasOwnProperty.call(
    options,
    'manifestVersion'
  )
    ? options.manifestVersion
    : canonicalCapabilities.manifestVersion
  const marker = '/api/services/%40secretsbroker/proxy'
  const markerIndex = url.indexOf(marker)
  if (markerIndex < 0) return null
  const route = url.slice(markerIndex + marker.length)

  if (route === '/status') {
    return jsonResponse({
      serviceId: '@secretsbroker',
      apiVersion: 'secretsbroker.local/v1',
      version: '0.1.0',
      state: 'ready',
      ready: true,
      checkedAt: '2026-07-18T02:00:00Z',
      description:
        options.description ?? 'Secrets Broker runtime metadata available.',
    })
  }

  if (route === '/state') {
    return jsonResponse(fixtureResponse('state-ready'))
  }

  if (route === '/capabilities') {
    canonicalCapabilities.contractVersion = contractVersion
    canonicalCapabilities.manifestVersion = manifestVersion
    if (options.omitOperations) delete canonicalCapabilities.operations
    return jsonResponse(canonicalCapabilities)
  }

  if (route === '/v1/sources/status') {
    const payload = fixtureResponse('source-local-ready')
    if (options.source) {
      const source = options.source
      const canonicalSource = (payload.sources as Record<string, unknown>[])[0]
      payload.sources = [
        {
          ...canonicalSource,
          sourceId: source.sourceId,
          kind: source.kind,
          displayName: source.displayName,
          enabled: true,
          critical: true,
          priority: 0,
          capabilities: source.capabilities ?? [
            'read',
            'reveal',
            'write/update',
            'rotate/reset',
            'policy',
            'audit',
            'health',
          ],
          operations: sourceOperations(source),
          namespaces: ['*'],
          state: source.state,
          outcome: source.outcome,
          nextAction: source.nextAction,
          retryable: false,
          lifecycle: {
            state: source.state,
            outcome: source.outcome,
            nextAction: source.nextAction,
            retryable: false,
          },
          affectedRefs: [],
          affectedServices: [],
        },
      ]
    }
    return jsonResponse(payload)
  }

  if (route === '/v1/providers/capabilities') {
    return jsonResponse({
      serviceId: '@secretsbroker',
      apiVersion: 'secretsbroker.local/v1',
      contractVersion,
      manifestVersion,
      outcome: 'ready',
      capabilities: [
        {
          providerKind: options.source?.kind ?? 'local-encrypted-store',
          displayName: options.source?.displayName ?? 'Local encrypted store',
          supported: true,
          capabilities: options.source?.capabilities ?? [
            'read',
            'reveal',
            'write/update',
            'rotate/reset',
            'policy',
          ],
          operations: sourceOperations(options.source),
          limitations: ['Test fixture capability limitations.'],
        },
      ],
    })
  }

  if (route === '/v1/providers/config/status') {
    const source = options.source ?? {
      sourceId: 'local',
      kind: 'local-encrypted-store',
      displayName: 'Local encrypted store',
      state: 'connected',
      outcome: 'ready',
    }
    const provider = {
      providerId: source.sourceId,
      providerKind: source.kind,
      displayName: source.displayName,
      state: source.state,
      outcome: source.outcome,
      nextAction: source.nextAction,
      auditStatus: 'audit_available',
      namespaces: ['*'],
      capabilities: source.capabilities ?? [
        'read',
        'reveal',
        'write/update',
        'rotate/reset',
        'policy',
      ],
      operations: sourceOperations(source),
    }
    return jsonResponse({
      serviceId: '@secretsbroker',
      apiVersion: 'secretsbroker.local/v1',
      contractVersion,
      manifestVersion,
      outcome: 'ready',
      currentProvider: provider,
      providers: [provider],
    })
  }

  if (route === '/v1/telemetry') {
    return jsonResponse({
      serviceId: '@secretsbroker',
      apiVersion: 'secretsbroker.local/v1',
      contractVersion,
      outcome: 'ready',
    })
  }

  if (route === '/v1/events?limit=1') {
    return jsonResponse(fixtureResponse('events-empty-safe'))
  }

  return null
}
