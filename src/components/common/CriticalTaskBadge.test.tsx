import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CriticalTaskBadge } from './CriticalTaskBadge'
import { getNextTooltipState, stopTooltipTriggerPropagation } from '../../services/tooltipInteraction'

describe('CriticalTaskBadge', () => {
  it('explains zero slack and formats the projected project end', () => {
    const markup = renderToStaticMarkup(<CriticalTaskBadge slackDays={0} projectedProjectEndDate="2026-10-10" />)
    expect(markup).toContain('Запас по срокам: 0 дней.')
    expect(markup).toContain('Прогноз завершения проекта: 10.10.2026')
    expect(markup).not.toContain('2026-10-10')
  })

  it('shows a positive deficit instead of a negative slack value', () => {
    const markup = renderToStaticMarkup(<CriticalTaskBadge slackDays={-2} projectedProjectEndDate="2026-10-10" />)
    expect(markup).toContain('Дефицит запаса: 2 дня.')
    expect(markup).not.toContain('Дефицит запаса: -2')
  })

  it('opens on focus intent, closes on Escape intent, and toggles on tap intent', () => {
    expect(getNextTooltipState(false, 'open')).toBe(true)
    expect(getNextTooltipState(true, 'close')).toBe(false)
    expect(getNextTooltipState(false, 'toggle')).toBe(true)
    expect(getNextTooltipState(true, 'toggle')).toBe(false)
  })

  it('stops badge interaction from selecting the surrounding task card', () => {
    const stopPropagation = vi.fn()
    stopTooltipTriggerPropagation({ stopPropagation } as unknown as Event)
    expect(stopPropagation).toHaveBeenCalledOnce()
  })
})
