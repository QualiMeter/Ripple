import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { UserPlus, X } from 'lucide-react'

interface EmployeeFormPanelProps {
  title: string
  submitLabel: string
  initialName?: string
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}

export function EmployeeFormPanel({ title, submitLabel, initialName = '', onClose, onSubmit }: EmployeeFormPanelProps) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && !isSaving && onClose()
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSaving, onClose])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Введите имя сотрудника.')
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      await onSubmit(name.trim())
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось сохранить сотрудника.')
      setIsSaving(false)
    }
  }

  return createPortal(<div className="fixed inset-0 z-[80] flex justify-end bg-[#17152b]/35 backdrop-blur-[1px]" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isSaving && onClose()}>
    <aside className="flex h-full w-full max-w-[420px] flex-col border-l border-[#e2dfe8] bg-[#f8f7fa] shadow-[-24px_0_60px_rgba(23,21,43,.16)]" role="dialog" aria-modal="true" aria-labelledby="employee-form-title">
      <div className="flex items-center gap-3 border-b border-[#e5e2ea] bg-white px-5 py-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#efedff] text-[#6757df]"><UserPlus size={18} /></span><div><h2 id="employee-form-title" className="text-base font-bold text-[#302c40]">{title}</h2><p className="mt-0.5 text-[11px] text-[#8c8797]">Сотрудник текущего проекта</p></div><button type="button" onClick={onClose} disabled={isSaving} className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-[#777281] hover:bg-[#f3f1f6] disabled:opacity-50" aria-label="Закрыть форму сотрудника"><X size={18} /></button></div>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col"><div className="flex-1 p-5"><label className="block text-xs font-semibold text-[#575262]">Имя<span className="text-rose-500"> *</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dedbe5] bg-white px-3 py-2.5 text-sm font-medium text-[#363143] outline-none focus:border-[#7667ed]" placeholder="Имя сотрудника" /></label>{error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700" role="alert">{error}</p>}</div><div className="flex gap-2 border-t border-[#e5e2ea] bg-white p-5"><button type="button" onClick={onClose} disabled={isSaving} className="flex-1 rounded-xl border border-[#dedbe5] px-4 py-2.5 text-xs font-semibold text-[#625d6c] disabled:opacity-50">Отмена</button><button type="submit" disabled={isSaving} className="flex-1 rounded-xl bg-[#6d5dfb] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{isSaving ? 'Сохранение…' : submitLabel}</button></div></form>
    </aside>
  </div>, document.body)
}
