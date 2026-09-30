import type { Employee } from '../types/employee'
import type { ProjectTask } from '../types/task'

const dayMs = 86_400_000

export interface EmployeeWorkload {
  employeeId: string
  employeeName: string
  maxConcurrentTasks: number
  peakStartDate: string | null
  peakEndDate: string | null
  peakTaskIds: string[]
}

function addDays(value: string, days: number): string {
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * dayMs).toISOString().slice(0, 10)
}

function taskRunsOn(task: ProjectTask, date: string): boolean {
  return task.startDate <= date && task.endDate >= date
}

export function analyzeTeamWorkload(employees: Employee[], tasks: ProjectTask[]): EmployeeWorkload[] {
  const unfinished = tasks.filter((task) => task.status !== 'completed')
  return employees.map((employee) => {
    const assigned = unfinished.filter((task) => task.assigneeId === employee.id)
    if (assigned.length === 0) {
      return { employeeId: employee.id, employeeName: employee.name, maxConcurrentTasks: 0, peakStartDate: null, peakEndDate: null, peakTaskIds: [] }
    }
    const first = assigned.reduce((value, task) => task.startDate < value ? task.startDate : value, assigned[0].startDate)
    const last = assigned.reduce((value, task) => task.endDate > value ? task.endDate : value, assigned[0].endDate)
    let peak = 0
    let peakStartDate: string | null = null
    let peakEndDate: string | null = null
    let peakTaskIds: string[] = []
    for (let date = first; date <= last; date = addDays(date, 1)) {
      const active = assigned.filter((task) => taskRunsOn(task, date))
      if (active.length > peak) {
        peak = active.length
        peakStartDate = date
        peakEndDate = date
        peakTaskIds = active.map((task) => task.id)
      } else if (active.length === peak && peakStartDate && peakEndDate === addDays(date, -1)) {
        peakEndDate = date
        peakTaskIds = [...new Set([...peakTaskIds, ...active.map((task) => task.id)])]
      }
    }
    return { employeeId: employee.id, employeeName: employee.name, maxConcurrentTasks: peak, peakStartDate, peakEndDate, peakTaskIds }
  })
}

export function findWorkloadImbalance(employees: Employee[], tasks: ProjectTask[]): {
  overloaded: EmployeeWorkload
  idleEmployeeNames: string[]
} | null {
  const workload = analyzeTeamWorkload(employees, tasks)
  const overloaded = workload.reduce<EmployeeWorkload | null>((best, item) => !best || item.maxConcurrentTasks > best.maxConcurrentTasks ? item : best, null)
  if (!overloaded || overloaded.maxConcurrentTasks < 3 || !overloaded.peakStartDate || !overloaded.peakEndDate) return null
  const idleEmployeeNames = employees
    .filter((employee) => employee.id !== overloaded.employeeId)
    .filter((employee) => !tasks.some((task) => task.status !== 'completed' && task.assigneeId === employee.id && task.startDate <= overloaded.peakEndDate! && task.endDate >= overloaded.peakStartDate!))
    .map((employee) => employee.name)
  return idleEmployeeNames.length > 0 ? { overloaded, idleEmployeeNames } : null
}
