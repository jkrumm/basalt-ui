/**
 * `EventList`'s scroll behaviour: keep the visible row across a prepend, open an oldest-first box on
 * its newest end while the layout settles, and mark a scrolled box so its sticky day header can lift. Every hook takes the scroll node
 * as state (null until mounted) and is inert without one.
 */
import { useEffect, useRef } from 'react'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'

type AnchorMemory = { firstId: string; count: number; scrollHeight: number }

/**
 * The list's own scroll node keeps the visible row across a prepend: the count grew and the old
 * first id is still in the list, so the height delta goes onto `scrollTop`. Memory resets whenever
 * there is nothing to anchor (disabled, no rows, node absent), so a reload is never read as a
 * prepend. The node sets `overflow-anchor: none` so the browser cannot add the same delta twice.
 */
export function usePrependAnchor(
  node: HTMLElement | null,
  enabled: boolean,
  items: readonly { readonly id: string }[],
): void {
  const prev = useRef<AnchorMemory | null>(null)
  const firstId = items[0]?.id
  const count = items.length
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- every commit, by design
  useIsomorphicLayoutEffect(() => {
    const root = enabled ? node : null
    if (root === null || firstId === undefined) {
      prev.current = null
      return
    }
    const before = prev.current
    if (
      before !== null &&
      before.firstId !== firstId &&
      count > before.count &&
      items.some((item) => item.id === before.firstId)
    ) {
      root.scrollTop += root.scrollHeight - before.scrollHeight
    }
    prev.current = { firstId, count, scrollHeight: root.scrollHeight }
  })
}

/** The inputs that mean the user has taken over the scroll position. */
const USER_INPUT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

/** How long a list that has not been touched keeps re-applying "open on the newest end". */
const OPEN_AT_END_MS = 3000

/**
 * An oldest-first list with its own scroll node opens on the newest end — and keeps opening there
 * while the layout is still settling (fonts, the narrow time move, wrapping grow `scrollHeight`
 * after the first jump), until the user touches it, the item count changes (an `earlier` load), or
 * a few seconds pass. Plain path only: the windowed seam opens itself with `initialScroll`.
 */
export function useOpenAtEnd(node: HTMLElement | null, active: boolean, count: number): void {
  const latest = useRef(count)
  // The first jump happens before paint: no frame at the top, then a jump.
  useIsomorphicLayoutEffect(() => {
    if (node === null || !active) return
    const el: HTMLElement = node
    el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
  }, [node, active])
  useIsomorphicLayoutEffect(() => {
    latest.current = count
  })
  useEffect(() => {
    if (node === null || !active) return
    const opened = latest.current
    const el: HTMLElement = node
    let stopped = false
    const toEnd = (): void => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
    }
    const reapply = (): void => {
      if (stopped) return
      if (latest.current === opened) toEnd()
      else stop()
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reapply)
    const timer = setTimeout(() => stop(), OPEN_AT_END_MS)
    function stop(): void {
      stopped = true
      observer?.disconnect()
      clearTimeout(timer)
      for (const type of USER_INPUT) el.removeEventListener(type, stop)
    }
    for (const type of USER_INPUT) el.addEventListener(type, stop, { passive: true })
    observer?.observe(el)
    if (el.firstElementChild !== null) observer?.observe(el.firstElementChild)
    toEnd()
    void document.fonts?.ready?.then(reapply)
    return stop
  }, [node, active])
}

const TRIM = '--event-list-trim'

/**
 * How far the box must be shorter for its newest end to open on a row boundary: with a sticky day
 * header stuck at the top, the row beneath its lower edge is cut across its first line. Trimming the
 * box by that row's remainder hides it entirely, so the first row in view is whole and the last row
 * still ends on the box's floor. Pure of the current trim (it adds it back), so it settles in one
 * step. 0 when no header is stuck or nothing is cut.
 */
export function rowBoundaryTrim(el: HTMLElement, content: Element, current: number): number {
  const header = content.querySelector<HTMLElement>('[data-day-header]')
  if (header === null) return 0
  const origin = content.getBoundingClientRect().top
  const rel = (e: Element, edge: 'top' | 'bottom'): number =>
    e.getBoundingClientRect()[edge] - origin
  // The end position of the untrimmed box, and the line the stuck header's lower edge sits on there.
  const end = el.scrollHeight - (el.clientHeight + current)
  const stuck = Array.from(content.querySelectorAll('[data-day-header]')).some(
    (h) => h.parentElement !== null && rel(h.parentElement, 'top') < end - 0.5,
  )
  if (!stuck) return 0
  const cut = end + header.offsetHeight
  for (const row of content.querySelectorAll('[data-event-id]')) {
    const [top, bottom] = [rel(row, 'top'), rel(row, 'bottom')]
    if (top >= cut - 0.5 || bottom <= cut + 0.5) continue
    // A cut through the row's own top padding hides nothing of it.
    if (cut - top <= Number.parseFloat(getComputedStyle(row).paddingTop)) return 0
    return bottom - cut
  }
  return 0
}

/**
 * Keeps `--event-list-trim` on the scroll node at `rowBoundaryTrim` (the box subtracts it from its
 * height) while an oldest-first box opens on its newest end; cleared otherwise.
 */
export function useRowBoundary(node: HTMLElement | null, active: boolean): void {
  useEffect(() => {
    const content = node?.firstElementChild
    if (node === null || content === null || content === undefined || !active) return
    const el: HTMLElement = node
    const run = (): void => {
      const current = Number.parseFloat(el.style.getPropertyValue(TRIM)) || 0
      const next = Math.min(rowBoundaryTrim(el, content, current), el.clientHeight / 2)
      if (Math.abs(next - current) < 1.5) return
      el.style.setProperty(TRIM, `${next}px`)
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(run)
    observer?.observe(content)
    run()
    void document.fonts?.ready?.then(run)
    return () => {
      observer?.disconnect()
      el.style.removeProperty(TRIM)
    }
  }, [node, active])
}

/**
 * Marks the scroll node `data-scrolled` while it is off the top (CSS lifts the sticky day header) and
 * `data-more` while content remains below the fold (CSS paints a bottom fade), so a clipped last row
 * is never silent.
 */
export function useScrolledEdge(node: HTMLElement | null): void {
  useEffect(() => {
    if (node === null) return
    const el: HTMLElement = node
    const flag = (name: string, on: boolean): void => {
      if (on === el.hasAttribute(name)) return
      if (on) el.setAttribute(name, '')
      else el.removeAttribute(name)
    }
    const mark = (): void => {
      flag('data-scrolled', el.scrollTop > 0)
      flag('data-more', el.scrollHeight - el.scrollTop - el.clientHeight > 1)
    }
    mark()
    el.addEventListener('scroll', mark, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mark)
    observer?.observe(el)
    const content = el.firstElementChild
    if (content !== null) observer?.observe(content)
    // The content wrapper stays, its children swap (skeleton, plain rows, the windowed seam): re-read then.
    const swaps = typeof MutationObserver === 'undefined' ? null : new MutationObserver(mark)
    if (content !== null) swaps?.observe(content, { childList: true })
    return () => {
      el.removeEventListener('scroll', mark)
      observer?.disconnect()
      swaps?.disconnect()
      el.removeAttribute('data-scrolled')
      el.removeAttribute('data-more')
    }
  }, [node])
}

const HELD = '--event-list-held'
const LAST = '--event-list-last'

/**
 * While rows are plain DOM the content height is kept on the node as `--event-list-held`; the
 * windowed wrapper takes it as a minimum height, so swapping plain rows for the lazy seam never
 * collapses the scroller (the browser would clamp `scrollTop` to 0 before the peer resolves). It is
 * only for that handoff: it is released as soon as the windowed rows have rendered (their height is
 * measured into `--event-list-last` first), and whenever there are no rows, so a shorter list never
 * leaves blank space below its last row. `loading` leaves both untouched: the skeleton takes
 * `--event-list-held`, else `--event-list-last`, as its minimum height, so a refetch keeps the box.
 */
export function useHeldHeight(
  node: HTMLElement | null,
  mode: 'plain' | 'windowed' | 'loading' | 'none',
): void {
  useEffect(() => {
    const content = node?.firstElementChild
    if (node === null || content === null || content === undefined) return
    const el: HTMLElement = node
    if (mode === 'loading') return
    if (mode === 'none') {
      el.style.removeProperty(HELD)
      el.style.removeProperty(LAST)
      return
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => run())
    function run(): void {
      if (mode === 'plain') {
        el.style.setProperty(HELD, `${content?.getBoundingClientRect().height ?? 0}px`)
      } else if (observer === null || content?.querySelector('[data-index]') !== null) {
        // The seam has committed rows (or there is nothing to observe): the hold is spent.
        el.style.setProperty(LAST, `${content?.getBoundingClientRect().height ?? 0}px`)
        el.style.removeProperty(HELD)
        observer?.disconnect()
      }
    }
    observer?.observe(content)
    run()
    return () => observer?.disconnect()
  }, [node, mode])
}
