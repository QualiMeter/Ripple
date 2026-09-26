import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { getErrorMessage } from '../../utils/error'

interface ProjectDeleteDialogProps {
  projectName: string
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function ProjectDeleteDialog({ projectName, onClose, onConfirm }: ProjectDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setError(null)
    setIsDeleting(true)
    try {
      await onConfirm()
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Не удалось удалить проект.'))
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#17152b]/55 p-4 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-labelledby="delete-project-title">
      <section className="w-full max-w-md rounded-2xl border border-[#e5e2ea] bg-white p-6 shadow-[0_24px_80px_rgba(23,21,43,.28)]">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600"><TriangleAlert size={19} /></span>
          <div>
            <h2 id="delete-project-title" className="text-base font-bold text-[#332f43]">Удалить проект «{projectName}»?</h2>
            <p className="mt-2 text-sm leading-5 text-[#777181]">Будут удалены задачи, сотрудники и зависимости проекта. Это действие нельзя отменить.</p>
          </div>
        </div>
        {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-700" role="alert">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" disabled={isDeleting} onClick={onClose} className="rounded-xl border border-[#dedbe5] px-4 py-2.5 text-xs font-bold text-[#615c6b] hover:bg-[#f7f6f9] disabled:opacity-50">Отмена</button>
          <button type="button" disabled={isDeleting} onClick={handleConfirm} className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60">{isDeleting ? 'Удаление…' : 'Удалить проект'}</button>
        </div>
      </section>
    </div>
  )
}
