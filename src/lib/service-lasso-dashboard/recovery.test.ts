import { describe, expect, it } from 'vitest'
import {
  applyRemoteRecoveryStates,
  buildRecoveryNotifications,
  fetchInboxSummary,
} from './stub'
import type { DashboardService, ServiceRecoveryHistoryState } from './types'

function recoveryState(
  serviceId: string,
  event: ServiceRecoveryHistoryState['events'][number]
): ServiceRecoveryHistoryState {
  return {
    serviceId,
    updatedAt: event.at,
    events: [event],
  }
}

function service(
  id: string,
  recovery: ServiceRecoveryHistoryState
): DashboardService {
  return {
    id,
    name: id,
    status: 'running',
    favorite: false,
    note: '',
    links: [],
    installed: true,
    role: '',
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '1m',
      lastCheckAt: '2026-04-27T00:00:00.000Z',
      summary: 'Healthy',
    },
    endpoints: [],
    metadata: {
      serviceType: 'test',
      runtime: 'test',
      version: '1.0.0',
      build: 'test',
    },
    dependencies: [],
    dependents: [],
    environmentVariables: [],
    recentLogs: [],
    actions: [],
    recovery,
  }
}

describe('service recovery notifications', () => {
  it('summarizes monitor, doctor, hook, and restart events needing attention', () => {
    const summary = buildRecoveryNotifications([
      service(
        'healthy-monitor',
        recoveryState('healthy-monitor', {
          kind: 'monitor',
          serviceId: 'healthy-monitor',
          action: 'healthy',
          reason: 'healthy',
          message: 'Service is healthy.',
          at: '2026-04-27T00:00:00.000Z',
        })
      ),
      service(
        'monitor-review',
        recoveryState('monitor-review', {
          kind: 'monitor',
          serviceId: 'monitor-review',
          action: 'skip',
          reason: 'unhealthy_threshold',
          message: 'Threshold not reached.',
          at: '2026-04-27T00:00:00.000Z',
        })
      ),
      service(
        'doctor-blocked',
        recoveryState('doctor-blocked', {
          kind: 'doctor',
          serviceId: 'doctor-blocked',
          ok: false,
          blocked: true,
          steps: [],
          at: '2026-04-27T00:00:00.000Z',
        })
      ),
      service(
        'hook-blocked',
        recoveryState('hook-blocked', {
          kind: 'hook',
          serviceId: 'hook-blocked',
          phase: 'postUpgrade',
          ok: false,
          blocked: true,
          steps: [],
          at: '2026-04-27T00:00:00.000Z',
        })
      ),
      service(
        'restart-failed',
        recoveryState('restart-failed', {
          kind: 'restart',
          serviceId: 'restart-failed',
          ok: false,
          message: 'Readiness failed.',
          at: '2026-04-27T00:00:00.000Z',
        })
      ),
    ])

    expect(summary.monitorAttentionCount).toBe(1)
    expect(summary.doctorBlockedCount).toBe(1)
    expect(summary.hookBlockedCount).toBe(1)
    expect(summary.restartFailureCount).toBe(1)
    expect(summary.messages).toContain(
      '1 service monitor event(s) need review.'
    )
    expect(summary.messages).toContain(
      '1 doctor/preflight check(s) are blocked.'
    )
    expect(summary.messages).toContain('1 lifecycle hook run(s) are blocked.')
    expect(summary.messages).toContain('1 restart attempt(s) failed readiness.')
  })

  it('accepts remote recovery state payloads from the Service Lasso API shape', () => {
    expect(() =>
      applyRemoteRecoveryStates([
        {
          serviceId: 'service-admin',
          recovery: recoveryState('service-admin', {
            kind: 'doctor',
            serviceId: 'service-admin',
            ok: true,
            blocked: false,
            steps: [],
            at: '2026-04-27T00:00:00.000Z',
          }),
        },
      ])
    ).not.toThrow()
  })

  it('projects recovery events that need attention into Inbox messages', async () => {
    applyRemoteRecoveryStates([
      {
        serviceId: 'service-admin',
        recovery: recoveryState('service-admin', {
          kind: 'restart',
          serviceId: 'service-admin',
          ok: false,
          message: 'Readiness failed.',
          at: '2026-04-27T00:00:00.000Z',
        }),
      },
    ])

    const inbox = await fetchInboxSummary()
    const recoveryMessage = inbox.messages.find(
      (message) => message.id === 'recovery-service-admin'
    )

    expect(recoveryMessage).toMatchObject({
      title: 'Service Admin UI restart failed readiness',
      summary: 'Readiness failed.',
      category: 'error',
      severity: 'critical',
      read: false,
      hidden: false,
      target: {
        label: 'Service Admin UI',
        href: '/services/service-admin',
        kind: 'service',
      },
    })
    expect(recoveryMessage?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'open_service',
          target: '/services/service-admin',
        }),
        expect.objectContaining({
          kind: 'open_logs',
          target: '/logs?service=service-admin',
        }),
        expect.objectContaining({ kind: 'mark_read' }),
        expect.objectContaining({ kind: 'hide' }),
      ])
    )
    expect(inbox.counts.errors).toBeGreaterThan(0)
  })
})
