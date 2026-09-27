import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { getInitialProjectPath } from '../services/projectNavigation'
import type { AppShellContext } from '../components/layout/AppShell'

export function ProjectEntryPage() {
  const navigate = useNavigate()
  const { projects, projectsLoading, projectsError } = useOutletContext<AppShellContext>()
  const [state, setState] = useState<'loading' | 'empty' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (projectsLoading) return
    if (projectsError) {
      setMessage(projectsError)
      setState('error')
      return
    }
    const path = getInitialProjectPath(projects)
    if (path) navigate(path, { replace: true })
    else setState('empty')
  }, [navigate, projects, projectsError, projectsLoading])

  if (state === 'loading') return <div className="grid min-h-screen place-items-center text-sm text-[#777181]" role="status">Загрузка проектов…</div>
  if (state === 'error') return <div className="grid min-h-screen place-items-center p-8 text-center text-sm text-rose-700">{message}</div>
  return <div className="grid min-h-screen place-items-center p-8"><div className="max-w-md rounded-2xl border border-[#e5e2ea] bg-white p-8 text-center shadow-panel"><h1 className="text-lg font-bold text-[#363247]">Проектов пока нет</h1><p className="mt-2 text-sm text-[#827d8d]">Создайте первый проект кнопкой «+» в блоке «Мои проекты».</p></div></div>
}
