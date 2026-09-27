const dayMs = 86_400_000

export function getTodayIsoDate(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

export function formatFullDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
}

export function addCalendarDays(value: string, days: number): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function formatIsoDatesInText(value: string): string {
  return value.replace(/\b\d{4}-\d{2}-\d{2}\b/g, formatFullDate)
}

export function formatAnalysisTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(value))
}

export function calendarDaysBetween(start: string, end: string): number {
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / dayMs))
}
