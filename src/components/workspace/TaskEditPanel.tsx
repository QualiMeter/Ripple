import { useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, Link2, Plus, Save, Trash2, TriangleAlert, Unlink, X } from 'lucide-react'
import type { Assignee, ProjectTask, TaskStatus, TaskUpdateRequest } from '../../types/task'
import type { CreateDependencyRequest, Dependency } from '../../types/dependency'
import { Avatar } from '../common/Avatar'

interface TaskEditPanelProps {
  task: ProjectTask
  assignees: Assignee[]
  tasks: ProjectTask[]
  dependencies: Dependency[]
  onClose: () => void
  onSave: (update: TaskUpdateRequest) => Promise<void>
  onDelete: () => Promise<void>
  onCreateDependency: (request: CreateDependencyRequest) => Promise<void>
  onDeleteDependency: (dependencyId: string) => Promise<void>
}

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: 'not-started', label: 'Не в работе' },
  { value: 'in-progress', label: 'В работе' },
  { value: 'delayed', label: 'Задерживается' },
  { value: 'completed', label: 'Закончено' },
]

export function TaskEditPanel({ task, assignees, tasks, dependencies, onClose, onSave, onDelete, onCreateDependency, onDeleteDependency }: TaskEditPanelProps) {
  const [title, setTitle] = useState(task.title)
  const [startDate, setStartDate] = useState(task.startDate)
  const [endDate, setEndDate] = useState(task.endDate)
  const [assigneeId, setAssigneeId] = useState(task.assigneeId)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [relationDirection, setRelationDirection] = useState<'predecessor' | 'successor'>('predecessor')
  const [relatedTaskId, setRelatedTaskId] = useState(tasks.find((candidate) => candidate.id !== task.id)?.id ?? '')
  const [dependencyError, setDependencyError] = useState<string | null>(null)
  const [isDependencySaving, setIsDependencySaving] = useState(false)
  const [deletingDependencyId, setDeletingDependencyId] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving && !isDeleting) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isDeleting, isSaving, onClose])

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

    setError(null)
    setIsSaving(true)
    try {
      const update: TaskUpdateRequest = {}
      if (title.trim() !== task.title) update.title = title.trim()
      if (startDate !== task.startDate) update.startDate = startDate
      if (endDate !== task.endDate) update.endDate = endDate
      if (assigneeId !== task.assigneeId) update.assigneeId = assigneeId
      if (status !== task.status) update.status = status
      await onSave(update)
    } catch {
      setError('Не удалось сохранить задачу. Попробуйте ещё раз.')
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setError(null)
    setIsDeleting(true)
    try {
      await onDelete()
    } catch {
      setError('Не удалось удалить задачу. Попробуйте ещё раз.')
      setIsDeleting(false)
    }
  }

  const handleCreateDependency = async () => {
    if (!relatedTaskId) return
    setDependencyError(null)
    setIsDependencySaving(true)
    try {
      await onCreateDependency({
        predecessorTaskId: relationDirection === 'predecessor' ? relatedTaskId : task.id,
        successorTaskId: relationDirection === 'predecessor' ? task.id : relatedTaskId,
        type: 'finish-to-start',
      })
    } catch (caughtError) {
      setDependencyError(caughtError instanceof Error ? caughtError.message : 'Не удалось создать зависимость.')
    } finally {
      setIsDependencySaving(false)
    }
  }

  const handleDeleteDependency = async (dependencyId: string) => {
    setDependencyError(null)
    setDeletingDependencyId(dependencyId)
    try {
      await onDeleteDependency(dependencyId)
    } catch (caughtError) {
      setDependencyError(caughtError instanceof Error ? caughtError.message : 'Не удалось удалить зависимость.')
    } finally {
      setDeletingDependencyId(null)
    }
  }

  const selectedAssignee = assignees.find((assignee) => assignee.id === assigneeId)
  const taskById = new Map(tasks.map((candidate) => [candidate.id, candidate]))
  const predecessorDependencies = dependencies.filter((dependency) => dependency.successorTaskId === task.id)
  const successorDependencies = dependencies.filter((dependency) => dependency.predecessorTaskId === task.id)
  const directSuccessors = successorDependencies
    .map((dependency) => taskById.get(dependency.successorTaskId))
    .filter((candidate): candidate is ProjectTask => Boolean(candidate))
  const relationCandidates = tasks.filter((candidate) => candidate.id !== task.id)
  const inputClassName = 'mt-1.5 w-full rounded-xl border border-[#dedce6] bg-white px-3 py-2.5 text-sm text-[#363244] outline-none transition focus:border-[#7667ed] focus:ring-2 focus:ring-[#7667ed]/10'

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#17152b]/25 backdrop-blur-[1px]" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isSaving && !isDeleting && onClose()}>
      <aside className="flex h-full w-full max-w-[440px] flex-col border-l border-[#e2dfe8] bg-[#f8f7fa] shadow-[-24px_0_60px_rgba(23,21,43,.14)]" role="dialog" aria-modal="true" aria-labelledby="task-edit-title">
        <div className="flex items-start justify-between border-b border-[#e5e3ea] bg-white px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#8d8898]">Редактирование задачи</p>
            <h2 id="task-edit-title" className="mt-1 text-lg font-bold tracking-[-.025em] text-[#2d293f]">Параметры и сроки</h2>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving || isDeleting} className="grid h-9 w-9 place-items-center rounded-xl text-[#777281] transition hover:bg-[#f2f0f5] disabled:opacity-50" aria-label="Закрыть панель"><X size={19} /></button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            <div className="rounded-2xl border border-[#e5e2ea] bg-white p-4 shadow-panel">
              <label className="block text-xs font-semibold text-[#615c6d]">
                Название
                <input className={inputClassName} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
              </label>
            </div>

            <div className="rounded-2xl border border-[#e5e2ea] bg-white p-4 shadow-panel">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#494456]"><CalendarDays size={15} className="text-[#6d5dfb]" /> Сроки</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-[#716c7c]">Начало<input type="date" className={inputClassName} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
                <label className="text-xs font-semibold text-[#716c7c]">Завершение<input type="date" className={inputClassName} value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
              </div>
              <p className="mt-3 rounded-lg bg-[#f5f3fa] px-3 py-2 text-[11px] leading-4 text-[#85808f]">Ripple сохранит только введённые даты и покажет возможные конфликты. Сдвиг зависимых задач запускается отдельно.</p>
            </div>

            <div className="rounded-2xl border border-[#e5e2ea] bg-white p-4 shadow-panel">
              <label className="block text-xs font-semibold text-[#615c6d]">
                Ответственный
                <select className={inputClassName} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                  {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name} · {assignee.role}</option>)}
                </select>
              </label>
              {selectedAssignee && <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-[#f7f6f9] p-2.5"><Avatar assignee={selectedAssignee} /><div><p className="text-xs font-semibold text-[#4c4758]">{selectedAssignee.name}</p><p className="text-[10px] text-[#918c9a]">{selectedAssignee.role}</p></div></div>}
              <label className="mt-4 block text-xs font-semibold text-[#615c6d]">
                Статус
                <select className={inputClassName} value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
                  {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-[#e5e2ea] bg-white p-4 shadow-panel">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#494456]"><Link2 size={15} className="text-[#6d5dfb]" /> Зависимости</div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#96909f]">Предшественники</p><div className="mt-2 space-y-1.5">{predecessorDependencies.length === 0 ? <p className="text-[11px] text-[#9a95a2]">Нет связей</p> : predecessorDependencies.map((dependency) => <div key={dependency.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#f7f6f9] px-2.5 py-2"><span className="truncate text-[11px] font-semibold text-[#56505f]">{taskById.get(dependency.predecessorTaskId)?.title ?? 'Задача удалена'}</span><button type="button" onClick={() => handleDeleteDependency(dependency.id)} disabled={deletingDependencyId === dependency.id} className="shrink-0 text-[#aaa4b0] hover:text-rose-600" aria-label="Удалить зависимость"><Unlink size={13} /></button></div>)}</div></div>
                <div><p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#96909f]">Последующие</p><div className="mt-2 space-y-1.5">{successorDependencies.length === 0 ? <p className="text-[11px] text-[#9a95a2]">Нет связей</p> : successorDependencies.map((dependency) => <div key={dependency.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#f7f6f9] px-2.5 py-2"><span className="truncate text-[11px] font-semibold text-[#56505f]">{taskById.get(dependency.successorTaskId)?.title ?? 'Задача удалена'}</span><button type="button" onClick={() => handleDeleteDependency(dependency.id)} disabled={deletingDependencyId === dependency.id} className="shrink-0 text-[#aaa4b0] hover:text-rose-600" aria-label="Удалить зависимость"><Unlink size={13} /></button></div>)}</div></div>
              </div>
              {relationCandidates.length > 0 && <div className="mt-4 border-t border-[#eeebf2] pt-3">
                <div className="grid gap-2">
                  <select className={inputClassName} value={relationDirection} onChange={(event) => setRelationDirection(event.target.value as 'predecessor' | 'successor')} aria-label="Направление новой зависимости"><option value="predecessor">Выбранная задача → текущая</option><option value="successor">Текущая задача → выбранная</option></select>
                  <select className={inputClassName} value={relatedTaskId} onChange={(event) => setRelatedTaskId(event.target.value)} aria-label="Связанная задача">{relationCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}</select>
                  <button type="button" onClick={handleCreateDependency} disabled={isDependencySaving || !relatedTaskId} className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#dcd8ef] bg-[#f7f5ff] px-3 py-2 text-xs font-semibold text-[#6255c9] disabled:opacity-50"><Plus size={14} />{isDependencySaving ? 'Добавление…' : 'Добавить связь'}</button>
                </div>
              </div>}
              {dependencyError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700" role="alert">{dependencyError}</p>}
            </div>

            {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700" role="alert">{error}</p>}

            <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-panel">
              {confirmDelete ? (
                <div>
                  <div className="flex items-start gap-2.5"><TriangleAlert size={17} className="mt-0.5 shrink-0 text-rose-600" /><div><p className="text-xs font-bold text-rose-800">Удалить задачу?</p><p className="mt-1 text-[11px] leading-4 text-[#817b89]">Также будут удалены все связанные зависимости. Это действие нельзя отменить в текущей сессии.</p>{directSuccessors.length > 0 && <div className="mt-2 rounded-lg bg-rose-50 p-2"><p className="text-[10px] font-bold uppercase tracking-wide text-rose-700">Непосредственные последующие задачи</p><p className="mt-1 text-[11px] leading-4 text-rose-700">{directSuccessors.map((successor) => successor.title).join(', ')}</p><p className="mt-1 text-[10px] leading-4 text-rose-600">Связи с ними будут удалены, а даты задач останутся без изменений.</p></div>}</div></div>
                  <div className="mt-3 flex gap-2"><button type="button" disabled={isDeleting} onClick={() => setConfirmDelete(false)} className="flex-1 rounded-xl border border-[#dedbe4] px-3 py-2 text-xs font-semibold text-[#625d6c] disabled:opacity-50">Отмена</button><button type="button" disabled={isDeleting} onClick={handleDelete} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"><Trash2 size={14} />{isDeleting ? 'Удаление…' : 'Удалить'}</button></div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 text-xs font-semibold text-rose-600 hover:text-rose-700"><Trash2 size={15} /> Удалить задачу</button>
              )}
            </div>
          </div>

          <div className="flex gap-3 border-t border-[#e2dfe8] bg-white p-4">
            <button type="button" onClick={onClose} disabled={isSaving || isDeleting} className="flex-1 rounded-xl border border-[#dcd9e3] px-4 py-2.5 text-sm font-semibold text-[#5f5a69] transition hover:bg-[#f6f5f8] disabled:opacity-50">Отмена</button>
            <button type="submit" disabled={isSaving || isDeleting} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#6d5dfb] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(109,93,251,.2)] transition hover:bg-[#5f4fe8] disabled:cursor-wait disabled:opacity-65"><Save size={16} />{isSaving ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        </form>
      </aside>
    </div>
  )
}
