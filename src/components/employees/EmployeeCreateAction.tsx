import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Employee } from '../../types/employee'
import { EmployeeFormPanel } from './EmployeeFormPanel'

export function EmployeeCreateAction({ onCreate, onCreated }: { onCreate: (name: string) => Promise<Employee>; onCreated: (employee: Employee) => void }) {
  const [open, setOpen] = useState(false)
  const handleCreate = async (name: string) => {
    const employee = await onCreate(name)
    onCreated(employee)
    setOpen(false)
  }
  return <><button type="button" onClick={() => setOpen(true)} className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-[#6557d1] hover:text-[#5144ba]"><Plus size={14} /> Добавить сотрудника</button>{open && <EmployeeFormPanel title="Новый сотрудник" submitLabel="Добавить" onClose={() => setOpen(false)} onSubmit={handleCreate} />}</>
}
