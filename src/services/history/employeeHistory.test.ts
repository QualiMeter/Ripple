import { describe, expect, it, vi } from 'vitest'
import { deleteEmployeeWithHistory } from './employeeHistory'

const employee = { id: 'employee', projectId: 'project', name: 'Иван Петров' }

describe('employee deletion history', () => {
  it('records a successful deletion after the mutation', async () => {
    const order: string[] = []
    const workspace = { assignees: [] } as never
    const record = vi.fn(() => order.push('record'))
    await deleteEmployeeWithHistory('project', employee, async () => { order.push('mutation'); return workspace }, record)
    expect(order).toEqual(['mutation', 'record'])
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ kind: 'employee-deleted', entityId: 'employee', before: { id: 'employee', name: 'Иван Петров' } }))
  })

  it('does not create a false event after backend deletion failure', async () => {
    const record = vi.fn()
    await expect(deleteEmployeeWithHistory('project', employee, async () => { throw new Error('backend error') }, record)).rejects.toThrow('backend error')
    expect(record).not.toHaveBeenCalled()
  })
})
