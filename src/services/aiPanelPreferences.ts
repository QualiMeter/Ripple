export type AiPanelMode = 'drawer' | 'dialog'

const STORAGE_KEY = 'ripple.ai-panel-mode'

export function getAiPanelMode(): AiPanelMode {
  if (typeof window === 'undefined') return 'drawer'
  return window.localStorage.getItem(STORAGE_KEY) === 'dialog' ? 'dialog' : 'drawer'
}

export function setAiPanelMode(mode: AiPanelMode) {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, mode)
}
