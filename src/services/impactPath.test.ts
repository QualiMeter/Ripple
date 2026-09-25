import { describe, expect, it } from 'vitest'
import type { Dependency } from '../types/dependency'
import { isDependencyInImpactPath } from './impactPath'

function dependency(predecessorTaskId: string, successorTaskId: string): Dependency {
  return {
    id: `${predecessorTaskId}-${successorTaskId}`,
    projectId: 'test-project',
    predecessorTaskId,
    successorTaskId,
    type: 'finish-to-start',
  }
}

describe('isDependencyInImpactPath', () => {
  it('подсвечивает цепочку от source через затронутые downstream-задачи', () => {
    const affectedTaskIds = ['integration', 'qa', 'release']

    expect(isDependencyInImpactPath(dependency('api', 'integration'), 'api', affectedTaskIds)).toBe(true)
    expect(isDependencyInImpactPath(dependency('integration', 'qa'), 'api', affectedTaskIds)).toBe(true)
    expect(isDependencyInImpactPath(dependency('qa', 'release'), 'api', affectedTaskIds)).toBe(true)
  })

  it('не подсвечивает постороннюю связь, ведущую в затронутую задачу', () => {
    expect(isDependencyInImpactPath(
      dependency('design-system', 'integration'),
      'api',
      ['integration', 'qa', 'release'],
    )).toBe(false)
  })
})
