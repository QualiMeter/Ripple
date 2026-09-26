import { describe, expect, it } from 'vitest'
import { formatFullDate, formatIsoDatesInText, getTodayIsoDate } from './date'

describe('full date formatting', () => {
  it('formats an ISO domain date in ru-RU with UTC', () => {
    expect(formatFullDate('2026-06-02')).toBe('02.06.2026')
  })

  it('formats every ISO date in a human-readable analysis message', () => {
    expect(formatIsoDatesInText('Сдвиг: 2026-06-02 → 2026-06-05')).toBe('Сдвиг: 02.06.2026 → 05.06.2026')
  })

  it('builds a date-only value from local calendar fields', () => {
    expect(getTodayIsoDate(new Date(2026, 8, 27, 0, 5))).toBe('2026-09-27')
  })
})
