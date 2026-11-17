/** The `id` of the shell's one scrollport: the skip link's target and where lost focus lands. */
export const SHELL_MAIN_ID = 'shell-main'

/** Whether focus fell to the document: nothing is focused, or it is `<body>`. */
export function focusLost(): boolean {
  const active = document.activeElement
  return active === null || active === document.body
}

/** Puts focus on the shell's main (it has `tabindex="-1"`); without a shell there is nothing to do. */
export function focusMain(): void {
  document.getElementById(SHELL_MAIN_ID)?.focus({ preventScroll: true })
}

/** An overlay still on screen: the palette's dialog or the More sheet, in or on its way out. */
const OVERLAY = '[data-slot="dialog-content"], [data-slot="sheet-content"]'

/** Whether an overlay is still on screen. */
export function overlayOpen(): boolean {
  return document.querySelector(OVERLAY) !== null
}

/**
 * Puts focus on main once no overlay is left and two frames have passed since, the overlay's own
 * focus return (to the control that opened it) having finished by then. It gives up waiting for the
 * overlay after `HAND_OFF_MS`. Returns the cancel.
 */
export function focusMainWhenClear(): () => void {
  const until = Date.now() + HAND_OFF_MS
  let clear = 0
  let frame = 0
  const tick = (): void => {
    if (document.querySelector(OVERLAY) !== null && Date.now() < until) {
      clear = 0
    } else if (++clear >= 2) {
      focusMain()
      return
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(frame)
}

/** How long a hand-off request waits for its navigation, in ms. */
const HAND_OFF_MS = 4000

let handOffAt = Number.NEGATIVE_INFINITY

/**
 * Marks the navigation about to start as one that leaves focus on a control that is not the new
 * page's (the palette's dialog, the More sheet's tab): the shell then hands focus to main once the
 * pathname changes, even though focus is not on `<body>`. A request no navigation answered within
 * `HAND_OFF_MS` lapses.
 */
export function requestMainFocus(): void {
  handOffAt = Date.now()
}

/** Whether a request is pending; reading it clears it. */
export function takeMainFocusRequest(): boolean {
  const pending = Date.now() - handOffAt <= HAND_OFF_MS
  handOffAt = Number.NEGATIVE_INFINITY
  return pending
}
