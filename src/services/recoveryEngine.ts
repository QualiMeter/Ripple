import type { ImpactAnalysis, RecoveryScenario } from '../types/impact'

const dayMs = 86_400_000

const scenarioTemplates = [
  {
    id: 'parallel-qa',
    title: 'Запустить QA параллельно',
    description: 'Начать подготовку тестов и проверку стабильных модулей до завершения всей интеграции.',
    maxRecoveredDays: 4,
    actions: ['Начать подготовку QA раньше', 'Провести итоговый регресс после интеграции'],
    confidence: 'high' as const,
  },
  {
    id: 'api-support',
    title: 'Усилить работу над API аналитики',
    description: 'Подключить серверного разработчика после завершения подготовки инфраструктуры релиза.',
    maxRecoveredDays: 3,
    actions: ['Перенаправить 50% ресурса инфраструктуры', 'Сократить работу над API'],
    confidence: 'medium' as const,
  },
]

function subtractDays(date: string, days: number): string {
  return new Date(Date.parse(date) - days * dayMs).toISOString().slice(0, 10)
}

export function buildRecoveryScenarios(impact: ImpactAnalysis): RecoveryScenario[] {
  if (!impact.requiresIntervention || impact.deadlineShiftDays <= 0) return []

  return scenarioTemplates.map((template) => {
    const recoveredDays = Math.min(template.maxRecoveredDays, impact.deadlineShiftDays)
    return {
      id: template.id,
      title: template.title,
      description: template.description,
      expectedProjectEndDate: subtractDays(impact.projectedProjectEndDate, recoveredDays),
      recoveredDays,
      actions: template.actions,
      confidence: template.confidence,
    }
  })
}
