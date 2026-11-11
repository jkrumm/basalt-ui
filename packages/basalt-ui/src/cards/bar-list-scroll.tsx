import { useEffect, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'

/** How many rows of body a list card holds; anything beyond scrolls inside the card. */
export type ListRows = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export const DEFAULT_ROWS: ListRows = 5

/**
 * The inset's height per row count: rows times the row height plus the inset's 24 px of padding.
 * Literal class strings, so Tailwind sees every one. One fixed height per count is what keeps a
 * loading, empty or error card exactly as tall as a ready one.
 */
export const BAR_BODY_HEIGHT: Readonly<Record<ListRows, string>> = {
  3: 'h-36',
  4: 'h-46',
  5: 'h-56',
  6: 'h-66',
  7: 'h-76',
  8: 'h-86',
  9: 'h-96',
  10: 'h-106',
}

export const EVENT_BODY_HEIGHT: Readonly<Record<ListRows, string>> = {
  3: 'h-48',
  4: 'h-62',
  5: 'h-76',
  6: 'h-90',
  7: 'h-104',
  8: 'h-118',
  9: 'h-132',
  10: 'h-146',
}

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
      className="-mx-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 focus-ring focus-visible:-outline-offset-2"
    >
      <div>{children}</div>
    </div>
  )
}
