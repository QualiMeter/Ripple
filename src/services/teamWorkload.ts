import type { Employee } from '../types/employee'
import type { ProjectTask } from '../types/task'
import { addCalendarDays, calendarDaysBetween } from '../utils/date'
import { pluralizeRu } from '../utils/plural'

export type WorkloadLevel = 'low' | 'normal' | 'elevated' | 'high'
export type WorkloadFragmentation = 'low' | 'moderate' | 'high'

export const WORKLOAD_LEVEL_LABELS: Record<WorkloadLevel, string> = {
  low: 'низкая',
  normal: 'нормальная',
  elevated: 'повышенная',
  high: 'высокая',
}

export const WORKLOAD_FACTOR_LABELS: Record<EmployeeWorkload['primaryFactor'], string> = {
  none: 'равномерное расписание',
  sustained: 'длительное пересечение задач',
  fragmented: 'частые старты коротких задач',
  peak: 'плотное пересечение сроков',
}

export const WORKLOAD_THRESHOLDS = {
  shortTaskMedianRatio: 0.65,
  longTaskMedianRatio: 1.5,
  fragmentWindowDays: 7,
  moderateFragmentStarts: 3,
  highFragmentStarts: 5,
  meaningfulParallelDays: 3,
  highSustainedStreakDays: 8,
  highPeakConcurrency: 3,
  highPeakDays: 3,
} as const

export interface DailyWorkloadEntry {
  date: string
  taskIds: string[]
  concurrency: number
}

export interface EmployeeWorkload {
  employeeId: string
  employeeName: string
  level: WorkloadLevel
  peakConcurrency: number
  /** Compatibility alias for existing compact consumers. */
  maxConcurrentTasks: number
  averageConcurrency: number
  parallelDays: number
  longestParallelStreak: number
  assignedTaskDays: number
  taskStarts: number
  switchEvents: number
  fragmentation: WorkloadFragmentation
  reasons: string[]
  primaryFactor: 'none' | 'sustained' | 'fragmented' | 'peak'
  peakStartDate: string | null
  peakEndDate: string | null
  peakTaskIds: string[]
  peakDays: number
  shortTaskCount: number
  longTaskCount: number
  dailyWorkload: DailyWorkloadEntry[]
}

export interface WorkloadMetricDelta {
  peakConcurrency: number
  parallelDays: number
  longestParallelStreak: number
  fragmentation: number
}

export interface ReassignmentCandidate {
  employeeId: string
  employeeName: string
  before: EmployeeWorkload
  after: EmployeeWorkload
  delta: WorkloadMetricDelta
  additionalSchedulingPressure: number
  teamBalanceImprovement: number
}

export interface ReassignmentSuggestion {
  taskId: string
  sourceEmployeeId: string
  sourceBefore: EmployeeWorkload
  sourceAfter: EmployeeWorkload
  candidate: ReassignmentCandidate
}

export interface WorkloadImbalance {
  overloaded: EmployeeWorkload
  idleEmployeeNames: string[]
}

export interface TeamWorkloadAttention {
  workload: EmployeeWorkload[]
  highWorkloads: EmployeeWorkload[]
  imbalance: WorkloadImbalance | null
  primary: EmployeeWorkload | null
  reassignment: ReassignmentSuggestion | null
}

function inclusiveDuration(task: Pick<ProjectTask, 'startDate' | 'endDate'>): number {
  return calendarDaysBetween(task.startDate, task.endDate) + 1
}

function median(values: number[]): number {
  if (values.length === 0) return 1
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function projectMedianTaskDuration(tasks: ProjectTask[]): number {
  const unfinished = tasks.filter((task) => task.status !== 'completed')
  return median((unfinished.length > 0 ? unfinished : tasks).map(inclusiveDuration))
}

function maxStartsInWindow(startDates: string[], windowDays: number): number {
  const sorted = [...startDates].sort()
  let maximum = 0
  let left = 0
  for (let right = 0; right < sorted.length; right += 1) {
    while (calendarDaysBetween(sorted[left], sorted[right]) >= windowDays) left += 1
    maximum = Math.max(maximum, right - left + 1)
  }
  return maximum
}

function longestParallelRun(daily: DailyWorkloadEntry[]): number {
  let longest = 0
  let current = 0
  daily.forEach((day) => {
    current = day.concurrency >= 2 ? current + 1 : 0
    longest = Math.max(longest, current)
  })
  return longest
}

function peakInterval(daily: DailyWorkloadEntry[], peak: number): { start: string | null; end: string | null; taskIds: string[]; days: number } {
  if (peak === 0) return { start: null, end: null, taskIds: [], days: 0 }
  let bestStart: string | null = null
  let bestEnd: string | null = null
  let currentStart: string | null = null
  let currentEnd: string | null = null
  let bestLength = 0
  let currentTaskIds = new Set<string>()
  let bestTaskIds: string[] = []
  let totalPeakDays = 0
  daily.forEach((day) => {
    if (day.concurrency === peak) {
      totalPeakDays += 1
      if (!currentStart) currentStart = day.date
      currentEnd = day.date
      day.taskIds.forEach((taskId) => currentTaskIds.add(taskId))
      const length = calendarDaysBetween(currentStart, currentEnd) + 1
      if (length > bestLength) {
        bestLength = length
        bestStart = currentStart
        bestEnd = currentEnd
        bestTaskIds = [...currentTaskIds]
      }
    } else {
      currentStart = null
      currentEnd = null
      currentTaskIds = new Set<string>()
    }
  })
  return { start: bestStart, end: bestEnd, taskIds: bestTaskIds, days: totalPeakDays }
}

export function buildDailyWorkload(tasks: ProjectTask[], employeeId: string): DailyWorkloadEntry[] {
  const assigned = tasks.filter((task) => task.assigneeId === employeeId && task.status !== 'completed')
  if (assigned.length === 0) return []
  const first = assigned.reduce((value, task) => task.startDate < value ? task.startDate : value, assigned[0].startDate)
  const last = assigned.reduce((value, task) => task.endDate > value ? task.endDate : value, assigned[0].endDate)
  const result: DailyWorkloadEntry[] = []
  for (let date = first; date <= last; date = addCalendarDays(date, 1)) {
    const taskIds = assigned.filter((task) => task.startDate <= date && task.endDate >= date).map((task) => task.id)
    result.push({ date, taskIds, concurrency: taskIds.length })
  }
  return result
}

export function analyzeEmployeeWorkload(employee: Employee, tasks: ProjectTask[], medianTaskDuration = projectMedianTaskDuration(tasks)): EmployeeWorkload {
  const assigned = tasks.filter((task) => task.assigneeId === employee.id && task.status !== 'completed')
  const dailyWorkload = buildDailyWorkload(tasks, employee.id)
  const occupiedDays = dailyWorkload.filter((day) => day.concurrency > 0)
  const peakConcurrency = occupiedDays.reduce((peak, day) => Math.max(peak, day.concurrency), 0)
  const peak = peakInterval(dailyWorkload, peakConcurrency)
  const parallelDays = occupiedDays.filter((day) => day.concurrency >= 2).length
  const longestParallelStreak = longestParallelRun(dailyWorkload)
  const assignedTaskDays = assigned.reduce((sum, task) => sum + inclusiveDuration(task), 0)
  const taskStarts = assigned.length
  const changesByDate = new Map<string, number>()
  assigned.forEach((task) => {
    changesByDate.set(task.startDate, (changesByDate.get(task.startDate) ?? 0) + 1)
    const dayAfterEnd = addCalendarDays(task.endDate, 1)
    changesByDate.set(dayAfterEnd, (changesByDate.get(dayAfterEnd) ?? 0) + 1)
  })
  const switchEvents = [...changesByDate.values()].reduce((sum, changes) => sum + changes, 0)
  const shortTaskLimit = medianTaskDuration * WORKLOAD_THRESHOLDS.shortTaskMedianRatio
  const longTaskLimit = medianTaskDuration * WORKLOAD_THRESHOLDS.longTaskMedianRatio
  const shortTasks = assigned.filter((task) => inclusiveDuration(task) < shortTaskLimit)
  const longTasks = assigned.filter((task) => inclusiveDuration(task) > longTaskLimit)
  const clusteredShortStarts = maxStartsInWindow(shortTasks.map((task) => task.startDate), WORKLOAD_THRESHOLDS.fragmentWindowDays)
  const fragmentation: WorkloadFragmentation = clusteredShortStarts >= WORKLOAD_THRESHOLDS.highFragmentStarts
    ? 'high'
    : clusteredShortStarts >= WORKLOAD_THRESHOLDS.moderateFragmentStarts ? 'moderate' : 'low'
  const sustainedHigh = longestParallelStreak >= WORKLOAD_THRESHOLDS.highSustainedStreakDays
  const strongPeak = peakConcurrency >= WORKLOAD_THRESHOLDS.highPeakConcurrency && peak.days >= WORKLOAD_THRESHOLDS.highPeakDays
  const meaningfulParallel = longestParallelStreak >= WORKLOAD_THRESHOLDS.meaningfulParallelDays
  const level: WorkloadLevel = assigned.length === 0
    ? 'low'
    : sustainedHigh || strongPeak || fragmentation === 'high'
      ? 'high'
      : meaningfulParallel || fragmentation === 'moderate' || peakConcurrency >= WORKLOAD_THRESHOLDS.highPeakConcurrency
        ? 'elevated'
        : 'normal'
  const reasons: string[] = []
  if (meaningfulParallel) reasons.push(`Параллельная работа длится ${longestParallelStreak} ${pluralizeRu(longestParallelStreak, ['день', 'дня', 'дней'])} подряд (пик — ${peakConcurrency} ${pluralizeRu(peakConcurrency, ['задача', 'задачи', 'задач'])})`)
  if (peakConcurrency >= WORKLOAD_THRESHOLDS.highPeakConcurrency) reasons.push(`${peakConcurrency} ${pluralizeRu(peakConcurrency, ['задача пересекается', 'задачи пересекаются', 'задач пересекаются'])} ${peak.days} ${pluralizeRu(peak.days, ['день', 'дня', 'дней'])}`)
  if (fragmentation !== 'low') reasons.push(`${clusteredShortStarts} ${pluralizeRu(clusteredShortStarts, ['короткая задача начинается', 'короткие задачи начинаются', 'коротких задач начинаются'])} в течение одной недели`)
  const primaryFactor: EmployeeWorkload['primaryFactor'] = fragmentation === 'high'
    ? 'fragmented'
    : meaningfulParallel ? 'sustained' : peakConcurrency >= WORKLOAD_THRESHOLDS.highPeakConcurrency ? 'peak' : 'none'
  return {
    employeeId: employee.id, employeeName: employee.name, level, peakConcurrency, maxConcurrentTasks: peakConcurrency,
    averageConcurrency: occupiedDays.length > 0 ? occupiedDays.reduce((sum, day) => sum + day.concurrency, 0) / occupiedDays.length : 0,
    parallelDays, longestParallelStreak, assignedTaskDays, taskStarts, switchEvents, fragmentation, reasons, primaryFactor,
    peakStartDate: peak.start, peakEndDate: peak.end, peakTaskIds: peak.taskIds, peakDays: peak.days,
    shortTaskCount: shortTasks.length, longTaskCount: longTasks.length, dailyWorkload,
  }
}

export function analyzeTeamWorkload(employees: Employee[], tasks: ProjectTask[]): EmployeeWorkload[] {
  const medianDuration = projectMedianTaskDuration(tasks)
  return employees.map((employee) => analyzeEmployeeWorkload(employee, tasks, medianDuration))
}

export function simulateTaskReassignment(tasks: ProjectTask[], taskId: string, candidateEmployeeId: string): ProjectTask[] {
  return tasks.map((task) => task.id === taskId ? { ...task, assigneeId: candidateEmployeeId } : task)
}

function fragmentationRank(value: WorkloadFragmentation): number {
  return value === 'high' ? 2 : value === 'moderate' ? 1 : 0
}

function pressureScore(workload: EmployeeWorkload): number {
  const levelScore: Record<WorkloadLevel, number> = { low: 0, normal: 10, elevated: 35, high: 70 }
  return levelScore[workload.level] + workload.peakConcurrency * 8 + workload.parallelDays * 1.5
    + workload.longestParallelStreak * 2 + fragmentationRank(workload.fragmentation) * 15
}

function scoreCandidateDuringTask(before: EmployeeWorkload, after: EmployeeWorkload, task: ProjectTask): number {
  const beforeByDate = new Map(before.dailyWorkload.map((day) => [day.date, day.concurrency]))
  const afterByDate = new Map(after.dailyWorkload.map((day) => [day.date, day.concurrency]))
  let pressure = 0
  for (let date = task.startDate; date <= task.endDate; date = addCalendarDays(date, 1)) {
    const beforeCount = beforeByDate.get(date) ?? 0
    const afterCount = afterByDate.get(date) ?? 0
    pressure += afterCount ** 2 - beforeCount ** 2
  }
  return pressure
}

function teamPressureVariance(workloads: EmployeeWorkload[]): number {
  if (workloads.length === 0) return 0
  const scores = workloads.map(pressureScore)
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
  return scores.reduce((sum, score) => sum + (score - average) ** 2, 0) / scores.length
}

export function rankReassignmentCandidates(employees: Employee[], tasks: ProjectTask[], taskId: string): ReassignmentCandidate[] {
  const targetTask = tasks.find((task) => task.id === taskId)
  if (!targetTask || targetTask.status === 'completed') return []
  const sourceEmployee = employees.find((employee) => employee.id === targetTask.assigneeId)
  if (!sourceEmployee) return []
  const beforeTeam = analyzeTeamWorkload(employees, tasks)
  const beforeVariance = teamPressureVariance(beforeTeam)
  return employees.filter((employee) => employee.id !== sourceEmployee.id).map((employee) => {
    const simulatedTasks = simulateTaskReassignment(tasks, taskId, employee.id)
    const afterTeam = analyzeTeamWorkload(employees, simulatedTasks)
    const before = beforeTeam.find((item) => item.employeeId === employee.id)!
    const after = afterTeam.find((item) => item.employeeId === employee.id)!
    return {
      employeeId: employee.id,
      employeeName: employee.name,
      before,
      after,
      delta: {
        peakConcurrency: after.peakConcurrency - before.peakConcurrency,
        parallelDays: after.parallelDays - before.parallelDays,
        longestParallelStreak: after.longestParallelStreak - before.longestParallelStreak,
        fragmentation: fragmentationRank(after.fragmentation) - fragmentationRank(before.fragmentation),
      },
      additionalSchedulingPressure: scoreCandidateDuringTask(before, after, targetTask),
      teamBalanceImprovement: beforeVariance - teamPressureVariance(afterTeam),
    }
  }).sort((left, right) => left.additionalSchedulingPressure - right.additionalSchedulingPressure
    || right.teamBalanceImprovement - left.teamBalanceImprovement
    || left.employeeName.localeCompare(right.employeeName, 'ru'))
}

function findBestReassignment(employees: Employee[], tasks: ProjectTask[], workload: EmployeeWorkload): ReassignmentSuggestion | null {
  const candidateTasks = tasks.filter((task) => task.assigneeId === workload.employeeId && task.status !== 'completed')
  const suggestions = candidateTasks.flatMap((task) => {
    const candidate = rankReassignmentCandidates(employees, tasks, task.id)[0]
    if (!candidate) return []
    const sourceAfter = analyzeTeamWorkload(employees, simulateTaskReassignment(tasks, task.id, candidate.employeeId))
      .find((item) => item.employeeId === workload.employeeId)!
    return [{
      taskId: task.id,
      sourceEmployeeId: workload.employeeId,
      sourceBefore: workload,
      sourceAfter,
      candidate,
      relief: pressureScore(workload) - pressureScore(sourceAfter),
    }]
  })
  suggestions.sort((left, right) => right.relief - left.relief
    || left.candidate.additionalSchedulingPressure - right.candidate.additionalSchedulingPressure
    || right.candidate.teamBalanceImprovement - left.candidate.teamBalanceImprovement)
  const best = suggestions[0]
  return best ? {
    taskId: best.taskId,
    sourceEmployeeId: best.sourceEmployeeId,
    sourceBefore: best.sourceBefore,
    sourceAfter: best.sourceAfter,
    candidate: best.candidate,
  } : null
}

export function analyzeTeamWorkloadAttention(employees: Employee[], tasks: ProjectTask[]): TeamWorkloadAttention {
  const workload = analyzeTeamWorkload(employees, tasks)
  const levelOrder: Record<WorkloadLevel, number> = { low: 0, normal: 1, elevated: 2, high: 3 }
  const highWorkloads = workload.filter((item) => item.level === 'high' || item.level === 'elevated')
    .sort((left, right) => levelOrder[right.level] - levelOrder[left.level]
      || pressureScore(right) - pressureScore(left)
      || left.employeeName.localeCompare(right.employeeName, 'ru'))
  const primary = highWorkloads[0] ?? null
  const idleEmployeeNames = primary?.peakStartDate && primary.peakEndDate
    ? employees.filter((employee) => employee.id !== primary.employeeId)
      .filter((employee) => !tasks.some((task) => task.status !== 'completed' && task.assigneeId === employee.id
        && task.startDate <= primary.peakEndDate! && task.endDate >= primary.peakStartDate!))
      .map((employee) => employee.name)
    : []
  return {
    workload,
    highWorkloads,
    primary,
    imbalance: primary && idleEmployeeNames.length > 0 ? { overloaded: primary, idleEmployeeNames } : null,
    reassignment: primary ? findBestReassignment(employees, tasks, primary) : null,
  }
}

export function findWorkloadImbalance(employees: Employee[], tasks: ProjectTask[]): WorkloadImbalance | null {
  return analyzeTeamWorkloadAttention(employees, tasks).imbalance
}
