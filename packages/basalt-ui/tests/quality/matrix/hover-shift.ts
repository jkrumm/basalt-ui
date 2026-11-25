/**
 * The hover guard: a hover changes what a chart's readout says, never where the chart sits or what the
 * rest of its card says. Sweeps the pointer across each chart plot on a page and names every plot that,
 * while the pointer was over it:
 *
 * - moved (owner review 1, n04: a line that opens on hover pushes the plot from under the pointer,
 *   focus clears, the line closes, and it starts again);
 * - had its tooltip change side more than once (owner review 2: a tooltip that flips above and below
 *   the next datum jumps the height of itself for a 10 px pointer move);
 * - drew a hover chip (the value pinned to an axis) over a tick label that stayed visible, or drew the
 *   same x chip on charts stacked one above the other (owner review 2 rerun: a y chip on the tick
 *   column, an x chip on the baseline of every panel);
 * - changed any text, or any element's width, in its card outside the tooltip, the plot's svg and the
 *   reserved readout line (`[data-slot="chart-readout"]`, whose own box keeps its width): owner review
 *   2 saw the headline figure swap for the hovered hour, a delta badge swap for a status pill and a side
 *   value change width, so the whole card changed on every hour.
 */
import type { Page } from 'playwright-core'

/**
 * Pages whose plot still moves for a cause outside the kit, by `<route> <width>`, each with its
 * follow-up. An entry must keep failing: the guard fails when it passes, so the fix removes it.
 */
export const KNOWN_SHIFTS: Readonly<Record<string, string>> = {
  '/scenarios/expr-c13 390':
    'the page hand-scrolls its table row with scrollIntoView on focus, which scrolls the shell (Issue 2134)',
}

/**
 * Trial builds whose card text follows the focus (a figure fed from `focus.readout`), by route
 * prefix. They are never hand-finished: `v3-owner-2-rerun` rebuilds them on the contract that keeps
 * the headline, and their card findings (text, width) are reported but do not fail the page. A plot
 * that moves or a tooltip that flips still fails them: those are the kit's.
 */
export const TRIAL_PAGES: readonly string[] = ['/scenarios/expr-', '/cycle/']

/** Trial builds `v3-owner-2-rerun` rebuilt on that contract: their card is checked like any page's. */
export const REBUILT_PAGES: readonly string[] = ['/scenarios/expr-n04', '/cycle/shell-6']

/** The boxes a pointer sweeps: a cartesian chart's root and an answering sparkline's plot. */
const PLOTS = '[data-basalt-chart], [data-slot="spark-plot"]'
/** Where across the plot the pointer stops, as a share of its width, at half its height: 16 stops, a sweep fine enough to cross every band of a 48-hour chart's six-hour ticks. */
const STOPS = Array.from({ length: 16 }, (_, i) => 0.03 + (0.94 * i) / 15)
/** Sub-pixel layout noise stays below this. */
const TOLERANCE_PX = 0.5
/** The tooltip's show delay (`TOOLTIP_DELAY.show`, 150 ms) and a frame of air: waited once, at the first stop. */
const SHOW_WAIT_MS = 250
/** A page of many small charts is judged on its first ones: the cause is shared, the sweep is not free. */
const MAX_PLOTS = 8

const frames = (page: Page): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  )

/** One element of a card: its tag, its own text and its width. */
type Item = readonly [tag: string, text: string, width: number]
/** What a stop sees: the visible tooltip's side (`null` when none shows) and the card's items. */
type Frame = { side: string | null; items: readonly Item[] }

/** Runs in the page: the plot's card, read as its items in document order, and the tooltip's side. */
function readFrame(plot: Element): Frame {
  const card =
    plot.closest('[data-slot="chart-card"], [data-slot="stat-card"]') ??
    plot.closest('[data-slot="card"]') ??
    plot.parentElement ??
    plot
  const items: [string, string, number][] = []
  for (const el of [card, ...card.querySelectorAll('*')]) {
    if (el.closest('svg, .ts-chart-tooltip') !== null) continue
    if (el.parentElement?.closest('[data-slot="chart-readout"]')) continue
    const box = el.getBoundingClientRect()
    // A visually hidden live region (1 px, clipped) speaks the readout; it is not on screen.
    if (box.width <= 1 && box.height <= 1 && getComputedStyle(el).position === 'absolute') continue
    // The readout line's own box is held to its width; its text is the readout's to change.
    let text = ''
    if (!el.matches('[data-slot="chart-readout"]'))
      for (const node of el.childNodes) if (node.nodeType === 3) text += node.textContent ?? ''
    items.push([el.tagName.toLowerCase(), text.trim(), Math.round(box.width * 10) / 10])
  }
  // A followed readout (`tooltip.follow`) paints a tooltip in every chart on the cursor: the side is
  // the hovered plot's own, the visible tooltip nearest its box.
  const plotBox = plot.getBoundingClientRect()
  const gap = (r: DOMRect): number =>
    Math.max(plotBox.top - r.bottom, r.top - plotBox.bottom, 0) +
    Math.max(plotBox.left - r.right, r.left - plotBox.right, 0)
  let side: string | null = null
  let nearest = Infinity
  for (const tip of document.querySelectorAll<HTMLElement>('.ts-chart-tooltip')) {
    if (tip.hidden || getComputedStyle(tip).display === 'none') continue
    const box = tip.getBoundingClientRect()
    if (box.width === 0) continue
    if (gap(box) > nearest) continue
    nearest = gap(box)
    side = tip.dataset['placement'] ?? 'auto'
  }
  return { side, items }
}

const say = (item: Item | undefined): string =>
  item === undefined ? 'nothing' : `${item[0]}${item[1] === '' ? '' : ` "${item[1].slice(0, 40)}"`}`

/** The first way `now` differs from `rest` outside the readout line, or `null`. */
function cardChange(rest: readonly Item[], now: readonly Item[]): string | null {
  if (rest.length !== now.length) {
    const at = rest.findIndex((item, i) => item[0] !== now[i]?.[0] || item[1] !== now[i]?.[1])
    const i = at < 0 ? Math.min(rest.length, now.length) : at
    return `elements changed: ${say(rest[i])} became ${say(now[i])}`
  }
  // A text change names the cause; the widths it moves are its effect, so text is read first.
  for (const [i, was] of rest.entries()) {
    const is = now[i] as Item
    if (was[1] !== is[1]) return `text changed: ${say(was)} became "${is[1].slice(0, 40)}"`
  }
  for (const [i, was] of rest.entries()) {
    const is = now[i] as Item
    if (Math.abs(was[2] - is[2]) > TOLERANCE_PX)
      return `width changed: ${say(was)} ${was[2]} to ${is[2]} px`
  }
  return null
}

/** Air kept round a tick label's text before a chip counts as covering it, px: a text box is a line box taller than its glyphs. */
const GLYPH_AIR_X = 1
const GLYPH_AIR_Y = 2
/** Wait before the chips are read at a stop, ms: the tick labels' opacity follows the focus a frame or two later. */
const CHIP_SETTLE_MS = 80
/** Charts this close one above the other (or closer) are one stack, px. */
const STACK_GAP = 24

/**
 * Runs in the page: the hover chips (`.ts-chart__crosshair-label`) of every chart, at the pointer's
 * stop. Names each chip that covers a tick label still visible (axis texts: `g.ts-chart__axes`, the
 * axis titles included; the engine's opacity callback blanks the ticks a chip lands on), and each x chip
 * that shows with the same text on two charts stacked one above the other: only the panel that
 * labels the axis carries it.
 */
function readChips(air: { x: number; y: number; stackGap: number }): string[] {
  const { x: glyphAirX, y: glyphAirY, stackGap } = air
  const found: string[] = []
  const charts = [...document.querySelectorAll<HTMLElement>('[data-basalt-chart]')]
  const seen = (el: Element, chart: Element): number => {
    let opacity = 1
    for (let n: Element | null = el; n !== null && n !== chart; n = n.parentElement)
      opacity *= Number(getComputedStyle(n).opacity)
    return opacity
  }
  const labelOf = (chart: HTMLElement, i: number): string =>
    (
      chart.closest('[data-slot="chart-card"], [data-slot="stat-card"]')?.querySelector('h2, h3, p')
        ?.textContent ??
      chart.getAttribute('aria-label') ??
      `chart ${i + 1}`
    ).trim()
  const xChips: { chart: HTMLElement; text: string }[] = []
  for (const [i, chart] of charts.entries()) {
    const texts = [...chart.querySelectorAll<SVGTextElement>('svg text')]
    // A chart that lost focus keeps its chips in the DOM, `visibility: hidden` (it inherits from the guide layer).
    const chips = texts.filter(
      (t) =>
        t.classList.contains('ts-chart__crosshair-label-text') &&
        getComputedStyle(t).visibility !== 'hidden',
    )
    if (chips.length === 0) continue
    const ticks = texts.filter(
      (t) =>
        t.closest('g.ts-chart__axes') !== null &&
        (t.textContent ?? '').trim() !== '' &&
        seen(t, chart) > 0.05,
    )
    for (const chip of chips) {
      const a = chip.getBoundingClientRect()
      const axis = chip.classList.contains('ts-chart__crosshair-label--x') ? 'x' : 'y'
      const chipText = (chip.textContent ?? '').trim()
      // A chart that follows another's cursor draws its chip empty: nothing to cover.
      if (chipText === '') continue
      if (axis === 'x') xChips.push({ chart, text: chipText })
      for (const tick of ticks) {
        const b = tick.getBoundingClientRect()
        // Each text gives up its own leading and its own side bearing.
        const apart =
          a.right - glyphAirX <= b.left + glyphAirX ||
          b.right - glyphAirX <= a.left + glyphAirX ||
          a.bottom - glyphAirY <= b.top + glyphAirY ||
          b.bottom - glyphAirY <= a.top + glyphAirY
        if (!apart)
          found.push(
            `${labelOf(chart, i)}: the ${axis} chip "${chipText}" covers the tick label "${(tick.textContent ?? '').trim()}"`,
          )
      }
    }
  }
  for (const [i, one] of xChips.entries()) {
    for (const other of xChips.slice(i + 1)) {
      if (one.text !== other.text || one.chart === other.chart) continue
      const a = one.chart.getBoundingClientRect()
      const b = other.chart.getBoundingClientRect()
      const column = Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1
      const gap = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom)
      if (column && gap <= stackGap)
        found.push(`the x chip "${one.text}" is drawn on two charts stacked one above the other`)
    }
  }
  return [...new Set(found)]
}

export type HoverFinding = {
  /** `moved`, `tooltip` and `chip` are the kit's; `card` is the page's or the card's. */
  kind: 'moved' | 'tooltip' | 'chip' | 'card'
  text: string
}

/** The chip check of the page at the pointer's current stop: what it names, as `<chart>: <what>`. */
export function chipFindingsNow(page: Page): Promise<string[]> {
  return page.evaluate(readChips, { x: GLYPH_AIR_X, y: GLYPH_AIR_Y, stackGap: STACK_GAP })
}

/** Every finding of a sweep across each plot on the page, as `<label>: <what>`; empty when calm. */
export async function hoverFindings(page: Page): Promise<HoverFinding[]> {
  const plots = page.locator(PLOTS)
  const count = Math.min(await plots.count(), MAX_PLOTS)
  const found: HoverFinding[] = []
  const chips = new Set<string>()
  for (let i = 0; i < count; i++) {
    const plot = plots.nth(i)
    if (!(await plot.isVisible())) continue
    await plot.scrollIntoViewIfNeeded()
    await page.mouse.move(0, 0)
    await frames(page)
    const rest = await plot.boundingBox()
    if (rest === null || rest.width < 8 || rest.height < 8) continue
    const label = (
      (await plot.evaluate(
        (el) =>
          el
            .closest('[data-slot="chart-card"], [data-slot="stat-card"]')
            ?.querySelector('h2, h3, p')?.textContent ??
          el.getAttribute('aria-label') ??
          el.querySelector('[aria-label]')?.getAttribute('aria-label'),
      )) ?? `plot ${i + 1}`
    ).trim()
    const atRest = await plot.evaluate(readFrame)
    const sides: string[] = []
    let moved: string | null = null
    let card: string | null = null
    for (const [n, stop] of STOPS.entries()) {
      await page.mouse.move(rest.x + rest.width * stop, rest.y + rest.height / 2)
      await frames(page)
      if (n === 0) await page.waitForTimeout(SHOW_WAIT_MS)
      const now = await plot.boundingBox()
      if (now === null) break
      const dx = now.x - rest.x
      const dy = now.y - rest.y
      if (moved === null && (Math.abs(dx) > TOLERANCE_PX || Math.abs(dy) > TOLERANCE_PX))
        moved = `moved ${dx.toFixed(1)},${dy.toFixed(1)} px at ${stop.toFixed(2)}`
      // The engine restores a tick label's opacity after layout, a follower chart a frame later: read once settled.
      await page.waitForTimeout(CHIP_SETTLE_MS)
      for (const text of await chipFindingsNow(page)) chips.add(text)
      const frame = await plot.evaluate(readFrame)
      if (frame.side !== null && frame.side !== sides.at(-1)) sides.push(frame.side)
      card ??= cardChange(atRest.items, frame.items)
      if (card !== null && !card.includes(' at ')) card += ` at ${stop.toFixed(2)}`
    }
    if (moved !== null) found.push({ kind: 'moved', text: `${label}: ${moved}` })
    if (sides.length > 2)
      found.push({
        kind: 'tooltip',
        text: `${label}: tooltip changed side ${sides.length - 1} times (${sides.join(' > ')})`,
      })
    if (card !== null) found.push({ kind: 'card', text: `${label}: ${card}` })
  }
  await page.mouse.move(0, 0)
  for (const text of chips) found.push({ kind: 'chip', text })
  return found
}

/** Every plot that moved under the pointer, as `<label>: moved <dx>,<dy> px at <stop>`; empty when none. */
export async function hoverShift(page: Page): Promise<string[]> {
  return (await hoverFindings(page)).filter((f) => f.kind === 'moved').map((f) => f.text)
}
