import { HubConnectionBuilder, HubConnectionState, type HubConnection } from '@microsoft/signalr'
import { apiUrl, isHttpApiMode } from '../config/api'
import type { RealtimeEvent, RealtimeEventHandler } from './realtimeTypes'

export interface RealtimeConnection {
  state: HubConnectionState
  start(): Promise<void>
  stop(): Promise<void>
  invoke(methodName: string, ...args: unknown[]): Promise<unknown>
  on(methodName: string, handler: (...args: unknown[]) => void): void
  onreconnecting(handler: (error?: Error) => void): void
  onreconnected(handler: (connectionId?: string) => void): void
  onclose(handler: (error?: Error) => void): void
}

export interface ProjectRealtimeOptions {
  enabled?: boolean
  connectionFactory?: () => RealtimeConnection
  eventCacheSize?: number
  retryDelaysMs?: number[]
}

export class ProjectRealtime {
  private readonly enabled: boolean
  private readonly connectionFactory: () => RealtimeConnection
  private readonly eventCacheSize: number
  private readonly retryDelaysMs: number[]
  private connection: RealtimeConnection | null = null
  private startPromise: Promise<boolean> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryAttempt = 0
  private currentProjectId: string | null = null
  private joinedProjectId: string | null = null
  private readonly handlers = new Set<RealtimeEventHandler>()
  private readonly resyncHandlers = new Set<(projectId: string) => void>()
  private readonly recentEventIds = new Set<string>()
  private readonly recentEventQueue: string[] = []

  constructor(options: ProjectRealtimeOptions = {}) {
    this.enabled = options.enabled ?? isHttpApiMode
    this.eventCacheSize = options.eventCacheSize ?? 300
    this.retryDelaysMs = options.retryDelaysMs ?? [1_000, 2_000, 5_000, 10_000]
    this.connectionFactory = options.connectionFactory ?? (() => new HubConnectionBuilder()
      .withUrl(apiUrl('/hubs/projects'))
      .withAutomaticReconnect()
      .build() as HubConnection)
  }

  private getConnection(): RealtimeConnection | null {
    if (!this.enabled) return null
    if (this.connection) return this.connection
    const connection = this.connectionFactory()
    connection.on('projectChanged', (...args) => this.dispatch(args[0]))
    connection.onreconnecting(() => { this.joinedProjectId = null })
    connection.onreconnected(() => { void this.handleReconnected() })
    connection.onclose(() => {
      this.startPromise = null
      this.joinedProjectId = null
      this.scheduleRetry()
    })
    this.connection = connection
    return connection
  }

  private dispatch(value: unknown): void {
    if (!isRealtimeEvent(value)) return
    if (this.recentEventIds.has(value.eventId)) return
    this.recentEventIds.add(value.eventId)
    this.recentEventQueue.push(value.eventId)
    while (this.recentEventQueue.length > this.eventCacheSize) {
      this.recentEventIds.delete(this.recentEventQueue.shift()!)
    }
    for (const handler of this.handlers) handler(value)
  }

  private async handleReconnected(): Promise<void> {
    const projectId = this.currentProjectId
    if (!projectId || !this.connection) return
    try {
      await this.connection.invoke('JoinProject', projectId)
      this.joinedProjectId = projectId
      this.retryAttempt = 0
      this.cancelRetry()
      for (const handler of this.resyncHandlers) handler(projectId)
    } catch {
      this.scheduleRetry()
    }
  }

  private cancelRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
  }

  private scheduleRetry(): void {
    if (!this.enabled || !this.currentProjectId || this.retryTimer) return
    const delay = this.retryDelaysMs[Math.min(this.retryAttempt, this.retryDelaysMs.length - 1)] ?? 10_000
    this.retryAttempt += 1
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.retryCurrentProject()
    }, delay)
  }

  private async retryCurrentProject(): Promise<void> {
    const projectId = this.currentProjectId
    if (!projectId) return
    const connected = await this.connect()
    if (!connected) {
      this.scheduleRetry()
      return
    }
    if (this.currentProjectId !== projectId || !this.connection) return
    try {
      await this.connection.invoke('JoinProject', projectId)
      if (this.currentProjectId !== projectId) return
      this.joinedProjectId = projectId
      this.retryAttempt = 0
      this.cancelRetry()
      for (const handler of this.resyncHandlers) handler(projectId)
    } catch {
      this.scheduleRetry()
    }
  }

  async connect(): Promise<boolean> {
    const connection = this.getConnection()
    if (!connection) return false
    if (connection.state === HubConnectionState.Connected) return true
    if (this.startPromise) return this.startPromise
    this.startPromise = connection.start()
      .then(() => true)
      .catch(() => false)
      .finally(() => { this.startPromise = null })
    return this.startPromise
  }

  async disconnect(): Promise<void> {
    const connection = this.connection
    this.currentProjectId = null
    this.joinedProjectId = null
    this.cancelRetry()
    this.retryAttempt = 0
    if (connection && connection.state !== HubConnectionState.Disconnected) await connection.stop().catch(() => undefined)
  }

  async joinProject(projectId: string): Promise<void> {
    const previousProjectId = this.currentProjectId
    if (previousProjectId !== projectId) {
      this.cancelRetry()
      this.retryAttempt = 0
    }
    this.currentProjectId = projectId
    const connected = await this.connect()
    const connection = this.connection
    if (!connected || !connection) {
      if (this.currentProjectId === projectId) this.scheduleRetry()
      return
    }
    if (previousProjectId && previousProjectId !== projectId) await connection.invoke('LeaveProject', previousProjectId).catch(() => undefined)
    if (this.currentProjectId === projectId) {
      await connection.invoke('JoinProject', projectId)
        .then(() => {
          this.joinedProjectId = projectId
          this.retryAttempt = 0
          this.cancelRetry()
        })
        .catch(() => this.scheduleRetry())
    }
  }

  async leaveProject(projectId: string): Promise<void> {
    if (this.currentProjectId === projectId) {
      this.currentProjectId = null
      this.cancelRetry()
      this.retryAttempt = 0
    }
    if (this.joinedProjectId === projectId) this.joinedProjectId = null
    if (this.connection?.state === HubConnectionState.Connected) await this.connection.invoke('LeaveProject', projectId).catch(() => undefined)
  }

  onProjectChanged(callback: RealtimeEventHandler): () => void {
    this.handlers.add(callback)
    return () => this.handlers.delete(callback)
  }

  onResyncRequired(callback: (projectId: string) => void): () => void {
    this.resyncHandlers.add(callback)
    return () => this.resyncHandlers.delete(callback)
  }

  isConnected(): boolean {
    return this.connection?.state === HubConnectionState.Connected
  }

  isProjectJoined(projectId: string): boolean {
    return this.isConnected() && this.joinedProjectId === projectId
  }
}

function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<RealtimeEvent>
  return typeof event.eventId === 'string'
    && typeof event.projectId === 'string'
    && typeof event.entity === 'string'
    && typeof event.action === 'string'
    && (event.entityId === null || typeof event.entityId === 'string')
}

export const projectRealtime = new ProjectRealtime()
