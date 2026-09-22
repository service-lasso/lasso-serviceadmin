import { describe, expect, it } from 'vitest'
import { createServiceDetailReadinessObservation } from './service-detail-readiness-diagnostic.mjs'

describe('RD-001/RD-002 closed readiness observation', () => {
  it('distinguishes unobserved, pending, failed, missing and ready responses', () => {
    const observer = createServiceDetailReadinessObservation()
    expect(observer.snapshot(false).state).toBe('unobserved')
    let request = observer.started()
    expect(observer.snapshot(false)).toMatchObject({
      state: 'pending',
      httpStatus: null,
      servicePresent: null,
    })
    observer.responded(request, 503, false)
    expect(observer.snapshot(false)).toMatchObject({
      httpStatus: 503,
      servicePresent: false,
    })
    request = observer.started()
    observer.responded(request, 200, false)
    expect(observer.snapshot(false)).toMatchObject({
      httpStatus: 200,
      servicePresent: false,
    })
    request = observer.started()
    observer.responded(request, 200, true)
    expect(observer.snapshot(true)).toEqual({
      kind: 'broker-detail-readiness',
      requestCount: 3,
      state: 'responded',
      httpStatus: 200,
      servicePresent: true,
      controlsPresent: true,
    })
  })

  it('ignores old responses and bounds counts without reusing request identities', () => {
    const observer = createServiceDetailReadinessObservation()
    const old = observer.started()
    for (let index = 0; index < 1100; index++) observer.started()
    observer.responded(old, 200, true)
    expect(observer.snapshot(false)).toMatchObject({
      requestCount: 999,
      state: 'pending',
      httpStatus: null,
      servicePresent: null,
    })
  })

  it('closes a request after its first response', () => {
    const observer = createServiceDetailReadinessObservation()
    const request = observer.started()
    observer.responded(request, 200, true)
    observer.responded(request, 503, false)
    expect(observer.snapshot(true)).toMatchObject({
      requestCount: 1,
      state: 'responded',
      httpStatus: 200,
      servicePresent: true,
    })
  })

  it('rejects arbitrary sensitive metadata and invalid statuses', () => {
    const observer = createServiceDetailReadinessObservation()
    const secret = {
      value: 'PRIVATE-SENTINEL',
      toString() {
        throw new Error('must not stringify')
      },
    }
    const request = observer.started()
    observer.responded(request, secret, secret)
    expect(observer.snapshot(secret)).toMatchObject({
      httpStatus: null,
      servicePresent: null,
      controlsPresent: false,
    })
    expect(JSON.stringify(observer.snapshot(secret))).not.toContain(
      'PRIVATE-SENTINEL'
    )
    for (const status of [99, 600, NaN, Infinity, 200.5, '200']) {
      observer.responded(request, status, true)
      expect(observer.snapshot(false).httpStatus).toBeNull()
    }
  })
})
