/**
 * The grace a list gives a shared chart focus when the pointer leaves it. The pointer crossing from
 * one list to the next (two cards side by side at 1800 px, two stacked at 390 px) spends a moment
 * over the gap between them; clearing there drops the dim and the readout, and the next list's row
 * brings them back, so the page flickers. A pointer leave asks the focus to release instead: the
 * clear runs after `RELEASE_MS` unless something sets the focus first (a row of any list, the
 * chart's own pointer, a key). The window is the measured crossing of a card gap by the lead's
 * pointer sweep (60 ms at the gap, then 340 ms before the next card); a blur, an Escape and a tap
 * still clear at once. `useChartFocus` installs the release on its handle.
 */
export const RELEASE_MS = 500

/** The key a focus handle carries its release under (the hook that owns the timer sets it). */
export const FOCUS_RELEASE = Symbol.for('basalt.focusRelease')

type Release = (clear: () => void) => void
export type ReleaseSide = { [FOCUS_RELEASE]?: Release }

/** The release of a focus handle: runs `clear` after the grace, or at once for a handle with none. */
export function releaseOf(focus: object): Release {
  return (focus as ReleaseSide)[FOCUS_RELEASE] ?? ((clear) => clear())
}
