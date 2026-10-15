/** The TOC scroll-spy's pure half: scroll geometry in, the reader's section out. */

/** Sub-pixel / fractional-DPR slack when asking "is the scrollport at its end". */
export const BOTTOM_EPSILON_PX = 2
/** Distance below the scrollport's top where a heading counts as reached (the observer's top inset). */
export const ACTIVATION_TOP_PX = 80
/** The observer's band: below the activation line, down to 30% of the scrollport. */
export const OBSERVER_ROOT_MARGIN = `-${ACTIVATION_TOP_PX}px 0px -70% 0px`

export type ScrollMetrics = {
  readonly top: number
  readonly scrollTop: number
  readonly clientHeight: number
  readonly scrollHeight: number
}

/** The scrollport's geometry; `null` is the document, whose "top" is the viewport's. */
export function scrollMetrics(port: HTMLElement | null): ScrollMetrics {
  if (port) {
    return {
      top: port.getBoundingClientRect().top,
      scrollTop: port.scrollTop,
      clientHeight: port.clientHeight,
      scrollHeight: port.scrollHeight,
    }
  }
  return {
    top: 0,
    scrollTop: window.scrollY,
    clientHeight: window.innerHeight,
    scrollHeight: document.documentElement.scrollHeight,
  }
}

/** Is there a scroll range at all? Content that fits has no "top" or "bottom" to be at. */
export function canScroll(m: ScrollMetrics): boolean {
  return m.scrollHeight - m.clientHeight > BOTTOM_EPSILON_PX
}

export function isAtBottom(m: ScrollMetrics): boolean {
  return canScroll(m) && m.scrollTop + m.clientHeight >= m.scrollHeight - BOTTOM_EPSILON_PX
}

/**
 * The reader's section. Nothing to scroll: the first heading. At the end: the last (its section may
 * be too short to ever reach the band). Otherwise the topmost heading inside the band, else the last
 * heading at or above the activation line, else the first.
 */
export function pickActive(
  elements: readonly HTMLElement[],
  intersecting: ReadonlySet<string>,
  m: ScrollMetrics,
): string | undefined {
  if (!canScroll(m)) return elements[0]?.id
  if (isAtBottom(m)) return elements[elements.length - 1]?.id
  const topmost = elements.find((el) => intersecting.has(el.id))
  if (topmost) return topmost.id
  const line = m.top + ACTIVATION_TOP_PX
  const passed = elements.filter((el) => el.getBoundingClientRect().top <= line)
  return (passed[passed.length - 1] ?? elements[0])?.id
}
