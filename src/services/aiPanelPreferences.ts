export type PanelMode = 'drawer' | 'dialog'
export type AiPanelMode = PanelMode

const STORAGE_KEY = 'ripple.panel-mode'

export function getPanelMode(): PanelMode {
	if (typeof window === 'undefined') return 'drawer'
	return window.localStorage.getItem(STORAGE_KEY) === 'dialog' ? 'dialog' : 'drawer'
}

export function setPanelMode(mode: PanelMode) {
	if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, mode)
}

export const getAiPanelMode = getPanelMode
export const setAiPanelMode = setPanelMode
