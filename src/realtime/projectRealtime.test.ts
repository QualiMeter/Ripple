import { HubConnectionState } from '@microsoft/signalr'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectRealtime, type RealtimeConnection } from './projectRealtime'
import type { RealtimeEvent } from './realtimeTypes'

class FakeConnection implements RealtimeConnection {
  state = HubConnectionState.Disconnected
  readonly invoke = vi.fn(async () => undefined)
  readonly start = vi.fn(async () => { this.state = HubConnectionState.Connected })
  readonly stop = vi.fn(async () => { this.state = HubConnectionState.Disconnected })
  private events = new Map<string, (...args: unknown[]) => void>()
  private reconnected?: (connectionId?: string) => void

  on(name: string, handler: (...args: unknown[]) => void) { this.events.set(name, handler) }
  onreconnecting(_handler: (error?: Error) => void) {}
  onreconnected(handler: (connectionId?: string) => void) { this.reconnected = handler }
  onclose(_handler: (error?: Error) => void) {}
  emit(name: string, value: unknown) { this.events.get(name)?.(value) }
  reconnect() { this.state = HubConnectionState.Connected; this.reconnected?.('connection') }
}

function event(id: string): RealtimeEvent {
  return { eventId: id, projectId: 'project', entity: 'task', action: 'updated', entityId: 'task', data: null, occurredAt: '2026-09-27T00:00:00Z' }
}

describe('ProjectRealtime', () => {
  afterEach(() => vi.useRealTimers())

  it('connects once, joins and leaves project groups', async () => {
    const connection = new FakeConnection()
    const realtime = new ProjectRealtime({ enabled: true, connectionFactory: () => connection })
    await realtime.joinProject('project')
    expect(realtime.isProjectJoined('project')).toBe(true)
    await realtime.leaveProject('project')
    expect(realtime.isProjectJoined('project')).toBe(false)
    expect(connection.invoke.mock.calls).toEqual([['JoinProject', 'project'], ['LeaveProject', 'project']])
  })

  it('deduplicates projectChanged events by eventId', async () => {
    const connection = new FakeConnection()
    const realtime = new ProjectRealtime({ enabled: true, connectionFactory: () => connection })
    const handler = vi.fn()
    realtime.onProjectChanged(handler)
    await realtime.connect()
    connection.emit('projectChanged', event('same'))
    connection.emit('projectChanged', event('same'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('rejoins and requests one resync after reconnect', async () => {
    const connection = new FakeConnection()
    const realtime = new ProjectRealtime({ enabled: true, connectionFactory: () => connection })
    const resync = vi.fn()
    realtime.onResyncRequired(resync)
    await realtime.joinProject('project')
    connection.reconnect()
    await Promise.resolve()
    await Promise.resolve()
    expect(connection.invoke).toHaveBeenLastCalledWith('JoinProject', 'project')
    expect(resync).toHaveBeenCalledTimes(1)
    expect(resync).toHaveBeenCalledWith('project')
  })

  it('does not create a connection in mock mode', async () => {
    const factory = vi.fn(() => new FakeConnection())
    const realtime = new ProjectRealtime({ enabled: false, connectionFactory: factory })
    expect(await realtime.connect()).toBe(false)
    expect(factory).not.toHaveBeenCalled()
  })

  it('retries a failed initial start, joins and requests a resync after recovery', async () => {
    vi.useFakeTimers()
    const connection = new FakeConnection()
    connection.start
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(async () => { connection.state = HubConnectionState.Connected })
    const realtime = new ProjectRealtime({ enabled: true, connectionFactory: () => connection, retryDelaysMs: [1_000, 2_000] })
    const resync = vi.fn()
    realtime.onResyncRequired(resync)

    await realtime.joinProject('project')
    expect(connection.start).toHaveBeenCalledTimes(1)
    expect(connection.invoke).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(connection.start).toHaveBeenCalledTimes(2)
    expect(connection.invoke).toHaveBeenCalledWith('JoinProject', 'project')
    expect(resync).toHaveBeenCalledWith('project')
  })

  it('cancels a pending initial retry when the project is left', async () => {
    vi.useFakeTimers()
    const connection = new FakeConnection()
    connection.start.mockRejectedValue(new Error('offline'))
    const realtime = new ProjectRealtime({ enabled: true, connectionFactory: () => connection, retryDelaysMs: [1_000] })
    await realtime.joinProject('project')
    await realtime.leaveProject('project')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(connection.start).toHaveBeenCalledTimes(1)
  })

  it('shares one concurrent start attempt', async () => {
    let resolveStart!: () => void
    const connection = new FakeConnection()
    connection.start.mockImplementation(() => new Promise<void>((resolve) => {
      resolveStart = () => { connection.state = HubConnectionState.Connected; resolve() }
    }))
    const realtime = new ProjectRealtime({ enabled: true, connectionFactory: () => connection })
    const first = realtime.joinProject('project')
    const second = realtime.joinProject('project')
    expect(connection.start).toHaveBeenCalledTimes(1)
    resolveStart()
    await Promise.all([first, second])
    expect(connection.start).toHaveBeenCalledTimes(1)
  })
})
