import { describe, expect, it } from 'vitest'
import { apiBaseUrl, apiUrl, realtimeBaseUrl, realtimeUrl } from './api'

describe('backend URL configuration', () => {
  it('builds REST URLs from the /api base without duplicating the prefix', () => {
    expect(apiBaseUrl).toBe('https://mvp-action.up.railway.app/api')
    expect(apiUrl('/v1/projects')).toBe('https://mvp-action.up.railway.app/api/v1/projects')
    expect(apiUrl('v1/projects')).not.toContain('/api/api/v1/')
  })

  it('builds the SignalR URL from the backend origin outside the REST prefix', () => {
    expect(realtimeBaseUrl).toBe('https://mvp-action.up.railway.app')
    expect(realtimeUrl('/hubs/projects')).toBe('https://mvp-action.up.railway.app/hubs/projects')
    expect(realtimeUrl('/hubs/projects')).not.toContain('/api/hubs/projects')
  })
})
