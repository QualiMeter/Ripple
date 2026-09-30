import { describe, expect, it } from 'vitest'
import { apiBaseUrl, apiUrl, realtimeBaseUrl, realtimeUrl } from './api'

describe('backend URL configuration', () => {
  it('builds REST URLs from the /api base without duplicating the prefix', () => {
    expect(apiBaseUrl).toBe('https://92.63.102.15/api')
    expect(apiUrl('/v1/projects')).toBe('https://92.63.102.15/api/v1/projects')
    expect(apiUrl('v1/projects')).not.toContain('/api/api/v1/')
  })

  it('builds the SignalR URL from the backend origin outside the REST prefix', () => {
    expect(realtimeBaseUrl).toBe('https://92.63.102.15')
    expect(realtimeUrl('/hubs/projects')).toBe('https://92.63.102.15/hubs/projects')
    expect(realtimeUrl('/hubs/projects')).not.toContain('/api/hubs/projects')
  })
})
