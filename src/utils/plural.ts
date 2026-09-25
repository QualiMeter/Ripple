export function pluralizeRu(value: number, forms: [string, string, string]): string {
  const absoluteValue = Math.abs(value) % 100
  const lastDigit = absoluteValue % 10

  if (absoluteValue > 10 && absoluteValue < 20) return forms[2]
  if (lastDigit === 1) return forms[0]
  if (lastDigit > 1 && lastDigit < 5) return forms[1]
  return forms[2]
}

export function formatTaskCount(value: number): string {
  return `${value} ${pluralizeRu(value, ['задача', 'задачи', 'задач'])}`
}

