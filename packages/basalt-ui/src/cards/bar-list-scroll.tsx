import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'

/**
 * How many rows of body a list card holds; anything beyond scrolls inside the card. A whole number,
 * 3 or more: a fraction rounds down and a smaller or unusable count holds 3 (`listRows`).
 */
export type ListRows = number

export const DEFAULT_ROWS = 5

const FEWEST_ROWS = 3

/** The rows a body holds for a requested count: whole, at least three, the default when unusable. */
export const listRows = (rows: number | undefined): number =>
  rows === undefined || !Number.isFinite(rows)
    ? DEFAULT_ROWS
    : Math.max(FEWEST_ROWS, Math.floor(rows))

/** The spacing steps of one row: `h-10` (40 px) for a bar or a one-line row, `h-12` for two lines, `h-14` for an event. */
export type RowSteps = 10 | 12 | 14

/**
 * The inset's height for `rows` rows: rows times the row height plus the inset's 24 px of padding, in
 * the spacing scale the row classes use. One height per count is what keeps a loading, empty or error
 * card exactly as tall as a ready one, at any count.
 */
export const bodyHeight = (rows: number, steps: RowSteps): CSSProperties => ({
  height: `calc(var(--spacing) * ${rows * steps + 6})`,
})

/**
 * Whether the element's content is taller than its box. Measured after paint and on every resize,
 * so the server render and the first client render agree (`false`).
 */
function useScrollable(): [(el: HTMLDivElement | null) => void, boolean] {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [scrollable, setScrollable] = useState(false)
  const frame = useRef(0)
  useEffect(() => {
    if (el === null) return undefined
    const measure = (): void => setScrollable(el.scrollHeight > el.clientHeight)
    measure()
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(measure)
    })
    observer.observe(el)
    // The rows change the content's height without changing the box's.
    if (el.firstElementChild !== null) observer.observe(el.firstElementChild)
    return () => {
      cancelAnimationFrame(frame.current)
      observer.disconnect()
    }
  }, [el])
  return [setEl, scrollable]
}

/**
 * The scroll node of a list card. It is a keyboard stop only while it scrolls, named by the card's
 * title, so a short list adds no tab stop and a long one stays reachable without a pointer.
 */
export function ScrollRegion({
  label,
  children,
}: {
  label: string
  children: ReactNode
}): ReactElement {
  const [ref, scrollable] = useScrollable()
  return (
    <div
      ref={ref}
      data-slot="list-scroll"
      {...(scrollable && { role: 'region', 'aria-label': label, tabIndex: 0 })}
      className="-mx-2 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-2 focus-ring focus-visible:-outline-offset-2"
    >
      {/* Grows to the region, so a list in a card a grid row stretched can share the extra height among its rows. */}
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  )
}
