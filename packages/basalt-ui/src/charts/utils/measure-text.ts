/**
 * Text measurement for chart layout — the input to {@link autoMargin}.
 *
 * A static margin token cannot know how wide a tick label is, which is why charts used to have to be
 * hand-nudged whenever a label grew (`docs/CHARTS-SPEC.md` §1). This measures the strings that
 * will actually be painted, via an OFFSCREEN canvas 2D context: no element is attached, so there
 * is no layout thrash and no reflow — unlike an SVG `getBBox()` probe.
 *
 * Mantine-free and dependency-free by construction (`charts/**` boundary).
 */

/** Fallback advance width per character, as a fraction of the font size, when no DOM is
 * available (SSR, `renderToStaticMarkup`). Mono faces sit near 0.6em; being deterministic matters
 * more than being exact, since the measured value is only ever a floor-raiser. */
const FALLBACK_CHAR_RATIO = 0.6

/** Last-resort family when the `--basalt-font-mono` custom property cannot be read. */
const FALLBACK_MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

/**
 * Cap on the memo table. Tick labels are low-cardinality per chart, but a long-lived SPA with a
 * live counter or currency axis mints a new string every update, and an unbounded module-level Map
 * would then grow for the life of the tab. On overflow the whole table is dropped rather than
 * evicted one by one: the working set is tiny and re-measuring it costs microseconds, so an LRU's
 * bookkeeping would cost more than the misses it avoids.
 */
const CACHE_LIMIT = 2000

const cache = new Map<string, number>()

let ctx: CanvasRenderingContext2D | null | undefined
let monoFamily: string | undefined

function canvasContext(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx
  if (typeof document === 'undefined') {
    ctx = null
    return ctx
  }
  ctx = document.createElement('canvas').getContext('2d')
  // Webfonts swap in after first paint; measurements taken against the fallback face would then
  // be stale (usually too narrow). Drop the cache once, when the real faces are ready.
  // `?.` on every hop: a non-browser DOM harness can expose `document` with no `fonts`, or a
  // `fonts` with no `ready` — neither is a reason to fail a measurement.
  document.fonts?.ready?.then?.(() => cache.clear()).catch(() => {})
  return ctx
}

/**
 * The resolved value of `--basalt-font-mono` — canvas needs a concrete family list, it cannot
 * resolve a CSS custom property. Read once from the document element.
 */
export function monoFontFamily(): string {
  if (monoFamily !== undefined) return monoFamily
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    monoFamily = FALLBACK_MONO
    return monoFamily
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--basalt-font-mono')
    .trim()
  monoFamily = value.length > 0 ? value : FALLBACK_MONO
  return monoFamily
}

/**
 * Width in px of `text` at `fontPx` in the chart tick font. Memoized per `font|text` — a chart
 * re-measures the same ~10 tick labels on every resize, and the cache turns that into a Map hit.
 */
export function measureText(text: string, fontPx: number, fontFamily?: string): number {
  const family = fontFamily ?? monoFontFamily()
  const font = `${fontPx}px ${family}`
  const key = `${font}|${text}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  const c = canvasContext()
  let width: number
  if (c === null) {
    width = text.length * fontPx * FALLBACK_CHAR_RATIO
  } else {
    c.font = font
    width = c.measureText(text).width
  }
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(key, width)
  return width
}

/** Widest of `texts` at `fontPx`. Returns 0 for an empty list. */
export function maxTextWidth(
  texts: readonly string[],
  fontPx: number,
  fontFamily?: string,
): number {
  let max = 0
  for (const text of texts) {
    const width = measureText(text, fontPx, fontFamily)
    if (width > max) max = width
  }
  return max
}

/** Test seam — drops the memo table (and the resolved family) so a test can change fonts. */
export function resetTextMetrics(): void {
  cache.clear()
  ctx = undefined
  monoFamily = undefined
}
