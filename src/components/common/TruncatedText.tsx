import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface TruncatedTextProps {
    text: string
    className?: string
}

export function TruncatedText({
                                  text,
                                  className = '',
                              }: TruncatedTextProps) {
    const ref = useRef<HTMLSpanElement>(null)

    const [tooltip, setTooltip] = useState<{
        left: number
        top: number
    } | null>(null)

    const showTooltip = () => {
        const element = ref.current
        if (!element) return

        // Показываем только если текст реально обрезан
        if (element.scrollWidth <= element.clientWidth) return

        const rect = element.getBoundingClientRect()

        const tooltipWidth = Math.min(320, window.innerWidth - 24)

        const left = Math.min(
            Math.max(
                12,
                rect.left + rect.width / 2 - tooltipWidth / 2,
            ),
            window.innerWidth - tooltipWidth - 12,
        )

        setTooltip({
            left,
            top: rect.bottom + 8,
        })
    }

    return (
        <>
      <span
          ref={ref}
          className={`block min-w-0 truncate ${className}`}
          onMouseEnter={showTooltip}
          onMouseLeave={() => setTooltip(null)}
      >
        {text}
      </span>

            {tooltip &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        className="
              pointer-events-none
              fixed
              z-[200]
              max-w-[320px]
              rounded-lg
              bg-[#29263d]
              px-3
              py-2
              text-xs
              font-medium
              leading-4
              text-white
              shadow-[0_10px_30px_rgba(0,0,0,.25)]
            "
                        style={{
                            left: tooltip.left,
                            top: tooltip.top,
                        }}
                        role="tooltip"
                    >
                        {text}
                    </div>,
                    document.body,
                )}
        </>
    )
}