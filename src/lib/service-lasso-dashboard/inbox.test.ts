import { describe, expect, it } from 'vitest'
import {
  countOperatorInboxItems,
  filterInboxItemsForView,
  parseInboxCountsPayload,
  parseInboxListPayload,
  resolveInboxDeepLink,
  unreadBadgeCount,
} from './inbox'
import type { OperatorInboxItem } from './types'

function sampleItem(
  overrides: Partial<OperatorInboxItem> = {}
): OperatorInboxItem {
  return {
    id: 'inbox-sample',
    dedupeKey: 'system:runtime.startup:current',
    title: 'Runtime startup',
    summary: 'Runtime finished startup.',
    details: null,
    type: 'system',
    severity: 'info',
    source: 'system',
    state: 'unread',
    visibility: 'visible',
    createdAt: '2026-08-20T01:00:00.000Z',
    updatedAt: '2026-08-20T01:00:00.000Z',
    readAt: null,
    hiddenAt: null,
    relatedTarget: { route: '/runtime' },
    action: {
      label: 'Review',
      target: '/runtime',
      kind: 'link',
      availability: 'available',
    },
    ...overrides,
  }
}

describe('operator inbox helpers', () => {
  it('maps service, logs, and runtime hrefs onto in-app deep links', () => {
    expect(resolveInboxDeepLink('/services/%40traefik/updates')).toEqual({
      kind: 'service',
      serviceId: '@traefik',
    })
    expect(resolveInboxDeepLink('/logs?service=%40serviceadmin')).toEqual({
      kind: 'logs',
      serviceId: '@serviceadmin',
    })
    expect(resolveInboxDeepLink('/runtime')).toEqual({ kind: 'runtime' })
  })

  it('rejects secret-looking or external Inbox targets', () => {
    expect(
      resolveInboxDeepLink('https://example.test/operator.json')
    ).toBeNull()
    expect(resolveInboxDeepLink('//evil.test')).toBeNull()
    expect(resolveInboxDeepLink('/api/operator.json')).toBeNull()
    expect(resolveInboxDeepLink('\\windows\\operator.json')).toBeNull()
  })

  it('counts visible unread items for header badges', () => {
    const counts = countOperatorInboxItems([
      sampleItem(),
      sampleItem({
        id: 'hidden',
        state: 'unread',
        visibility: 'hidden',
      }),
      sampleItem({
        id: 'read',
        state: 'read',
        readAt: '2026-08-20T02:00:00.000Z',
      }),
    ])

    expect(unreadBadgeCount(counts)).toBe(1)
    expect(filterInboxItemsForView([sampleItem()], 'unread')).toHaveLength(1)
    expect(
      filterInboxItemsForView(
        [
          sampleItem(),
          sampleItem({
            id: 'hidden',
            visibility: 'hidden',
            hiddenAt: '2026-08-20T02:00:00.000Z',
          }),
        ],
        'hidden'
      )
    ).toEqual([
      expect.objectContaining({
        id: 'hidden',
        visibility: 'hidden',
      }),
    ])
  })

  it('parses Core Inbox list and counts envelopes', () => {
    const item = sampleItem()
    const listed = parseInboxListPayload({
      inbox: {
        items: [item],
        pagination: { limit: 50, nextCursor: null, total: 1 },
      },
    })
    const counts = parseInboxCountsPayload({
      inbox: {
        counts: countOperatorInboxItems([item]),
      },
    })

    expect(listed?.items[0]?.title).toBe('Runtime startup')
    expect(counts ? unreadBadgeCount(counts) : 0).toBe(1)
  })
})
