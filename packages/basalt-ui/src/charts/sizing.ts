/**
 * The measured-width seam (`docs/V2-SPEC.md` § 9.2, § 9.6): the chart root's width, for the compiled
 * definition's ticks and fonts. Nothing here sizes the box: `box.tsx` and `chart-box.module.css`
 * own the height in CSS so it exists before JS runs (W10 SSR contract).
 */
import { useCallback, useRef, useState } from 'react'
import type { RefCallback } from 'react'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { useCoarsePointer } from '../common/use-media-query'

/** Server and first-paint width before the host measures (TanStack `initialWidth`): the regular
 * class, so SSR markup and the first client frame agree. Only the svg's internal geometry follows
 * the real width; the box around it is already final. */
export const INITIAL_WIDTH = 640

/** Measures the width of the element `ref` lands on (`0` until measured, e.g. on the server). */
export function useChartSize(): {
  ref: RefCallback<HTMLElement>
  width: number
  coarse: boolean
} {
  const [width, setWidth] = useState(0)
  const [node, setNode] = useState<HTMLElement | null>(null)
  const coarse = useCoarsePointer()
  const last = useRef(0)

  useIsomorphicLayoutEffect(() => {
    if (!node) return
    const read = (w: number): void => {
      const rounded = Math.round(w)
      if (rounded === last.current) return
      last.current = rounded
      setWidth(rounded)
    }
    read(node.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) read(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])

  const ref = useCallback<RefCallback<HTMLElement>>((el) => setNode(el), [])
  return { ref, width, coarse }
}
