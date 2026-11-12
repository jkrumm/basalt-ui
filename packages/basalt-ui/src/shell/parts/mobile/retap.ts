/**
 * The retap law (concept section 4, invariant 16): tapping the ACTIVE destination scrolls the page
 * to its top, and only a tap that actually moved something swallows the navigation.
 *
 * The order is load-bearing. The scroll is attempted FIRST and the click is suppressed only if
 * something really moved: suppressing first while the real scroller is an inner element (a thread
 * pane, a table container) was a dead tap on exactly the pages with the most to scroll. A tap that
 * moved nothing on the location it is already at changes nothing and adds no history entry; a tap on
 * an ancestor tab while a deeper route is open still navigates, because the link's target is not
 * where the user is.
 *
 * Pure DOM: no React state, so the part keeps its one piece of state (which surface is open).
 */
import type { MouseEvent } from 'react'
import { SHELL_MAIN_ID } from '../a11y'

/** What a tap needs to know about the row it landed on. */
export type RetapTarget = { readonly active: boolean; readonly disabled: boolean }

/**
 * The deepest element under `root` that is CURRENTLY scrolled, or `null`. Deepest wins because nested
 * scrollers nest by specificity: a page scroller holding a thread pane means the pane is what the
 * user is looking at. A hidden box keeps its `scrollTop` forever, so visibility is part of "actually
 * scrolled"; `getClientRects()` is only asked of the few nodes that pass the cheap `scrollTop` test.
 */
export function deepestScrolledDescendant(root: ParentNode | null): HTMLElement | null {
  if (root === null) return null
  let best: HTMLElement | null = null
  let bestDepth = -1
  for (const node of root.querySelectorAll<HTMLElement>('*')) {
    if (node.scrollTop <= 0) continue
    if (node.getClientRects().length === 0) continue
    let depth = 0
    for (let parent = node.parentElement; parent !== null; parent = parent.parentElement) depth += 1
    if (depth > bestDepth) {
      best = node
      bestDepth = depth
    }
  }
  return best
}

function prefersReducedMotion(): boolean {
  // theme-allow raw-breakpoint — a reduced-motion read (the scroll behaviour), not a viewport read
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Scrolls `target` only if it has somewhere to go; the return value is "it scrolled". */
function scrollElementToTop(target: Element | null | undefined): boolean {
  if (target === null || target === undefined || target.scrollTop <= 0) return false
  target.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  return true
}

/**
 * Scrolls what the user is looking at to its top: `shell-main` first, then the deepest inner
 * scroller that is genuinely scrolled, then the document for a page rendered with no shell.
 * Returns whether anything moved.
 */
export function scrollShellToTop(): boolean {
  const main = document.getElementById(SHELL_MAIN_ID)
  if (scrollElementToTop(main)) return true
  if (scrollElementToTop(deepestScrolledDescendant(main ?? document.body))) return true
  return scrollElementToTop(document.scrollingElement ?? document.documentElement)
}

/**
 * One handler for every row that can be tapped (a bar tab, a row in the More surface), so the two
 * can never disagree about what a tap on the active destination means.
 *
 * `currentHref` is the router's current location; the click's own anchor is compared against it to
 * tell "already here" from "an ancestor of where I am". Returns `false` when a disabled row swallowed
 * the tap, so a caller that owns a surface knows not to dismiss it.
 */
export function retap(
  target: RetapTarget,
  event: MouseEvent<HTMLElement>,
  currentHref: string,
): boolean {
  if (target.disabled) {
    event.preventDefault()
    return false
  }
  if (!target.active) return true
  if (scrollShellToTop()) {
    event.preventDefault()
    return true
  }
  const anchor = event.currentTarget
  if (anchor instanceof HTMLAnchorElement && anchor.getAttribute('href') === currentHref) {
    event.preventDefault()
  }
  return true
}
