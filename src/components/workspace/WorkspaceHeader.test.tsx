import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WorkspaceHeader } from './WorkspaceHeader'

describe('WorkspaceHeader', () => {
  it('shows the total current issue count in the risks tab', () => {
    const markup = renderToStaticMarkup(<WorkspaceHeader
      project={{ id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-01-01', targetEndDate: '2026-01-31', projectedEndDate: '2026-01-31', ownerName: 'Менеджер', health: 'at-risk', progress: 0, taskCount: 1, completedTaskCount: 0 }}
      currentIssueCount={4}
      activeView="overview"
      onViewChange={() => undefined}
      onOpenNavigation={() => undefined}
      onEditProject={() => undefined}
      onDeleteProject={() => undefined}
    />)
    expect(markup).toContain('Риски и последствия')
    expect(markup).toContain('>4</span>')
  })
})
