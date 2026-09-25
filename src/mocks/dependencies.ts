import type { Dependency } from '../types/dependency'

export const demoDependencies: Dependency[] = [
  { id: 'd1', projectId: 'aurora-launch', predecessorTaskId: 'requirements', successorTaskId: 'ux', type: 'finish-to-start' },
  { id: 'd2', projectId: 'aurora-launch', predecessorTaskId: 'requirements', successorTaskId: 'schema', type: 'finish-to-start' },
  { id: 'd3', projectId: 'aurora-launch', predecessorTaskId: 'ux', successorTaskId: 'design-system', type: 'finish-to-start' },
  { id: 'd4', projectId: 'aurora-launch', predecessorTaskId: 'schema', successorTaskId: 'api', type: 'finish-to-start' },
  { id: 'd5', projectId: 'aurora-launch', predecessorTaskId: 'ux', successorTaskId: 'api', type: 'finish-to-start' },
  { id: 'd6', projectId: 'aurora-launch', predecessorTaskId: 'api', successorTaskId: 'frontend', type: 'finish-to-start' },
  { id: 'd7', projectId: 'aurora-launch', predecessorTaskId: 'design-system', successorTaskId: 'frontend', type: 'finish-to-start' },
  { id: 'd8', projectId: 'aurora-launch', predecessorTaskId: 'frontend', successorTaskId: 'qa', type: 'finish-to-start' },
  { id: 'd9', projectId: 'aurora-launch', predecessorTaskId: 'infrastructure', successorTaskId: 'qa', type: 'finish-to-start' },
  { id: 'd10', projectId: 'aurora-launch', predecessorTaskId: 'qa', successorTaskId: 'release', type: 'finish-to-start' },
  { id: 'd11', projectId: 'aurora-launch', predecessorTaskId: 'docs', successorTaskId: 'release', type: 'finish-to-start' },
]
