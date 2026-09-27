export type TooltipIntent = 'open' | 'close' | 'toggle'

export function getNextTooltipState(current: boolean, intent: TooltipIntent): boolean {
  if (intent === 'open') return true
  if (intent === 'close') return false
  return !current
}

export function stopTooltipTriggerPropagation(event: { stopPropagation(): void }): void {
  event.stopPropagation()
}
