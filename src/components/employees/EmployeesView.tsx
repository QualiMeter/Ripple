import { useState } from 'react'
import { CalendarDays, Pencil, Plus, Trash2, UserRound, Users, X } from 'lucide-react'
import type { Employee } from '../../types/employee'
import type { ProjectTask } from '../../types/task'
import { formatShortDate } from '../../utils/date'
import { pluralizeRu } from '../../utils/plural'
import { Avatar } from '../common/Avatar'
import { StatusBadge } from '../common/StatusBadge'
import { EmployeeFormPanel } from './EmployeeFormPanel'

interface EmployeesViewProps {
  employees: Employee[]
  tasks: ProjectTask[]
  historyMode?: 'local' | 'server'
  onCreateEmployee: (name: string) => Promise<Employee>
  onUpdateEmployee: (employeeId: string, name: string) => Promise<Employee>
  onDeleteEmployee: (employeeId: string) => Promise<void>
  onTaskSelect: (task: ProjectTask) => void
}

export function EmployeesView({ employees, tasks, historyMode = 'local', onCreateEmployee, onUpdateEmployee, onDeleteEmployee, onTaskSelect }: EmployeesViewProps) {
  const [creating, setCreating] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId)
  const editingEmployee = employees.find((employee) => employee.id === editingEmployeeId)
  const deletingEmployee = employees.find((employee) => employee.id === deletingEmployeeId)
  const deletingEmployeeTasks = deletingEmployee ? tasks.filter((task) => task.assigneeId === deletingEmployee.id) : []

  const createEmployee = async (name: string) => {
    const employee = await onCreateEmployee(name)
    setCreating(false)
    setSelectedEmployeeId(employee.id)
  }
  const updateEmployee = async (name: string) => {
    if (!editingEmployee) return
    await onUpdateEmployee(editingEmployee.id, name)
    setEditingEmployeeId(null)
  }
  const deleteEmployee = async () => {
    if (!deletingEmployee || deletingEmployeeTasks.length > 0) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await onDeleteEmployee(deletingEmployee.id)
      setDeletingEmployeeId(null)
      setSelectedEmployeeId(null)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Не удалось удалить сотрудника.')
    } finally {
      setIsDeleting(false)
    }
  }

  return <>
    <section className="overflow-hidden rounded-2xl border border-[#e5e3eb] bg-white shadow-panel">
      <div className="flex items-center justify-between gap-3 border-b border-[#ebe9ef] px-5 py-4"><div><h2 className="text-sm font-bold text-[#302d40]">Сотрудники проекта</h2><p className="mt-0.5 text-[11px] text-[#918d9b]">Ответственные и назначенные им задачи</p></div><button type="button" onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-lg bg-[#25223b] px-3 py-2 text-[11px] font-semibold text-white"><Plus size={14} /> Добавить сотрудника</button></div>
      {employees.length === 0 ? <div className="grid min-h-64 place-items-center px-6 py-14 text-center"><div><Users size={26} className="mx-auto text-[#887de2]" /><p className="mt-3 text-sm font-semibold text-[#4b4658]">В проекте пока нет сотрудников</p><p className="mt-1 text-[11px] text-[#918d9b]">Добавьте сотрудника, чтобы назначать ему задачи</p><button type="button" onClick={() => setCreating(true)} className="mt-4 rounded-xl bg-[#6d5dfb] px-4 py-2.5 text-xs font-bold text-white">Добавить сотрудника</button></div></div> : <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">{employees.map((employee) => {
        const employeeTasks = tasks.filter((task) => task.assigneeId === employee.id)
        return <button key={employee.id} type="button" onClick={() => setSelectedEmployeeId(employee.id)} className="rounded-2xl border border-[#e5e2ea] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#cfc9e8] hover:shadow-md"><div className="flex items-center gap-3"><Avatar assignee={employee} /><div className="min-w-0"><p className="truncate text-sm font-bold text-[#413c4e]">{employee.name}</p><p className="mt-0.5 text-[10px] text-[#918c9a]">{employeeTasks.length} {pluralizeRu(employeeTasks.length, ['задача', 'задачи', 'задач'])}</p></div></div><div className="mt-3 flex flex-wrap gap-1.5">{employeeTasks.slice(0, 3).map((task) => <span key={task.id} className="max-w-full truncate rounded-full bg-[#f2f0f7] px-2 py-1 text-[9px] font-semibold text-[#655f70]">{task.title}</span>)}{employeeTasks.length === 0 && <span className="text-[10px] text-[#aaa5b2]">Нет назначенных задач</span>}{employeeTasks.length > 3 && <span className="rounded-full bg-[#eeeaff] px-2 py-1 text-[9px] font-bold text-[#6557cc]">+{employeeTasks.length - 3}</span>}</div></button>
      })}</div>}
    </section>
    {selectedEmployee && <div className="fixed inset-0 z-[70] flex justify-end bg-[#17152b]/30 backdrop-blur-[1px]" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedEmployeeId(null)}><aside className="flex h-full w-full max-w-[440px] flex-col bg-[#f8f7fa] shadow-[-24px_0_60px_rgba(23,21,43,.16)]" role="dialog" aria-modal="true" aria-labelledby="employee-details-title"><div className="flex items-center gap-3 border-b border-[#e5e2ea] bg-white px-5 py-4"><Avatar assignee={selectedEmployee} /><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#918b99]">Карточка сотрудника</p><h2 id="employee-details-title" className="truncate text-base font-bold text-[#302c40]">{selectedEmployee.name}</h2></div><button type="button" onClick={() => { setEditingEmployeeId(selectedEmployee.id); setSelectedEmployeeId(null) }} className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-[#686274] hover:bg-[#f3f1f6]" aria-label="Редактировать сотрудника"><Pencil size={16} /></button><button type="button" onClick={() => { setDeleteError(null); setDeletingEmployeeId(selectedEmployee.id) }} className="grid h-9 w-9 place-items-center rounded-xl text-rose-600 hover:bg-rose-50" aria-label="Удалить сотрудника"><Trash2 size={16} /></button><button type="button" onClick={() => setSelectedEmployeeId(null)} className="grid h-9 w-9 place-items-center rounded-xl text-[#777281] hover:bg-[#f3f1f6]" aria-label="Закрыть карточку сотрудника"><X size={18} /></button></div><div className="flex-1 overflow-y-auto p-5"><h3 className="flex items-center gap-2 text-xs font-bold text-[#4b4658]"><UserRound size={15} className="text-[#6d5dfb]" /> Назначенные задачи</h3><div className="mt-3 space-y-2">{tasks.filter((task) => task.assigneeId === selectedEmployee.id).map((task) => <button key={task.id} type="button" onClick={() => { setSelectedEmployeeId(null); onTaskSelect(task) }} className="w-full rounded-xl border border-[#e4e1e8] bg-white p-3 text-left hover:border-[#cfc9e8]"><div className="flex items-start justify-between gap-2"><p className="text-xs font-bold text-[#494452]">{task.title}</p><StatusBadge status={task.status} risk={task.riskState} /></div><p className="mt-2 flex items-center gap-1.5 text-[10px] text-[#837e8d]"><CalendarDays size={12} /> {formatShortDate(task.startDate)} — {formatShortDate(task.endDate)}</p></button>)}{tasks.every((task) => task.assigneeId !== selectedEmployee.id) && <p className="rounded-xl border border-dashed border-[#dcd8e3] px-4 py-8 text-center text-xs text-[#918c9a]">У сотрудника пока нет назначенных задач.</p>}</div></div></aside></div>}
    {creating && <EmployeeFormPanel title="Новый сотрудник" submitLabel="Добавить" onClose={() => setCreating(false)} onSubmit={createEmployee} />}
    {editingEmployee && <EmployeeFormPanel title="Редактирование сотрудника" submitLabel="Сохранить" initialName={editingEmployee.name} onClose={() => setEditingEmployeeId(null)} onSubmit={updateEmployee} />}
    {deletingEmployee && <div className="fixed inset-0 z-[85] grid place-items-end bg-[#17152b]/40 p-0 sm:place-items-center sm:p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isDeleting && setDeletingEmployeeId(null)}><section className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="employee-delete-title"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600"><Trash2 size={18} /></span><div className="min-w-0"><h2 id="employee-delete-title" className="text-base font-bold text-[#302c40]">{deletingEmployeeTasks.length > 0 ? 'Нельзя удалить сотрудника' : `Удалить сотрудника «${deletingEmployee.name}»?`}</h2><p className="mt-1 text-xs leading-5 text-[#777181]">{deletingEmployeeTasks.length > 0 ? `На него назначено ${deletingEmployeeTasks.length} ${pluralizeRu(deletingEmployeeTasks.length, ['задача', 'задачи', 'задач'])}. Сначала измените ответственных.` : historyMode === 'server' ? 'Удаление будет записано в историю проекта. Если операция доступна для отката, сотрудника можно будет восстановить из раздела «История».' : 'Сотрудник будет удалён из текущего проекта. В локальном режиме это действие нельзя точно восстановить.'}</p></div></div>{deletingEmployeeTasks.length > 0 && <ul className="mt-4 max-h-44 space-y-1.5 overflow-y-auto rounded-xl bg-[#f7f5f9] p-3 text-xs text-[#565061]">{deletingEmployeeTasks.map((task) => <li key={task.id}>• {task.title}</li>)}</ul>}{deleteError && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{deleteError}</p>}<div className={`mt-5 grid gap-2 ${deletingEmployeeTasks.length > 0 ? '' : 'grid-cols-2'}`}><button type="button" disabled={isDeleting} onClick={() => setDeletingEmployeeId(null)} className="rounded-xl border border-[#dedbe4] px-3 py-2.5 text-xs font-semibold">{deletingEmployeeTasks.length > 0 ? 'Закрыть' : 'Отмена'}</button>{deletingEmployeeTasks.length === 0 && <button type="button" disabled={isDeleting} onClick={deleteEmployee} className="rounded-xl bg-rose-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">{isDeleting ? 'Удаление…' : 'Удалить'}</button>}</div></section></div>}
  </>
}
