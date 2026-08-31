import { describe, expect, it } from 'vitest'
import {
  addServiceNextAction,
  addServiceStatusLabel,
  archiveProgressItem,
  catalogItemsFromInstallPayload,
  createPendingCatalogItems,
  markCatalogItemsDownloading,
  markCatalogItemsRequestFailed,
  serviceDetailsPath,
  serviceIdFromDetailsUrl,
} from './add-service-progress-model'

const selections = [
  { id: '@traefik', name: 'Traefik', version: 'v3.5.2' },
  { id: '@zitadel', name: 'Zitadel', version: 'v2.71.0' },
]

describe('add-service-progress-model', () => {
  it('maps Core install results including progress, conflicts, and failures', () => {
    const items = catalogItemsFromInstallPayload(
      {
        install: {
          ok: false,
          state: 'partial',
          results: [
            {
              packageId: '@traefik',
              serviceId: 'traefik',
              state: 'registered',
              ok: true,
              progress: [
                'pending',
                'downloading',
                'validating',
                'copying',
                'registered',
              ],
              reason: null,
            },
            {
              packageId: '@zitadel',
              serviceId: 'zitadel',
              state: 'skipped/conflict',
              ok: false,
              progress: [
                'pending',
                'downloading',
                'validating',
                'skipped/conflict',
              ],
              conflict: { kind: 'target_manifest_exists' },
              reason:
                'A service with this id already exists and was not overwritten.',
            },
            {
              packageId: '@broken',
              state: 'failed',
              ok: false,
              progress: ['pending', 'downloading', 'failed'],
              reason: 'Catalog archive download returned 404',
            },
          ],
        },
      },
      selections
    )

    expect(items.map((item) => item.status)).toEqual([
      'complete',
      'skipped/conflict',
      'failed',
    ])
    expect(items[0]?.serviceId).toBe('traefik')
    expect(items[0]?.nextAction).toBeUndefined()
    expect(items[1]?.message).toContain('already exists')
    expect(items[1]?.nextAction).toContain('does not overwrite')
    expect(items[2]?.nextAction).toContain('retry this service')
    expect(items).toHaveLength(3)
  })

  it('maps the shipped Admin catalog outcome payload', () => {
    const items = catalogItemsFromInstallPayload(
      {
        results: [
          {
            id: '@traefik',
            status: 'registered',
            message: 'Traefik was registered.',
          },
          {
            id: '@zitadel',
            status: 'conflict',
            message: 'Zitadel already exists.',
          },
        ],
      },
      selections
    )

    expect(items[0]).toMatchObject({
      id: '@traefik',
      label: 'Traefik',
      status: 'complete',
      message: 'Traefik was registered.',
      serviceId: '@traefik',
    })
    expect(items[1]).toMatchObject({
      status: 'skipped/conflict',
      message: 'Zitadel already exists.',
    })
  })

  it('keeps pending catalog rows visible while downloading and after a request failure', () => {
    const pending = createPendingCatalogItems(selections)
    const downloading = markCatalogItemsDownloading(pending)
    const failed = markCatalogItemsRequestFailed(
      downloading,
      'password=super-secret catalog token=abcd'
    )

    expect(pending.map((item) => item.status)).toEqual(['pending', 'pending'])
    expect(downloading.map((item) => item.status)).toEqual([
      'downloading',
      'downloading',
    ])
    expect(failed.map((item) => item.status)).toEqual(['failed', 'failed'])
    expect(failed[0]?.message).toBe('[unsafe metadata withheld]')
  })

  it('builds archive progress for upload, conflict, failure, and import', () => {
    expect(
      archiveProgressItem({
        fileName: 'echo-import.zip',
        uploadState: 'uploading',
        importState: 'idle',
      })?.status
    ).toBe('uploading')

    expect(
      archiveProgressItem({
        fileName: 'echo-import.zip',
        uploadState: 'uploaded',
        importState: 'idle',
        serviceId: 'echo-import',
        displayName: 'Echo Import',
        conflictExists: true,
        conflictMessage: 'echo-import already exists.',
      })
    ).toMatchObject({
      status: 'skipped/conflict',
      message: 'echo-import already exists.',
      nextAction: addServiceNextAction('skipped/conflict', 'archive'),
    })

    expect(
      archiveProgressItem({
        fileName: 'echo-import.zip',
        uploadState: 'error',
        importState: 'idle',
        errorMessage: 'Service Archive upload failed.',
      })
    ).toMatchObject({
      status: 'failed',
      nextAction: addServiceNextAction('failed', 'archive'),
    })

    expect(
      archiveProgressItem({
        fileName: 'echo-import.zip',
        uploadState: 'uploaded',
        importState: 'imported',
        serviceId: 'echo-import',
        displayName: 'Echo Import',
        validationStatus: 'valid',
        importStatus: 'imported',
        importMessage: 'Echo Import was added.',
        importServiceUrl: '/services/echo-import',
      })
    ).toMatchObject({
      status: 'complete',
      serviceId: 'echo-import',
      message: 'Echo Import was added.',
    })
  })

  it('labels statuses and parses Service Details paths', () => {
    expect(addServiceStatusLabel('skipped/conflict')).toBe('Conflict')
    expect(addServiceStatusLabel('complete')).toBe('Complete')
    expect(addServiceStatusLabel('downloading')).toBe('Downloading')
    expect(serviceDetailsPath('echo-import')).toBe('/services/echo-import')
    expect(serviceIdFromDetailsUrl('/services/echo-import')).toBe('echo-import')
  })
})
