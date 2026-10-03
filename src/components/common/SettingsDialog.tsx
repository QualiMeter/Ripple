import { useEffect, useState } from 'react'
import { Check, Settings, X } from 'lucide-react'
import { getPanelMode, setPanelMode, type PanelMode } from '../../services/aiPanelPreferences'

interface SettingsDialogProps {
  onClose: () => void
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [mode, setMode] = useState<PanelMode>(getPanelMode)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const updateMode = (nextMode: AiPanelMode) => {
    setMode(nextMode)
    setPanelMode(nextMode)
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#17152b]/40 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Закрыть настройки по фону" />
      <section className="relative z-10 w-full max-w-[520px] overflow-hidden rounded-3xl border border-[#e3e0e9] bg-[#f8f7fa] shadow-[0_28px_80px_rgba(23,21,43,.24)]">
        <header className="flex items-center gap-3 border-b border-[#e5e2ea] bg-white px-6 py-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#efedff] text-[#6757df]"><Settings size={18} /></span>
          <div className="min-w-0 flex-1"><h2 id="settings-title" className="text-base font-bold text-[#302c40]">Настройки</h2><p className="mt-0.5 text-[11px] text-[#8c8797]">Параметры интерфейса Ripple сохраняются в браузере.</p></div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl text-[#777281] hover:bg-[#f3f1f6]" aria-label="Закрыть настройки"><X size={18} /></button>
        </header>
        <div className="space-y-5 p-6">
          <div>
            <p className="text-xs font-bold text-[#4a4557]">Режим боковых панелей</p>
            <p className="mt-1 text-[11px] leading-5 text-[#8a8593]">Выберите, как открывать формы и панели Ripple: справа или по центру экрана.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {([['drawer', 'Боковая панель', 'Справа от рабочего пространства'], ['dialog', 'Центральное окно', 'По центру экрана']] as const).map(([value, title, description]) => {
                const selected = mode === value
                return <button key={value} type="button" onClick={() => updateMode(value)} className={`relative rounded-2xl border p-4 text-left transition ${selected ? 'border-[#bdb5ff] bg-[#f3f1ff] shadow-[0_8px_24px_rgba(109,93,251,.08)]' : 'border-[#e4e1e9] bg-white hover:border-[#cbc6d7]'}`}>
                  <span className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-[#403b4d]">{title}</span>{selected && <span className="grid h-6 w-6 place-items-center rounded-full bg-[#6d5dfb] text-white"><Check size={13} /></span>}</span>
                  <span className="mt-1 block text-[10px] leading-4 text-[#85808f]">{description}</span>
                </button>
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-[10px] leading-4 text-sky-800">Настройка применяется ко всем панелям Ripple и хранится только в локальном хранилище этого браузера.</div>
        </div>
        <footer className="border-t border-[#e5e2ea] bg-white px-6 py-4 text-right"><button type="button" onClick={onClose} className="rounded-xl bg-[#211f37] px-4 py-2.5 text-xs font-bold text-white">Готово</button></footer>
      </section>
    </div>
  )
}
