import { describe, expect, it, vi } from 'vitest'
import { appendRealtimeWork, isProjectDeletedEvent, notifyProjectDeleted } from './useProjectRealtime'
import type { RealtimeEvent } from './realtimeTypes'

function event(entity: string, action: string): RealtimeEvent {
  return { eventId: `${entity}-${action}`, projectId: 'project', entity, action, entityId: 'entity', data: null, occurredAt: '2026-09-28T00:00:00Z' }
}

describe('realtime workspace orchestration', () => {
  it('continues the event queue after one event fails', async () => {
    const applied: string[] = []
    let queue = appendRealtimeWork(Promise.resolve(), async () => { throw new Error('broken event') })
    queue = appendRealtimeWork(queue, async () => { applied.push('event2') })
    await queue
    expect(applied).toEqual(['event2'])
  })

  it('routes a deleted current project outside workspace delta application', () => {
    const deleted = vi.fn()
    const realtimeEvent = event('project', 'deleted')
    expect(notifyProjectDeleted(realtimeEvent, 'project', deleted)).toBe(true)
    expect(deleted).toHaveBeenCalledWith('project')
    expect(isProjectDeletedEvent(realtimeEvent, 'another-project')).toBe(false)
  })
})
