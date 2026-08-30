/**
 * 1-2-5 mantissa tick law for a log axis (`docs/CHARTS-SPEC.md` §2).
 *
 * d3's own `scaleLog().ticks()` multiplies the mantissa density by the number of decades the
 * domain spans, so a wide financial range (e.g. $10k–$300k) reads `$316,228 / $100,000 / $31,623 /
 * $10,000` — every finance reference instead ticks a log price axis at `{1, 2, 5} × 10^n`
 * (`$10,000 · $20,000 · $50,000 · $100,000`). Pure, no visx dependency, so both the measured
 * (`probeAxisLabels`) and painted (`CartesianChart`) sides can share the exact same tick list.
 */

/**
 * Escalating mantissa sets: the strict {1, 2, 5} law first, then progressively denser sets used
 * only when the stricter one leaves too few in-domain candidates to read — a short span (a
 * one-year BTC window, say, $58k–$139k) collapses {1, 2, 5} to a single tick, which is
 * unreadable. Each set is ascending and never crosses a decade boundary within itself
 * (`9 × 10^k < 1 × 10^(k+1)`), so the flatMap output stays sorted with no explicit sort.
 */
const MANTISSA_SETS = [
  [1, 2, 5],
  [1, 1.5, 2, 3, 4, 5, 7],
  [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9],
] as const

/** Below this many in-domain candidates, escalate to the next denser mantissa set. */
const DENSIFY_BELOW = 4

/** Every base-10 exponent whose decade touches `[min, max]`. */
function decadeExponents(min: number, max: number): number[] {
  const lo = Math.floor(Math.log10(min))
  const hi = Math.ceil(Math.log10(max))
  const exponents: number[] = []
  for (let k = lo; k <= hi; k++) exponents.push(k)
  return exponents
}

/**
 * Thin an ascending, over-budget value list toward `ticks`, keeping both extremes — a stride
 * derived from the budget (`Math.ceil(length / ticks)`) rather than a fixed 2, so the result
 * actually tracks `ticks` instead of only ever halving regardless of how far over budget the input
 * is. May return one more than `ticks` when the last value doesn't land on the stride (an even
 * decade count, say): keeping the axis's top labeled matters more than the exact count.
 */
function thinToBudget(values: number[], ticks: number): number[] {
  if (values.length <= ticks) return values
  const stride = Math.ceil(values.length / ticks)
  const thinned = values.filter((_, i) => i % stride === 0)
  const last = values[values.length - 1] as number
  return thinned[thinned.length - 1] === last ? thinned : [...thinned, last]
}

/**
 * Every `{1, 2, 5} × 10^k` value for every decade touching `[min, max]`, filtered to the domain —
 * escalating through {@link MANTISSA_SETS} while a set leaves fewer than {@link DENSIFY_BELOW}
 * candidates (a short span collapses the strict law to one tick). The exact same list is what
 * `probeAxisLabels` measures and what `CartesianChart` paints, so the two can never disagree.
 * An over-budget result collapses to whole decades only when the decades ALONE form a readable
 * axis ({@link DENSIFY_BELOW}+ in-domain); otherwise it is thinned by a budget-derived stride
 * (may exceed `ticks` by one — see {@link thinToBudget}). Collapsing to decades unconditionally
 * is the bug this ordering exists to prevent: a 4-year BTC window ($15.5k–$139k) holds ONE whole
 * decade, so the collapse produced a single-tick axis. Never returns a non-positive value; a
 * non-positive or inverted domain (a log axis has no zero and no reversed extent) returns `[]`.
 */
export function logTickValues([min, max]: readonly [number, number], ticks: number): number[] {
  if (min <= 0 || max <= 0 || min >= max) return []

  const exponents = decadeExponents(min, max)
  const inDomain = (v: number): boolean => v >= min && v <= max
  const collect = (mantissas: readonly number[]): number[] =>
    exponents.flatMap((k) => mantissas.map((m) => m * 10 ** k)).filter(inDomain)

  let resolved: number[] = []
  for (const mantissas of MANTISSA_SETS) {
    resolved = collect(mantissas)
    if (resolved.length >= DENSIFY_BELOW) break
  }

  if (resolved.length <= ticks) return resolved

  const decades = exponents.map((k) => 10 ** k).filter(inDomain)
  if (decades.length >= DENSIFY_BELOW) return thinToBudget(decades, ticks)

  return thinToBudget(resolved, ticks)
}

/** Round a domain outward to the nearest enclosing power-of-10 bounds — the log analog of
 * `scale.nice()`, used to keep `probeAxisLabels` (measurement) and the real niced scale
 * (rendering) computing ticks from the same rounded domain. */
export function niceLogDomain([min, max]: readonly [number, number]): [number, number] {
  return [10 ** Math.floor(Math.log10(min)), 10 ** Math.ceil(Math.log10(max))]
}
