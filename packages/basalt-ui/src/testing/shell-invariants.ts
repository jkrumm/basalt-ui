/**
 * `expectShellInvariants`: the geometry rules an `AppShell` page keeps whatever its pixels look
 * like, measured with `getBoundingClientRect` through `data-slot` selectors (never a class name), so
 * a 2 px drift fails even where a screenshot baseline was regenerated carelessly. Ported from
 * shutterflow's `invariants.spec.ts`; the shell concept's section 6 names the rules.
 *
 * Two halves: `measureShell` runs inside the page and returns raw numbers; `judgeShell` is pure and
 * returns the broken rules, so the verdict is testable on seeded geometry without a browser.
 */

/**
 * A state the helper checks. `expanded` and `collapsed` drive the rail there first; `native` drives
 * nothing and holds a page under `chrome="native-overlay"` to the window-chrome rules instead.
 */
export type ShellInvariantState = 'expanded' | 'collapsed' | 'native'

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
  /** States to check at the page's viewport. Default: both rail states; add `native` on a page under `chrome="native-overlay"`. */
  states?: readonly ShellInvariantState[]
  /** Tolerance in px for equal-spacing and alignment rules. Default 1. */
  tolerance?: number
}

type Box = { top: number; bottom: number; left: number; right: number }

/** The reading of a page under `chrome="native-overlay"`; `null` in `ShellGeometry` on the web. */
export type NativeGeometry = {
  /** Every element carrying `data-tauri-drag-region`, by its `data-slot` (or tag) and value. */
  dragRegions: { slot: string; value: string }[]
  /** The header's computed `app-region`. */
  headerAppRegion: string
  /** Resolved `--chrome-lead-inset` on the root, or NaN. */
  leadInset: number
  /** The strip reserved for the window's own buttons. */
  titlebar: Box | null
  /** The left edge of the first header content after that strip. */
  leadContentLeft: number | null
  /** Every button, link and field in the header with its computed `app-region`. */
  interactive: { name: string; appRegion: string }[]
}

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
  native: NativeGeometry | null
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

  const regionOf = (el: Element): string => {
    const style = getComputedStyle(el)
    return style.getPropertyValue('app-region') || style.getPropertyValue('-webkit-app-region')
  }
  let native: NativeGeometry | null = null
  const titlebar = slotOf('shell-titlebar')
  if (header !== null && titlebar !== null) {
    let next = titlebar.nextElementSibling
    while (next !== null && !shown(next)) next = next.nextElementSibling
    native = {
      dragRegions: [...document.querySelectorAll('[data-tauri-drag-region]')].map((el) => ({
        slot: el.getAttribute('data-slot') ?? el.tagName.toLowerCase(),
        value: el.getAttribute('data-tauri-drag-region') ?? '',
      })),
      headerAppRegion: regionOf(header),
      leadInset:
        root === null
          ? NaN
          : parseFloat(getComputedStyle(root).getPropertyValue('--chrome-lead-inset')),
      titlebar: box(titlebar),
      leadContentLeft: next === null ? null : next.getBoundingClientRect().left,
      interactive: [...header.querySelectorAll('button, a[href], input, select, textarea')]
        .filter(shown)
        .map((el, index) => ({
          name:
            el.getAttribute('aria-label') ?? (el.textContent ?? '').trim() ?? `control ${index}`,
          appRegion: regionOf(el),
        })),
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
    native,
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

  const [first] = g.navRows
  if (first === undefined) {
    broken.push('the rail has no nav rows')
    return broken
  }
  const padding = first.box.left - rail.left
  const height = first.box.bottom - first.box.top

  // The pitch is the smallest step between consecutive rows: a section boundary only ever adds a
  // gap, so the first two rows may sit in different sections. A step within a quarter of the pitch
  // is a step inside one section and must equal it; a larger step crosses a boundary.
  const steps = g.navRows.slice(1).map((row, i) => row.box.top - (g.navRows[i]?.box.top ?? NaN))
  const pitch = steps.length === 0 ? NaN : Math.min(...steps)
  for (const [i, step] of steps.entries()) {
    if (step < pitch * 1.25 && Math.abs(step - pitch) > tolerance) {
      broken.push(`nav step ${i + 1} (${round(step)}) is off the pitch ${round(pitch)}`)
    }
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

/** The header height and the strip for the window's own buttons under `chrome="native-overlay"`. */
const NATIVE_HEADER_PX = 52
const NATIVE_LEAD_INSET_PX = 80

/**
 * The broken window-chrome rules of one reading: the header is 52 tall, the first 80 px of it hold
 * nothing, the header alone is a deep drag region and everything interactive in it is `no-drag`.
 * Pure.
 */
export function judgeNative(g: ShellGeometry, tolerance = 1): string[] {
  const { native, header } = g
  if (native === null || header === null) {
    return ['the page is not under chrome="native-overlay": no shell-titlebar in the header']
  }
  const broken: string[] = []
  const height = header.bottom - header.top
  if (Math.abs(height - NATIVE_HEADER_PX) > tolerance) {
    broken.push(`native header height ${round(height)} is not ${NATIVE_HEADER_PX}`)
  }
  if (!(native.leadInset >= NATIVE_LEAD_INSET_PX - tolerance)) {
    broken.push(`--chrome-lead-inset ${native.leadInset} is under ${NATIVE_LEAD_INSET_PX}`)
  }
  const strip = native.titlebar
  if (strip !== null && strip.right - header.left < NATIVE_LEAD_INSET_PX - tolerance) {
    broken.push(
      `the titlebar strip is ${round(strip.right - header.left)} wide, under ${NATIVE_LEAD_INSET_PX}`,
    )
  }
  if (
    native.leadContentLeft !== null &&
    native.leadContentLeft - header.left < NATIVE_LEAD_INSET_PX - tolerance
  ) {
    broken.push(
      `header content starts at ${round(native.leadContentLeft - header.left)}, inside the ${NATIVE_LEAD_INSET_PX} px lead inset`,
    )
  }
  const [only, ...extra] = native.dragRegions
  if (
    only === undefined ||
    only.slot !== 'shell-header' ||
    only.value !== 'deep' ||
    extra.length > 0
  ) {
    const found = native.dragRegions.map((r) => `${r.slot}="${r.value}"`).join(', ') || 'none'
    broken.push(`data-tauri-drag-region must be on shell-header alone as "deep", found: ${found}`)
  }
  if (native.headerAppRegion !== 'drag') {
    broken.push(`the header app-region is "${native.headerAppRegion}", not drag`)
  }
  for (const control of native.interactive) {
    if (control.appRegion !== 'no-drag') {
      broken.push(
        `header control "${control.name}" is app-region "${control.appRegion}", not no-drag`,
      )
    }
  }
  return broken
}

const spread = (values: number[]): number => Math.max(...values) - Math.min(...values)

async function enterState(
  page: ShellInvariantsPage,
  want: 'expanded' | 'collapsed',
): Promise<void> {
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
 * row height and pitch; nav rows evenly spaced within a section; one header height equal to `--shell-header-h`; nothing clipped or past the window;
 * the document never scrolling. On a phone the rail is absent and the tab bar stands in. The `native`
 * state also holds the window chrome: a 52 px header whose first 80 px stay free, one deep drag
 * region on the header alone and every control in it `no-drag`. Throws one error listing every
 * broken rule.
 *
 * @useWhen a test drives a page through `AppShell` and wants the frame held to the same geometry the library holds itself to
 * @neverWhen the check is a pixel comparison (use a screenshot gate) or the page runs outside AppShell
 *
 * @example
 * await page.setViewportSize({ width: 1800, height: 1200 })
 * await expectShellInvariants(page, { states: ['expanded', 'collapsed'] })
 * await expectShellInvariants(page, { states: ['native'] }) // under chrome="native-overlay"
 */
export async function expectShellInvariants(
  page: ShellInvariantsPage,
  options: ShellInvariantsOptions = {},
): Promise<void> {
  const { states = ['expanded', 'collapsed'], tolerance = 1 } = options
  const broken: string[] = []
  const headerHeights: number[] = []
  for (const state of states) {
    if (state !== 'native') await enterState(page, state)
    const reading = await stableReading(page)
    for (const rule of judgeShell(reading, tolerance)) broken.push(`${state}: ${rule}`)
    if (state === 'native') {
      for (const rule of judgeNative(reading, tolerance)) broken.push(`${state}: ${rule}`)
    }
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
