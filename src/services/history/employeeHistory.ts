import type { Employee } from '../../types/employee'
import type { ProjectWorkspace } from '../../types/workspace'
import { employeeSnapshot } from './historyEvents'
import type { NewProjectHistoryEntry } from './historyTypes'

export async function deleteEmployeeWithHistory(
  projectId: string,
  employee: Employee,
  mutation: () => Promise<ProjectWorkspace>,
  record: (entry: NewProjectHistoryEntry) => void,
): Promise<ProjectWorkspace> {
  const workspace = await mutation()
  record({ projectId, kind: 'employee-deleted', title: 'Удалён сотрудник', description: employee.name, entityType: 'employee', entityId: employee.id, before: employeeSnapshot(employee) })
  return workspace
}
