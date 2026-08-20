import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

type ManifestRecord = Record<string, unknown>

const servicesRoot = join(process.cwd(), 'public', 'services')

function readServiceManifests() {
  return readdirSync(servicesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = join(servicesRoot, entry.name, 'service.json')
      const manifest = JSON.parse(
        readFileSync(manifestPath, 'utf8')
      ) as ManifestRecord

      return { serviceId: entry.name, manifest, manifestPath }
    })
}

describe('bundled service manifests', () => {
  it('author service interfaces through canonical endpoints', () => {
    for (const { serviceId, manifest } of readServiceManifests()) {
      expect(manifest).not.toHaveProperty('ports')
      expect(manifest).not.toHaveProperty('portmapping')
      expect(manifest).not.toHaveProperty('urls')
      expect(manifest.execconfig).not.toHaveProperty('serviceport')

      const endpoints = manifest.endpoints
      expect(Array.isArray(endpoints), serviceId).toBe(true)
      expect(endpoints, serviceId).not.toHaveLength(0)

      for (const endpoint of endpoints as ManifestRecord[]) {
        expect(
          endpoint.env,
          `${serviceId}:${String(endpoint.id)}`
        ).toBeUndefined()
        expect(
          endpoint.globalenv,
          `${serviceId}:${String(endpoint.id)}`
        ).toBeUndefined()
        expect(
          endpoint.export,
          `${serviceId}:${String(endpoint.id)}`
        ).toBeUndefined()
        expect(
          endpoint.exports,
          `${serviceId}:${String(endpoint.id)}`
        ).toBeUndefined()

        if (endpoint.kind !== 'network') {
          continue
        }

        const port = endpoint.port as ManifestRecord | undefined
        expect(port, `${serviceId}:${String(endpoint.id)}`).toEqual(
          expect.objectContaining({
            default: expect.any(Number),
            strategy: expect.stringMatching(/^(automatic|preferred|fixed)$/),
          })
        )
      }
    }
  })
})
