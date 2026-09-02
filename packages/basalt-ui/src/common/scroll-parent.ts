/**
 * `scrollParentOf` — which box actually scrolls `el`.
 *
 * Since `BasaltShell` made `AppShell.Main` the scrollport (`shell/app-main.module.css`), the
 * document no longer scrolls inside a shell: `window.scrollY` is pinned at 0 and a `scroll`
 * listener on `window` never fires. Everything in the package that reacted to page scroll had to
 * stop asking the window and start asking whichever ancestor is really scrolling — and it has to
 * keep working in a SHELL-LESS app, where the answer genuinely is the window.
 *
 * `null` IS the answer for "the document scrolls this", not a failure — callers listen on `window`
 * and read `window.scrollY` in that case.
 */

/** The attribute `BasaltShell` puts on `AppShell.Main`. Also the public handle for a consumer. */
export const SCROLLPORT_ATTRIBUTE = 'data-basalt-scrollport'

function isScrollport(element: HTMLElement): boolean {
  // The declared handle wins outright: Main is a scrollport by construction even on the frame where
  // its content is short enough that `scrollHeight === clientHeight`.
  if (element.hasAttribute(SCROLLPORT_ATTRIBUTE)) return true
  const overflowY = getComputedStyle(element).overflowY
  if (overflowY !== 'auto' && overflowY !== 'scroll') return false
  return element.scrollHeight > element.clientHeight
}

/**
 * The nearest scrolling ANCESTOR of `el`, or `null` when the document is the scroller.
 *
 * `el` itself is never considered — the question is which box scrolls it, not whether it scrolls
 * its own children. `<body>` and `<html>` are never returned either: an app that scrolls at the
 * document level is exactly the `null` case.
 */
export function scrollParentOf(el: Element | null): HTMLElement | null {
  if (el === null || typeof window === 'undefined') return null
  const root = el.ownerDocument.documentElement
  let node = el.parentElement
  while (node !== null && node !== root && node !== el.ownerDocument.body) {
    if (isScrollport(node)) return node
    node = node.parentElement
  }
  return null
}
