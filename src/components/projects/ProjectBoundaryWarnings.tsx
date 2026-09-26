import { TriangleAlert } from 'lucide-react'
import type { ProjectBoundaryIssue } from '../../types/project'
import { formatTaskCount } from '../../utils/plural'

export function ProjectBoundaryWarnings({ issues }: { issues: ProjectBoundaryIssue[] }) {
  if (issues.length === 0) return null
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-panel" role="status">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700"><TriangleAlert size={17} /></span>
        <div>
          <h2 className="text-sm font-bold">{formatTaskCount(issues.length)} {issues.length === 1 ? 'выходит' : 'выходят'} за границы проекта</h2>
          <ul className="mt-2 space-y-1 text-[11px] leading-4 text-amber-900">
            {issues.map((issue) => <li key={issue.taskId}><strong>{issue.taskTitle}:</strong> {issue.reasons.join('; ')}</li>)}
          </ul>
          <p className="mt-2 text-[10px] text-amber-800">Даты задач не изменены. Скорректируйте их вручную, если это необходимо.</p>
        </div>
      </div>
    </section>
  )
}
