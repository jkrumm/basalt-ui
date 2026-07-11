/**
 * Auto y-domain lower-bound padding — shared by every `yAutoMinCeil`/`autoMinCeil` idiom across
 * the kinds (MultiLine, ZonedLine, Bars' left/right axes).
 *
 * The lower bound must always pad AWAY from the data (`lower <= candidate`), never toward it —
 * a naive `candidate * pad` clips data whenever `candidate` is positive (padding a positive floor
 * UP moves it toward, and past, the data minimum). This is exactly the `yAutoMinCeil={Infinity}`
 * ("no forced zero baseline") idiom: `candidate` becomes the raw data minimum, which is usually
 * positive (e.g. a body-weight series bottoming out at 78), and the old multiplicative pad shoved
 * the axis floor above it.
 *
 * `candidate` is the caller's `Math.min(dataMin, ceil)` — the ceiling has already been applied.
 *  - `candidate === 0` (the common default-zero-baseline case: positive-only data with the
 *    default `ceil = 0`) stays exactly 0 — never pushed negative.
 *  - `candidate > 0` divides by `pad`, moving the floor DOWN toward (and below) the candidate.
 *  - `candidate < 0` multiplies by `pad`, moving the floor further DOWN (more negative) — the
 *    pre-existing, still-correct behavior for genuinely negative-swinging metrics.
 */
export function padAutoLower(candidate: number, pad: number): number {
  if (candidate === 0) return 0
  return candidate > 0 ? candidate / pad : candidate * pad
}
