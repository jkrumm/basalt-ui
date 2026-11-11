/**
 * Which TOC entry the reader just ASKED for, until the page has caught up.
 *
 *   idle ──click──▶ pinned{id} ──scrollend / 200 ms without scrolling──▶ held{id, top}
 *     ▲                │ scroll intent                            │ scroll moves > ε (any cause),
 *     └────────────────┴──────────────────────────────────────────┘ scroll intent, id gone, unmount
 *
 * The clicked heading rests under the sticky header, above the spy's band, so the spy cannot be
 * trusted while the click's scroll is in flight; once it has settled the spy's own answer is right
 * and the hold only has to cover the short-tail case. So: pinned while the scroll runs (until its
 * `scrollend`, or until the scroller has been quiet for a moment where there is none), held where it
 * settled, and handed back the moment
 * the position moves for ANY reason — reader, find-in-page, focus, layout shift, app scroll.
 */
import { useEffect, useState } from 'react'

/**
 * How long the scroller must be quiet before a pinned click counts as settled: the fallback for a
 * browser without a reliable `scrollend`, and the only signal for a click that needs no scroll.
 */
export const QUIET_MS = 200
/** Scroll movement tolerated while held (sub-pixel offsets, fractional DPR). */
export const HOLD_EPSILON_PX = 2

const SCROLL_KEYS: ReadonlySet<string> = new Set([
  'PageUp',
  'PageDown',
  'Home',
  'End',
  'ArrowUp',
  'ArrowDown',
  ' ',
])

/** Where the reader's input is aimed at text entry — through shadow roots, via the composed path. */
const isEditable = (event: Event): boolean =>
  event
    .composedPath()
    .some(
      (node) =>
        node instanceof HTMLElement &&
        (node.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName)),
    )

/** The document-level events that mean the reader is about to scroll (or may have). */
export const INTENT_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const

/**
 * Did the reader just do something that scrolls (or may scroll) the page? `link` is the rail link
 * that was activated: pointing at it is the click itself, and Enter on it is not a scroll key.
 */
export function isScrollIntent(event: Event, link: Element | null): boolean {
  switch (event.type) {
    case 'wheel':
    case 'touchstart':
      return true
    case 'pointerdown':
      return !(event.target instanceof Node && link?.contains(event.target))
    case 'keydown':
      return event instanceof KeyboardEvent && SCROLL_KEYS.has(event.key) && !isEditable(event)
    default:
      return false
  }
}

function scrollTopOf(scroller: HTMLElement | null): number {
  return scroller ? scroller.scrollTop : window.scrollY
}

type ClickPinState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pinned'; readonly id: string }
  | { readonly kind: 'held'; readonly id: string; readonly top: number }

export class ClickPin {
  private current: ClickPinState = { kind: 'idle' }
  private stop: (() => void) | null = null

  /** `onIdle` runs when the machine hands the rail back, so the spy can re-resolve. */
  constructor(private readonly onIdle: () => void) {}

  get state(): ClickPinState {
    return this.current
  }

  /** The entry the click owns (pinned or held), or `null` when the spy answers. A pure query. */
  get activeId(): string | null {
    return this.current.kind === 'idle' ? null : this.current.id
  }

  /** `link` is the rail link just activated; `scroller` the element the spy watches (`null` = document). */
  click(id: string, link: Element | null, scroller: HTMLElement | null): void {
    this.stop?.()
    this.current = { kind: 'pinned', id }

    const target: Window | HTMLElement = scroller ?? window
    let quiet: ReturnType<typeof setTimeout> | undefined
    const hold = () => {
      clearTimeout(quiet)
      if (this.current.kind !== 'pinned') return
      this.current = { kind: 'held', id, top: scrollTopOf(scroller) }
    }
    const onScroll = () => {
      const state = this.current
      if (state.kind === 'pinned') {
        clearTimeout(quiet)
        quiet = setTimeout(hold, QUIET_MS)
      } else if (
        state.kind === 'held' &&
        Math.abs(scrollTopOf(scroller) - state.top) > HOLD_EPSILON_PX
      ) {
        this.release()
      }
    }
    const onIntent = (event: Event) => {
      if (isScrollIntent(event, link)) this.release()
    }
    quiet = setTimeout(hold, QUIET_MS)
    target.addEventListener('scrollend', hold, { once: true })
    target.addEventListener('scroll', onScroll, { passive: true })
    for (const type of INTENT_EVENTS) document.addEventListener(type, onIntent, { capture: true })
    this.stop = () => {
      clearTimeout(quiet)
      target.removeEventListener('scrollend', hold)
      target.removeEventListener('scroll', onScroll)
      for (const type of INTENT_EVENTS) {
        document.removeEventListener(type, onIntent, { capture: true })
      }
    }
  }

  /** Items changed: a click on an id that no longer exists cannot stand. */
  prune(ids: readonly string[]): void {
    if (this.current.kind !== 'idle' && !ids.includes(this.current.id)) this.release()
  }

  release(): void {
    if (this.current.kind === 'idle') return
    this.dispose()
    this.onIdle()
  }

  /** Unmount: idle, timer and listeners gone, no callback. */
  dispose(): void {
    this.stop?.()
    this.stop = null
    this.current = { kind: 'idle' }
  }
}

/** `onIdle` must be stable (a state setter): it is captured once, at construction. */
export function useClickPin(onIdle: () => void): ClickPin {
  const [pin] = useState(() => new ClickPin(onIdle))
  useEffect(() => () => pin.dispose(), [pin])
  return pin
}
