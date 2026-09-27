import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { getNextTooltipState, stopTooltipTriggerPropagation, type TooltipIntent } from '../../services/tooltipInteraction'

interface TooltipTriggerProps {
  ariaLabel: string
  trigger: ReactNode
  children: ReactNode
  className?: string
}

export function TooltipTrigger({ ariaLabel, trigger, children, className = '' }: TooltipTriggerProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 12, top: 12, above: false })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pointerTypeRef = useRef<string | null>(null)
  const descriptionId = useId()

  const updatePosition = () => {
    const triggerElement = triggerRef.current
    if (!triggerElement || typeof window === 'undefined') return
    const bounds = triggerElement.getBoundingClientRect()
    const tooltipWidth = Math.min(320, window.innerWidth - 24)
    const left = Math.min(
      Math.max(12, bounds.left + bounds.width / 2 - tooltipWidth / 2),
      window.innerWidth - tooltipWidth - 12,
    )
    const above = bounds.bottom + 190 > window.innerHeight && bounds.top > 190
    setPosition({ left, top: above ? bounds.top - 8 : bounds.bottom + 8, above })
  }

  const changeOpen = (intent: TooltipIntent) => {
    setOpen((current) => getNextTooltipState(current, intent))
    if (intent !== 'close') updatePosition()
  }

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: globalThis.PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node)) changeOpen('close')
    }
    const reposition = () => updatePosition()
    document.addEventListener('pointerdown', closeOutside)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    stopTooltipTriggerPropagation(event)
    pointerTypeRef.current = event.pointerType
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    stopTooltipTriggerPropagation(event)
    changeOpen(event.detail === 0 ? 'open' : 'toggle')
    pointerTypeRef.current = null
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (event.key !== 'Escape') return
    changeOpen('close')
  }

  return (
    <span className={`inline-flex ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        data-tooltip-trigger="true"
        aria-label={ariaLabel}
        aria-describedby={descriptionId}
        aria-expanded={open}
        onPointerDown={handlePointerDown}
        onPointerUp={(event) => { stopTooltipTriggerPropagation(event); pointerTypeRef.current = null }}
        onPointerCancel={(event) => { stopTooltipTriggerPropagation(event); pointerTypeRef.current = null }}
        onPointerEnter={(event) => { if (event.pointerType === 'mouse') changeOpen('open') }}
        onPointerLeave={(event) => { if (event.pointerType === 'mouse') changeOpen('close') }}
        onFocus={() => { if (!pointerTypeRef.current) changeOpen('open') }}
        onBlur={() => changeOpen('close')}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#7466de] focus-visible:ring-offset-1"
      >
        {trigger}
      </button>
      <span id={descriptionId} className="sr-only">{children}</span>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[120] w-[min(320px,calc(100vw-24px))] rounded-xl border border-[#ddd9e5] bg-[#29263d] px-3.5 py-3 text-left text-[11px] leading-4 text-white shadow-[0_16px_44px_rgba(28,25,45,.28)]"
          style={{
            left: position.left,
            top: position.top,
            transform: position.above ? 'translateY(-100%)' : undefined,
          }}
        >
          {children}
        </div>,
        document.body,
      )}
    </span>
  )
}
