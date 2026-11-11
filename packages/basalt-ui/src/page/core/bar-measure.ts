/**
 * Band measure: publishes the page bar's measured height as `--page-bar-h` (docs/v3/concepts/
 * shell-nav-router.md section 4, "Band"; spike S1). Headless: no React, only the DOM a caller hands
 * in. The React side is a callback ref plus a layout effect, so the first publish lands before the
 * first paint:
 *
 * ```ts
 * const attach = (el) => { setNode(el); if (el) publishBarHeight(el, target) }  // ref callback
 * useLayoutEffect(() => (node ? observeBarHeight(node, target) : undefined), [node, target])
 * ```
 *
 * - The height is the content box with the border outside, read with `getBoundingClientRect` so a
 *   fractional height survives (the seam stays 0 at @1x, @2x and @3x).
 * - A `height > 0` guard: a ResizeObserver fires once with a zero box while the band is still being
 *   laid out (and again whenever it is hidden); publishing that zero collapsed consumers' sticky
 *   offsets mid-navigation.
 * - The FIRST publish on a target re-aims `location.hash` once, instantly: the browser's fragment
 *   scroll on a cold `/page#anchor` load ran before the property existed, so the heading sits under
 *   the band. Later height changes never yank a reader who has scrolled away.
 */

export const PAGE_BAR_HEIGHT_VAR = '--page-bar-h'

/** Where the property is written: `Page`'s element, or the shell root for the aside mirror. */
export type BarMeasureTarget = HTMLElement

/** Publishes `node`'s height onto `target`. Returns whether it published (false for height 0). */
export function publishBarHeight(
  node: HTMLElement,
  target: BarMeasureTarget = document.documentElement,
): boolean {
  const { height } = node.getBoundingClientRect()
  if (!(height > 0)) return false
  const first = target.style.getPropertyValue(PAGE_BAR_HEIGHT_VAR) === ''
  target.style.setProperty(PAGE_BAR_HEIGHT_VAR, `${height}px`)
  if (first) reaimHash()
  return true
}

function reaimHash(): void {
  if (location.hash.length <= 1) return
  let id: string
  try {
    id = decodeURIComponent(location.hash.slice(1))
  } catch {
    return
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'instant' })
}

/**
 * Publishes now and on every resize of `node`; the returned cleanup disconnects and removes the
 * property, so a route without a bar does not inherit the last one's height. Without a
 * `ResizeObserver` (a test DOM) the one-shot publish still ran.
 */
export function observeBarHeight(
  node: HTMLElement,
  target: BarMeasureTarget = document.documentElement,
): () => void {
  const publish = () => void publishBarHeight(node, target)
  publish()
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(publish)
  observer?.observe(node)
  return () => {
    observer?.disconnect()
    target.style.removeProperty(PAGE_BAR_HEIGHT_VAR)
  }
}
