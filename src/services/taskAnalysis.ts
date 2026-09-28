export function isScheduleShiftActionCode(code: string): boolean {
  return code.toLowerCase().includes('shift')
}
