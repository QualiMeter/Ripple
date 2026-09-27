export interface RealtimeEvent {
  eventId: string
  projectId: string
  entity: string
  action: string
  entityId: string | null
  data: unknown | null
  occurredAt: string
}

export type RealtimeEventHandler = (event: RealtimeEvent) => void
