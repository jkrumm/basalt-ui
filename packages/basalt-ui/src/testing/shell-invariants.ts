/**
 * `expectShellInvariants`: the geometry rules an `AppShell` page keeps whatever its pixels look
 * like, measured with `getBoundingClientRect` through `data-slot` selectors (never a class name), so
 * a 2 px drift fails even where a screenshot baseline was regenerated carelessly. Ported from
 * shutterflow's `invariants.spec.ts`; the shell concept's section 6 names the rules.
 *
 * Two halves: `measureShell` runs inside the page and returns raw numbers; `judgeShell` is pure and
 * returns the broken rules, so the verdict is testable on seeded geometry without a browser.
 */

/** A rail state the helper drives the page into before it measures. */
export type ShellInvariantState = 'expanded' | 'collapsed'

/**
 * The slice of a Playwright `Page` the helper needs, so a consumer passes its own page and
 * `basalt-ui/testing` carries no browser dependency.
 */
export type ShellInvariantsPage = {
  evaluate<R>(fn: () => R): Promise<R>
  locator(selector: string): { click(): Promise<unknown> }
  setViewportSize(size: { width: number; height: number }): Promise<void>
}

export type ShellInvariantsOptions = {
  /** Rail states to check at the page's viewport. Default: both. */
  states?: readonly ShellInvariantState[]
  /** Tolerance in px for equal-spacing and alignment rules. Default 1. */
  tolerance?: number
}

type Box = { top: number; bottom: number; left: number; right: number }

/** One reading of the frame; every number is in CSS px. */
export type ShellGeometry = {
  viewport: { width: number; height: number }
  document: { scrollWidth: number; scrollHeight: number; clientHeight: number }
  /** Resolved `--shell-header-h`, or NaN where the root does not carry it. */
  headerToken: number
  header: Box | null
  /** True when the rail is laid out (the phone hides it). */
  railVisible: boolean
  rail: Box | null
  railState: 'expanded' | 'collapsed' | null
  navRows: { box: Box }[]
  footerRows: { name: string; box: Box }[]
  tabBar: Box | null
  /** Elements whose content is clipped inside the header or the rail, or that leave the viewport. */
  clipped: { slot: string; text: string; reason: string }[]
}

/**
 * The page-side measurement. Serialised by `evaluate`, so it closes over nothing: its helpers cannot
 * be hoisted out.
 */
/* oxlint-disable unicorn/consistent-function-scoping */
export function measureShell(): ShellGeometry {
  const box = (el: Element): Box => {
    const r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
  }
  const slotOf = (name: string): HTMLElement | null =>
    document.querySelector<HTMLElement>(`[data-slot="${name}"]`)
  const shown = (el: Element): boolean => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }

  const root = slotOf('shell')
  let headerToken = NaN
  if (root !== null) {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--shell-header-h)'
    root.append(probe)
    headerToken = probe.getBoundingClientRect().height
    probe.remove()
  }

  const rail = slotOf('shell-rail')
  const railVisible = rail !== null && shown(rail)
  const header = slotOf('shell-header')
  const tabBar = slotOf('shell-tab-bar')
  const footer = slotOf('shell-rail-footer')
  const viewport = { width: document.documentElement.clientWidth, height: window.innerHeight }

  const navRows = railVisible
    ? [
        ...document.querySelectorAll(
          '[data-slot="shell-rail-viewport"] [data-slot="shell-rail-row"]',
        ),
      ]
        .filter((el) => shown(el) && Number(el.getAttribute('data-depth') ?? 0) === 0)
        .map((el) => ({ box: box(el) }))
    : []
  const footerRows =
    railVisible && footer !== null
      ? [...footer.querySelectorAll('a[href], button')]
          .filter((el) => shown(el) && el.parentElement?.closest('a[href], button') === null)
          .map((el, index) => ({
            name: el.getAttribute('aria-label') ?? (el.textContent ?? '').trim() ?? `row ${index}`,
            box: box(el),
          }))
      : []

  const clipped: ShellGeometry['clipped'] = []
  const describe = (el: Element): string =>
    el.closest('[data-slot]')?.getAttribute('data-slot') ?? el.tagName.toLowerCase()
  for (const scope of [header, rail, tabBar]) {
    if (scope === null || !shown(scope)) continue
    for (const el of [scope, ...scope.querySelectorAll('*')]) {
      if (el instanceof SVGElement || !shown(el)) continue
      // A scrollport clips by design; truncation (`text-overflow`) is the visible, intended form.
      const style = getComputedStyle(el)
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') continue
      if (style.textOverflow === 'ellipsis') continue
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 1) {
        clipped.push({
          slot: describe(el),
          text: (el.textContent ?? '').trim().slice(0, 40),
          reason: `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`,
        })
      }
    }
  }
  for (const el of document.body.querySelectorAll('*')) {
    if (el instanceof SVGElement || !shown(el)) continue
    const r = el.getBoundingClientRect()
    if (
      r.right > viewport.width + 1 &&
      el.closest('[data-slot="shell-main"], [data-slot="shell-rail-viewport"]') === null
    ) {
      clipped.push({
        slot: describe(el),
        text: (el.textContent ?? '').trim().slice(0, 40),
        reason: `right edge ${Math.round(r.right)} > viewport ${viewport.width}`,
      })
    }
  }

  return {
    viewport,
    document: {
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    },
    headerToken,
    header: header === null ? null : box(header),
    railVisible,
    rail: rail === null || !railVisible ? null : box(rail),
    railState:
      rail === null || !railVisible
        ? null
        : rail.getBoundingClientRect().width > 120
          ? 'expanded'
          : 'collapsed',
    navRows,
    footerRows,
    tabBar: tabBar === null || !shown(tabBar) ? null : box(tabBar),
    clipped,
  }
}

/* oxlint-enable unicorn/consistent-function-scoping */

const round = (n: number): number => Math.round(n * 10) / 10

/**
 * The broken rules of one reading, each a sentence naming the measured numbers; empty when the
 * frame holds. Pure.
 */
export function judgeShell(g: ShellGeometry, tolerance = 1): string[] {
  const broken: string[] = []
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= tolerance

  if (g.header === null) broken.push('no shell-header in the page')
  else {
    const height = g.header.bottom - g.header.top
    if (!near(height, g.headerToken)) {
      broken.push(
        `header height ${round(height)} is not the --shell-header-h token ${g.headerToken}`,
      )
    }
    if (g.header.top !== 0) broken.push(`header top ${round(g.header.top)} is not 0`)
  }

  if (g.document.scrollHeight > g.document.clientHeight) {
    broken.push(
      `document scrolls: scrollHeight ${g.document.scrollHeight} > ${g.document.clientHeight}`,
    )
  }
  if (g.document.scrollWidth > g.viewport.width) {
    broken.push(
      `document overflows sideways: scrollWidth ${g.document.scrollWidth} > ${g.viewport.width}`,
    )
  }
  for (const item of g.clipped) {
    broken.push(`${item.slot} "${item.text}" clipped: ${item.reason}`)
  }

  if (g.tabBar !== null && g.tabBar.bottom > g.viewport.height + tolerance) {
    broken.push(`tab bar bottom ${round(g.tabBar.bottom)} is below the window ${g.viewport.height}`)
  }

  const { rail } = g
  if (rail === null) return broken
  if (rail.bottom > g.viewport.height + tolerance) {
    broken.push(`rail bottom ${round(rail.bottom)} is below the window ${g.viewport.height}`)
  }

  const [first, second] = g.navRows
  if (first === undefined) {
    broken.push('the rail has no nav rows')
    return broken
  }
  const padding = first.box.left - rail.left
  const pitch = second === undefined ? NaN : second.box.top - first.box.top
  const height = first.box.bottom - first.box.top

  // Nav rows are evenly spaced, except across a section boundary (a larger step).
  const steps = g.navRows.slice(1).map((row, i) => row.box.top - (g.navRows[i]?.box.top ?? NaN))
  for (const [i, step] of steps.entries()) {
    if (step < pitch - tolerance)
      broken.push(`nav step ${i + 1} (${round(step)}) is under the pitch ${round(pitch)}`)
  }

  for (const row of g.footerRows) {
    const tag = `footer row "${row.name}"`
    if (row.box.left < rail.left - tolerance || row.box.right > rail.right + tolerance) {
      broken.push(`${tag} leaves the rail horizontally`)
    }
    const inset = rail.bottom - row.box.bottom
    if (round(inset) < round(padding)) {
      broken.push(`${tag} bottom inset ${round(inset)} is under the rail padding ${round(padding)}`)
    }
    const rowHeight = row.box.bottom - row.box.top
    if (!near(rowHeight, height)) {
      broken.push(`${tag} height ${round(rowHeight)} is not the nav row height ${round(height)}`)
    }
  }
  const [a, b] = g.footerRows
  if (
    a !== undefined &&
    b !== undefined &&
    !Number.isNaN(pitch) &&
    !near(b.box.top - a.box.top, pitch)
  ) {
    broken.push(
      `footer rows pitch ${round(b.box.top - a.box.top)} is not the nav pitch ${round(pitch)}`,
    )
  }
  return broken
}

const spread = (values: number[]): number => Math.max(...values) - Math.min(...values)

async function enterState(page: ShellInvariantsPage, want: ShellInvariantState): Promise<void> {
  const reading = await page.evaluate(measureShell)
  if (!reading.railVisible || reading.railState === want) return
  await page.locator('[data-slot="shell-rail-toggle"] button').click()
}

/** Measures until two consecutive readings agree: a rail still easing its width is not a reading. */
async function stableReading(page: ShellInvariantsPage): Promise<ShellGeometry> {
  let previous = JSON.stringify(await page.evaluate(measureShell))
  for (let attempt = 0; attempt < 30; attempt++) {
    const reading = await page.evaluate(measureShell)
    const current = JSON.stringify(reading)
    if (current === previous) return reading
    previous = current
  }
  throw new Error('expectShellInvariants: the shell geometry kept moving')
}

/**
 * Asserts the frame's geometry rules in each requested rail state at the page's current viewport:
 * footer rows inside the rail with a bottom inset of at least its horizontal padding, on the nav's
 * row height and pitch; nav rows no closer than the pitch; one header height equal to `--shell-header-h`; nothing clipped or past the window;
 * the document never scrolling. On a phone the rail is absent and the tab bar stands in. Throws one
 * error listing every broken rule.
 *
 * @useWhen a test drives a page through `AppShell` and wants the frame held to the same geometry the library holds itself to
 * @neverWhen the check is a pixel comparison (use a screenshot gate) or the page runs outside AppShell
 *
 * @example
 * await page.setViewportSize({ width: 1800, height: 1200 })
 * await expectShellInvariants(page, { states: ['expanded', 'collapsed'] })
 */
export async function expectShellInvariants(
  page: ShellInvariantsPage,
  options: ShellInvariantsOptions = {},
): Promise<void> {
  const { states = ['expanded', 'collapsed'], tolerance = 1 } = options
  const broken: string[] = []
  const headerHeights: number[] = []
  for (const state of states) {
    await enterState(page, state)
    const reading = await stableReading(page)
    for (const rule of judgeShell(reading, tolerance)) broken.push(`${state}: ${rule}`)
    if (reading.header !== null) headerHeights.push(reading.header.bottom - reading.header.top)
  }
  if (headerHeights.length > 1 && spread(headerHeights) > tolerance) {
    broken.push(
      `the header height changes across states: ${headerHeights.map(round).join(' then ')}`,
    )
  }
  if (broken.length > 0) {
    throw new Error(`expectShellInvariants: ${broken.length} broken\n - ${broken.join('\n - ')}`)
  }
}
