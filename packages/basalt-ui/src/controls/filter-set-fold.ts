/**
 * The measured fold of a `FilterSet` row. The row renders every pill, clipped, on the server and in
 * the first client render, so hydration sees the same markup. After mount it measures each pill by
 * its spec key (never its index, so a reorder keeps the cache) and hides the tail that does not fit
 * behind a `+N` button. A hidden pill keeps its last measured width.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/** The width reserved for the `+N` button until it has been measured. */
const FOLD_FALLBACK = 56
/** The row gap when the row has no computed style yet. */
const GAP_FALLBACK = 8

/**
 * How many of `widths` fit `available` side by side. When not all fit, room for the fold button
 * (`reserve`, plus one gap) is kept back.
 */
export function fitCount(
  widths: readonly number[],
  gap: number,
  available: number,
  reserve: number,
): number {
  const all = widths.reduce((sum, w, i) => sum + w + (i === 0 ? 0 : gap), 0)
  if (all <= available) return widths.length
  let used = reserve
  let fit = 0
  for (const [i, w] of widths.entries()) {
    used += gap + w
    if (used > available) break
    fit = i + 1
  }
  return fit
}

/**
 * Observes `rowRef` and the `[data-fold-key]` pills in it, and returns how many of `keys` stay
 * visible. All of them until the first measurement, and when the row has no width (hidden by a
 * container query) or the browser cannot observe.
 */
export function useFold(rowRef: RefObject<HTMLElement | null>, keys: readonly string[]): number {
  const [visible, setVisible] = useState(keys.length)
  const widths = useRef(new Map<string, number>())
  const foldWidth = useRef(FOLD_FALLBACK)
  const signature = keys.join('\u0000')

  useLayoutEffect(() => {
    const row = rowRef.current
    if (row === null || typeof ResizeObserver === 'undefined') return
    const list = signature === '' ? [] : signature.split('\u0000')

    const measure = (): void => {
      const available = row.clientWidth
      if (available <= 0) return
      for (const el of row.querySelectorAll<HTMLElement>('[data-fold-key]')) {
        const width = el.offsetWidth
        if (width > 0) widths.current.set(el.dataset['foldKey'] ?? '', width)
      }
      const fold = row.querySelector<HTMLElement>('[data-fold-trigger]')
      if (fold !== null && fold.offsetWidth > 0) foldWidth.current = fold.offsetWidth
      const gap = Number.parseFloat(getComputedStyle(row).columnGap)
      const next = fitCount(
        list.map((key) => widths.current.get(key) ?? 0),
        Number.isFinite(gap) ? gap : GAP_FALLBACK,
        available,
        foldWidth.current,
      )
      setVisible((current) => (current === next ? current : next))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    for (const el of row.querySelectorAll('[data-fold-key], [data-fold-trigger]')) {
      observer.observe(el)
    }
    return () => {
      observer.disconnect()
    }
    // `visible` re-attaches the observer to the fold button when it appears or goes
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [rowRef, signature, visible])

  return Math.min(visible, keys.length)
}
