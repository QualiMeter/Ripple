import { useEffect, useRef, useState } from 'react'

interface DateInputProps {
  value: string
  onChange: (value: string) => void
  min?: string
  required?: boolean
  className?: string
  id?: string
  'aria-label'?: string
}

function formatDisplay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`
}

function parseDisplay(value: string): string | null {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length !== 8) return null
  const day = Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const year = Number(digits.slice(4, 8))
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

function mask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('.')
}

export function DateInput({ value, onChange, min, required, className = '', id, 'aria-label': ariaLabel }: DateInputProps) {
  const [display, setDisplay] = useState(formatDisplay(value))
  const lastExternalValue = useRef(value)

  useEffect(() => {
    if (value !== lastExternalValue.current) {
      lastExternalValue.current = value
      setDisplay(formatDisplay(value))
    }
  }, [value])

  return (
    <input
      id={id}
      aria-label={ariaLabel}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="ДД.ММ.ГГГГ"
      maxLength={10}
      required={required}
      value={display}
      onChange={(event) => {
        const next = mask(event.target.value)
        setDisplay(next)
        const parsed = parseDisplay(next)
        if (parsed && (!min || parsed >= min)) {
          lastExternalValue.current = parsed
          onChange(parsed)
        } else {
          lastExternalValue.current = ''
          onChange('')
        }
      }}
      onBlur={() => {
        const parsed = parseDisplay(display)
        if (parsed && (!min || parsed >= min)) {
          lastExternalValue.current = parsed
          onChange(parsed)
          setDisplay(formatDisplay(parsed))
        } else if (display) {
          lastExternalValue.current = ''
          onChange('')
        }
      }}
      min={min}
      className={className}
    />
  )
}
