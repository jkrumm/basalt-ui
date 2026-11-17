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
