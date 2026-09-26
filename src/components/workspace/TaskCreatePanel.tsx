import { useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, Plus, X } from 'lucide-react'
import type { Assignee, TaskCreateRequest, TaskStatus } from '../../types/task'
import { Avatar } from '../common/Avatar'
import type { Employee } from '../../types/employee'
import { EmployeeCreateAction } from '../employees/EmployeeCreateAction'

interface TaskCreatePanelProps {
  assignees: Assignee[]
  initialStartDate: string
  onClose: () => void
  onCreate: (request: TaskCreateRequest) => Promise<void>
  onCreateEmployee: (name: string) => Promise<Employee>
}

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: 'not-started', label: 'Не в работе' },
  { value: 'in-progress', label: 'В работе' },
  { value: 'delayed', label: 'Задерживается' },
  { value: 'completed', label: 'Закончено' },
]

export function TaskCreatePanel({ assignees, initialStartDate, onClose, onCreate, onCreateEmployee }: TaskCreatePanelProps) {
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialStartDate)
  const [assigneeId, setAssigneeId] = useState(assignees[0]?.id ?? '')
  const [status, setStatus] = useState<TaskStatus>('not-started')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSaving, onClose])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      setError('Введите название задачи.')
      return
    }
    if (!startDate || !endDate || endDate < startDate) {
      setError('Дата завершения не может быть раньше даты начала.')
      return
    }
    if (!assigneeId) {
      setError('Выберите ответственного.')
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      await onCreate({
        title: title.trim(),
        startDate,
        endDate,
        assigneeId,
        status,
      })
    } catch {
      setError('Не удалось создать задачу. Попробуйте ещё раз.')
      setIsSaving(false)
    }
  }

  const selectedAssignee = assignees.find((assignee) => assignee.id === assigneeId)
  const inputClassName = 'mt-1.5 w-full rounded-xl border border-[#dedce6] bg-white px-3 py-2.5 text-sm text-[#363244] outline-none transition focus:border-[#7667ed] focus:ring-2 focus:ring-[#7667ed]/10'

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#17152b]/25 backdrop-blur-[1px]" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isSaving && onClose()}>
      <aside className="flex h-full w-full max-w-[440px] flex-col border-l border-[#e2dfe8] bg-[#f8f7fa] shadow-[-24px_0_60px_rgba(23,21,43,.14)]" role="dialog" aria-modal="true" aria-labelledby="task-create-title">
        <div className="flex items-start justify-between border-b border-[#e5e3ea] bg-white px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#8d8898]">Новая задача</p>
            <h2 id="task-create-title" className="mt-1 text-lg font-bold tracking-[-.025em] text-[#2d293f]">Параметры и сроки</h2>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="grid h-9 w-9 place-items-center rounded-xl text-[#777281] transition hover:bg-[#f2f0f5] disabled:opacity-50" aria-label="Закрыть панель"><X size={19} /></button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            <div className="rounded-2xl border border-[#e5e2ea] bg-white p-4 shadow-panel">
              <label className="block text-xs font-semibold text-[#615c6d]">Название<input className={inputClassName} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /></label>
            </div>

            <div className="rounded-2xl border border-[#e5e2ea] bg-white p-4 shadow-panel">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#494456]"><CalendarDays size={15} className="text-[#6d5dfb]" /> Сроки</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-[#716c7c]">Начало<input type="date" className={inputClassName} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
                <label className="text-xs font-semibold text-[#716c7c]">Завершение<input type="date" className={inputClassName} value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
              </div>
              <p className="mt-3 rounded-lg bg-[#f5f3fa] px-3 py-2 text-[11px] leading-4 text-[#85808f]">Введённые даты станут исходным планом новой задачи.</p>
            </div>

            <div className="rounded-2xl border border-[#e5e2ea] bg-white p-4 shadow-panel">
              {assignees.length > 0 ? <label className="block text-xs font-semibold text-[#615c6d]">Ответственный<select className={inputClassName} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>{assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}{assignee.role ? ` · ${assignee.role}` : ''}</option>)}</select></label> : <div className="rounded-xl border border-dashed border-[#d9d5e0] bg-[#faf9fb] p-3"><p className="text-xs font-semibold text-[#5c5766]">В проекте пока нет сотрудников</p><p className="mt-1 text-[10px] leading-4 text-[#918c9a]">Добавьте сотрудника, чтобы назначить ответственного.</p></div>}
              {selectedAssignee && <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-[#f7f6f9] p-2.5"><Avatar assignee={selectedAssignee} /><div><p className="text-xs font-semibold text-[#4c4758]">{selectedAssignee.name}</p><p className="text-[10px] text-[#918c9a]">{selectedAssignee.role}</p></div></div>}
              <EmployeeCreateAction onCreate={onCreateEmployee} onCreated={(employee) => setAssigneeId(employee.id)} />
              <label className="mt-4 block text-xs font-semibold text-[#615c6d]">Статус<select className={inputClassName} value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>

            {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700" role="alert">{error}</p>}
          </div>

          <div className="flex gap-3 border-t border-[#e2dfe8] bg-white p-4">
            <button type="button" onClick={onClose} disabled={isSaving} className="flex-1 rounded-xl border border-[#dcd9e3] px-4 py-2.5 text-sm font-semibold text-[#5f5a69] transition hover:bg-[#f6f5f8] disabled:opacity-50">Отмена</button>
            <button type="submit" disabled={isSaving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#6d5dfb] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(109,93,251,.2)] transition hover:bg-[#5f4fe8] disabled:cursor-wait disabled:opacity-65"><Plus size={16} />{isSaving ? 'Создание…' : 'Создать задачу'}</button>
          </div>
        </form>
      </aside>
    </div>
  )
}
