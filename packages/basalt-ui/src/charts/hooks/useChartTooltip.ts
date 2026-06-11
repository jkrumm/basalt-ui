import { useCallback, useRef, useState } from 'react'

export type TooltipState<T> = { data: T; x: number; y: number } | null

export function useChartTooltip<T>() {
  const [tip, setTip] = useState<TooltipState<T>>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const lastDateRef = useRef<string | null>(null)

  const show = useCallback((data: T, event: React.MouseEvent) => {
    const el = tooltipRef.current
    const width = el?.offsetWidth ?? 0
    const height = el?.offsetHeight ?? 0
    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight
    const overflowsRight = event.clientX + 12 + width + margin > vw
    const x = overflowsRight ? Math.max(margin, event.clientX - 12 - width) : event.clientX + 12
    const y = Math.min(Math.max(margin, event.clientY - 12), vh - height - margin)
    // State-driven positioning: the tooltip element reads x/y from `tip`. (A prior direct
    // el.style.left/top write here was dead — the React render overwrote it the same frame.)
    setTip({ data, x, y })
  }, [])

  const hide = useCallback(() => {
    setTip(null)
    lastDateRef.current = null
  }, [])

  return { tip, show, hide, tooltipRef, lastDateRef }
}
