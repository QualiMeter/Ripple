import { useEffect, useMemo, useState } from 'react'
import { FlaskConical, X } from 'lucide-react'
import type { ProjectWorkspace } from '../../types/workspace'
import { addCalendarDays, formatFullDate } from '../../utils/date'
import { buildProjectDeadlineScenario, buildTaskDelayScenario, buildTaskStartScenario } from '../../services/scenario/scenarioEngine'
import type { ProjectScenarioDraft, ProjectScenarioType } from '../../services/scenario/scenarioTypes'

export function ScenarioBuilder({ workspace, onClose, onCreate }: { workspace: ProjectWorkspace; onClose: () => void; onCreate: (draft: ProjectScenarioDraft) => void }) {
  const editableTasks = useMemo(() => workspace.tasks.filter((task) => task.status !== 'completed'), [workspace.tasks])
  const [type, setType] = useState<ProjectScenarioType>('task-delay')
  const [taskId, setTaskId] = useState(editableTasks[0]?.id ?? '')
  const [delayDays, setDelayDays] = useState(4)
  const selectedTask = workspace.tasks.find((task) => task.id === taskId)
  const [newStartDate, setNewStartDate] = useState(selectedTask ? addCalendarDays(selectedTask.startDate, 1) : '')
  const [targetEndDate, setTargetEndDate] = useState(workspace.project.targetEndDate)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedTask) setNewStartDate(addCalendarDays(selectedTask.startDate, 1))
  }, [selectedTask?.id])
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [onClose])

  const submit = () => {
    setError(null)
    try {
      const draft = type === 'task-delay'
        ? buildTaskDelayScenario(workspace, taskId, delayDays)
        : type === 'task-start-shift'
          ? buildTaskStartScenario(workspace, taskId, newStartDate)
          : buildProjectDeadlineScenario(workspace, targetEndDate)
      onCreate(draft)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Не удалось построить сценарий.')
    }
  }

  return <div className="fixed inset-0 z-[90] flex justify-end bg-[#17152b]/45 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-labelledby="scenario-builder-title">
    <button type="button" className="min-w-0 flex-1" onClick={onClose} aria-label="Закрыть окно сценария" />
    <section className="h-full w-full max-w-[460px] overflow-y-auto bg-[#f8f7fa] p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eeeaff] text-[#6556d9]"><FlaskConical size={19} /></span><div><h2 id="scenario-builder-title" className="text-lg font-bold text-[#302d40]">Смоделировать изменение</h2><p className="mt-1 text-[11px] text-[#85808f]">Проверьте последствия без изменения реального проекта.</p></div></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-[#777181] hover:bg-white" aria-label="Закрыть"><X size={18} /></button></div>
      <div className="mt-5 space-y-2" role="radiogroup" aria-label="Тип сценария">{([
        ['task-delay', 'Задача займёт дольше'], ['task-start-shift', 'Задача начнётся позже'], ['project-deadline', 'Изменился дедлайн проекта'],
      ] as const).map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={type === value} onClick={() => setType(value)} className={`w-full rounded-xl border px-3 py-3 text-left text-xs font-bold transition ${type === value ? 'border-[#7768ed] bg-[#eeeaff] text-[#4f43b5]' : 'border-[#e3e0e8] bg-white text-[#514c5e] hover:border-[#cfc9dd]'}`}>{label}</button>)}</div>
      {type !== 'project-deadline' && <label className="mt-5 block text-[11px] font-bold text-[#514c5e]">Задача<select value={taskId} onChange={(event) => setTaskId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dedbe5] bg-white px-3 py-2.5 text-xs font-medium outline-none focus:border-[#7768ed]">{editableTasks.map((task) => <option key={task.id} value={task.id}>{task.title} · {formatFullDate(task.startDate)}–{formatFullDate(task.endDate)}</option>)}</select></label>}
      {type === 'task-delay' && <label className="mt-4 block text-[11px] font-bold text-[#514c5e]">Задержка, календарных дней<input type="number" min={1} max={365} value={delayDays} onChange={(event) => setDelayDays(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[#dedbe5] bg-white px-3 py-2.5 text-xs outline-none focus:border-[#7768ed]" /></label>}
      {type === 'task-start-shift' && <label className="mt-4 block text-[11px] font-bold text-[#514c5e]">Новая дата начала<input type="date" value={newStartDate} min={selectedTask ? addCalendarDays(selectedTask.startDate, 1) : undefined} onChange={(event) => setNewStartDate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dedbe5] bg-white px-3 py-2.5 text-xs outline-none focus:border-[#7768ed]" /></label>}
      {type === 'project-deadline' && <label className="mt-5 block text-[11px] font-bold text-[#514c5e]">Новый срок проекта<input type="date" value={targetEndDate} min={workspace.project.startDate} onChange={(event) => setTargetEndDate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dedbe5] bg-white px-3 py-2.5 text-xs outline-none focus:border-[#7768ed]" /></label>}
      <div className="mt-5 rounded-xl border border-[#dcd7f7] bg-[#f0edff] px-3 py-2.5 text-[10px] leading-4 text-[#625b86]"><strong>Реальный план не изменён.</strong> Ripple пересчитает Гант, прогноз, конфликты и загрузку только в локальном черновике.</div>
      {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[10px] text-rose-700" role="alert">{error}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-[#dedbe5] bg-white px-3 py-2.5 text-xs font-semibold text-[#625d6c]">Отмена</button><button type="button" onClick={submit} disabled={type !== 'project-deadline' && !taskId} className="rounded-xl bg-[#6d5dfb] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">Показать последствия</button></div>
    </section>
  </div>
}
