/**
 * Minimal width-measuring hook. The visx kinds take concrete numeric `width`/`height` (they are
 * deliberately not auto-sizing), so a responsive chart needs a measured container width. A tiny
 * `ResizeObserver` is enough — no dependency, no framework coupling.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export function useMeasureWidth(fallback = 640): [(node: HTMLDivElement | null) => void, number] {
  const [width, setWidth] = useState(fallback)
  const observer = useRef<ResizeObserver | null>(null)

  // Stable callback ref: recreating it each render would detach/reattach the node every render,
  // re-instantiating the ResizeObserver and forcing a synchronous reflow (layout thrashing).
  const ref = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect()
    if (!node) return
    observer.current = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(Math.max(Math.floor(entry.contentRect.width), 1))
    })
    observer.current.observe(node)
    setWidth(Math.max(Math.floor(node.getBoundingClientRect().width), 1))
  }, [])

  useEffect(() => () => observer.current?.disconnect(), [])

  return [ref, width]
}
