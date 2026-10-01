import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CalendarDays, Upload, X } from 'lucide-react'
import type { CreateProjectRequest } from '../../types/project'
import { validateProjectInput } from '../../services/projectValidation'

interface ProjectFormPanelProps {
  title: string
  submitLabel: string
  initialValues: CreateProjectRequest
  onClose: () => void
  onSubmit: (values: CreateProjectRequest) => Promise<void>
  onImport?: (file: File) => Promise<void>
}

export function ProjectFormPanel({ title, submitLabel, initialValues, onClose, onSubmit, onImport }: ProjectFormPanelProps) {
  const [values, setValues] = useState(initialValues)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const submitInFlightRef = useRef(false)
  const importInFlightRef = useRef(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const isBusy = isSaving || isImporting

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isBusy, onClose])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitInFlightRef.current || importInFlightRef.current) return
    setError(null)
    try {
      validateProjectInput(values)
      submitInFlightRef.current = true
      setIsSaving(true)
      await onSubmit({ ...values, name: values.name.trim() })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось сохранить проект.')
    } finally {
      submitInFlightRef.current = false
      setIsSaving(false)
    }
  }

  const handleImport = async (file: File) => {
    if (!onImport || importInFlightRef.current || submitInFlightRef.current) return
    importInFlightRef.current = true
    setIsImporting(true)
    setError(null)
    try {
      await onImport(file)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось импортировать проект.')
    } finally {
      importInFlightRef.current = false
      setIsImporting(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-[#17152b]/35 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-labelledby="project-form-title">
      <button type="button" className="min-w-0 flex-1" onClick={onClose} aria-label="Закрыть форму проекта по фону" />
      <aside className="flex h-full w-full max-w-[440px] flex-col bg-[#f8f7fa] shadow-[-24px_0_60px_rgba(23,21,43,.18)]">
        <div className="flex items-center gap-3 border-b border-[#e5e2ea] bg-white px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#efedff] text-[#6757df]"><CalendarDays size={18} /></span>
          <div><h2 id="project-form-title" className="text-base font-bold text-[#302c40]">{title}</h2><p className="mt-0.5 text-[11px] text-[#8c8797]">Основные сроки и название проекта</p></div>
          <button type="button" onClick={onClose} disabled={isBusy} className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-[#777281] hover:bg-[#f3f1f6] disabled:opacity-50" aria-label="Закрыть форму проекта"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <label className="block text-xs font-semibold text-[#575262]">Название<span className="text-rose-500"> *</span><input autoFocus required value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#dedbe5] bg-white px-3 py-2.5 text-sm font-medium text-[#363143] outline-none focus:border-[#7667ed]" placeholder="Название проекта" /></label>
            <label className="block text-xs font-semibold text-[#575262]">Дата начала<span className="text-rose-500"> *</span><input type="date" required value={values.startDate} onChange={(event) => setValues((current) => ({ ...current, startDate: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#dedbe5] bg-white px-3 py-2.5 text-sm text-[#363143] outline-none focus:border-[#7667ed]" /></label>
            <label className="block text-xs font-semibold text-[#575262]">Плановая дата окончания<span className="text-rose-500"> *</span><input type="date" required value={values.targetEndDate} onChange={(event) => setValues((current) => ({ ...current, targetEndDate: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#dedbe5] bg-white px-3 py-2.5 text-sm text-[#363143] outline-none focus:border-[#7667ed]" /></label>
            <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-[11px] leading-4 text-sky-800">Изменение границ проекта не переносит даты задач. Возможные выходы за границы будут показаны как предупреждения.</p>
            {onImport && <div className="pt-1">
              <div className="mb-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#aaa6b4]"><span className="h-px flex-1 bg-[#e5e2ea]" />или<span className="h-px flex-1 bg-[#e5e2ea]" /></div>
              <button type="button" disabled={isBusy} onClick={() => importInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#d8d4e2] bg-white px-4 py-2.5 text-xs font-semibold text-[#575262] transition hover:border-[#bcb5df] hover:bg-[#f8f7ff] disabled:opacity-60"><Upload size={15} />{isImporting ? 'Импорт проекта…' : 'Импортировать проект из файла'}</button>
              <input ref={importInputRef} type="file" accept=".ripple.json,application/json" className="hidden" aria-label="Файл импорта проекта" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImport(file) }} />
              <p className="mt-2 text-center text-[10px] leading-4 text-[#918c9b]">Импорт создаст новый проект из файла Ripple.</p>
            </div>}
            {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700" role="alert">{error}</p>}
          </div>
          <div className="flex gap-2 border-t border-[#e5e2ea] bg-white p-5"><button type="button" onClick={onClose} disabled={isBusy} className="flex-1 rounded-xl border border-[#dedbe5] px-4 py-2.5 text-xs font-semibold text-[#625d6c] disabled:opacity-50">Отмена</button><button type="submit" disabled={isBusy} className="flex-1 rounded-xl bg-[#6d5dfb] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{isSaving ? 'Сохранение…' : submitLabel}</button></div>
        </form>
      </aside>
    </div>
  )
}
