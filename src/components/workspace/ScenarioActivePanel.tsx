import { useRef, useState } from 'react'
import { ArrowRight, FlaskConical } from 'lucide-react'
import type { ProjectWorkspace } from '../../types/workspace'
import { buildScenarioImpact } from '../../services/scenario/scenarioImpact'
import type { ProjectScenarioDraft } from '../../services/scenario/scenarioTypes'
import { formatMonthDay } from '../../utils/date'

export function ScenarioActivePanel({ workspace, draft, onCancel, onOpenRecovery, onApply }: { workspace: ProjectWorkspace; draft: ProjectScenarioDraft; onCancel: () => void; onOpenRecovery: () => void; onApply: () => Promise<void> }) {
  const impact = buildScenarioImpact(workspace, draft)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const apply = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setApplying(true)
    setError(null)
    try { await onApply() } catch (failure) { setError(failure instanceof Error ? failure.message : 'Не удалось применить изменение.') } finally { inFlight.current = false; setApplying(false) }
  }
  return <section className="rounded-2xl border border-[#cfc8f7] bg-gradient-to-r from-[#f3f0ff] to-white p-4 shadow-panel" data-scenario-active="true">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#6d5dfb] text-white"><FlaskConical size={17} /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold text-[#363247]">Режим симуляции</h2><span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-[#6556d9]">Реальный план не изменён</span></div><p className="mt-1 text-[11px] font-semibold text-[#625d70]">{draft.description}</p></div></div><div className="grid grid-cols-3 gap-2 text-center text-[10px]"><div className="rounded-xl bg-white px-3 py-2"><p className="text-[#9993a4]">Финиш</p><p className="mt-0.5 font-bold text-[#4b4658]">{formatMonthDay(impact.currentProjectedEndDate)} <ArrowRight size={10} className="inline" /> {formatMonthDay(impact.scenarioProjectedEndDate)}</p></div><div className="rounded-xl bg-white px-3 py-2"><p className="text-[#9993a4]">Конфликты</p><p className="mt-0.5 font-bold text-[#4b4658]">{impact.conflictsBefore} → {impact.conflictsAfter}</p></div><div className="rounded-xl bg-white px-3 py-2"><p className="text-[#9993a4]">Затронуто задач</p><p className="mt-0.5 font-bold text-[#4b4658]">{impact.affectedTaskIds.length}</p></div></div></div>
    {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[10px] text-rose-700" role="alert">{error}</p>}
    <div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" disabled={applying} onClick={onCancel} className="rounded-xl border border-[#dcd7ee] bg-white px-3 py-2 text-[10px] font-bold text-[#625d6c] disabled:opacity-50">Отменить</button><button type="button" disabled={applying} onClick={onOpenRecovery} className="rounded-xl border border-[#9f93eb] bg-white px-3 py-2 text-[10px] font-bold text-[#5c4ec4] disabled:opacity-50">План восстановления</button><button type="button" disabled={applying} onClick={() => { void apply() }} className="rounded-xl bg-[#6d5dfb] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-60">{applying ? 'Применение…' : 'Применить изменение'}</button></div>
  </section>
}
