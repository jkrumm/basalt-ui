/**
 * Evidence lane: keyboard walk over every chart on the playground `/charts` route (every tab
 * it offers). Charts are discovered generically — the engine surface is
 * `svg[role=img][aria-roledescription=chart]` and always carries the chart's `ariaLabel` — so new
 * demos are picked up without naming them.
 *
 * Per chart: focus the surface, press ArrowRight ×3, Home, End, Enter, Escape. After every key the
 * lane records a signature (the surface's aria-label + the visible tooltip text) and whether it
 * changed. A screenshot is taken at the keyboard-focused state (after End, before Enter). Light
 * scheme, desktop. Only ArrowRight is judged: PASS = at least one ArrowRight moved the cursor; a
 * chart that ignores it is a FAIL row. Home/End/Enter/Escape are recorded, not judged. Enter does
 * NOT pin on a fine pointer (`pin` is coarse-only, `compile.ts`), so there is no pinned state here.
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Locator, Page } from 'playwright-core'
import { TOOLTIP_SELECTOR, VIEWPORT, sortKeys } from './perf-util'
import type { Lane, LaneResult } from './types'

export const KEY_WALK = [
  'ArrowRight',
  'ArrowRight',
  'ArrowRight',
  'Home',
  'End',
  'Enter',
  'Escape',
] as const
export type Key = (typeof KEY_WALK)[number]

export const KEYBOARD_ROUTE = '/charts'
/** The route's view switch has at least the linked / kinds / cursor views; fewer means the
 * discovery selector broke, not that the route shrank. */
const MIN_VIEWS = 3

const CHART_SELECTOR = 'svg[role="img"][aria-roledescription="chart"]'
const NAV_TIMEOUT_MS = 30_000
/** Per key: how long to wait for the signature to change before calling the key a no-op. */
const KEY_TIMEOUT_MS = 500
const POLL_MS = 16
/** After switching view: lazy chunks and the new panel's charts mounting. */
const VIEW_SETTLE_MS = 250

export type KeyStep = { key: Key; signature: string; moved: boolean }
export type ChartWalk = { name: string; view: string; focusable: boolean; steps: KeyStep[] }
export type Verdict = { pass: boolean; moved: number; total: number }

/** `Revenue by day / (EUR)` → `revenue-by-day-eur`; empty → `chart`. */
export const chartSlug = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'chart'

/** The cursor state as observable from outside: surface name + visible tooltip text. */
export const signatureOf = (ariaLabel: string, tooltip: string): string =>
  `${ariaLabel.trim()} | ${tooltip.replace(/\s+/g, ' ').trim()}`

/** One step per key, `moved` = the signature differs from the one before it. */
export function toSteps(
  initial: string,
  observed: ReadonlyArray<{ key: Key; signature: string }>,
): KeyStep[] {
  let previous = initial
  return observed.map(({ key, signature }): KeyStep => {
    const step = { key, signature, moved: signature !== previous }
    previous = signature
    return step
  })
}

/** PASS iff a chart is focusable and at least one ArrowRight changed what it shows. */
export function verdictOf(walk: Pick<ChartWalk, 'focusable' | 'steps'>): Verdict {
  const moved = walk.steps.filter((s) => s.moved).length
  const arrowMoved = walk.steps.some((s) => s.key === 'ArrowRight' && s.moved)
  return { pass: walk.focusable && arrowMoved, moved, total: walk.steps.length }
}

/** Names stay unique across the whole run: a duplicate gets the first free `#n` suffix, and a
 * suffixed name that is already taken is never regenerated. */
export function uniqueNames(labels: readonly string[]): string[] {
  const taken = new Set<string>()
  return labels.map((label) => {
    let name = label
    for (let n = 2; taken.has(name); n++) name = `${label} #${n}`
    taken.add(name)
    return name
  })
}

export function summaryRows(walks: readonly ChartWalk[]): LaneResult['summary'] {
  const rows = walks.map((w) => {
    const v = verdictOf(w)
    return {
      metric: w.name,
      value: v.pass ? 'PASS' : 'FAIL',
      unit: `${v.moved}/${v.total} steps moved`,
    }
  })
  const failed = walks.filter((w) => !verdictOf(w).pass).length
  return [
    { metric: 'charts walked', value: walks.length },
    { metric: 'charts failing', value: failed },
    { metric: 'judged', value: 'ArrowRight only', unit: 'Home/End/Enter/Escape recorded' },
    ...rows,
  ]
}

async function readSignature(page: Page, chart: Locator): Promise<string> {
  const ariaLabel = await chart.getAttribute('aria-label')
  if (ariaLabel === null) throw new Error('keyboard: a chart surface has no aria-label')
  const tooltip = await page.evaluate(
    (selector) =>
      [...document.querySelectorAll(selector)].map((t) => t.textContent ?? '').join(' | '),
    TOOLTIP_SELECTOR,
  )
  return signatureOf(ariaLabel, tooltip)
}

/** The signature once it differs from `previous`, or `previous` after `KEY_TIMEOUT_MS`. */
async function settledSignature(page: Page, chart: Locator, previous: string): Promise<string> {
  const deadline = Date.now() + KEY_TIMEOUT_MS
  let current = await readSignature(page, chart)
  while (current === previous && Date.now() < deadline) {
    await page.waitForTimeout(POLL_MS)
    current = await readSignature(page, chart)
  }
  return current
}

async function walkChart(
  page: Page,
  chart: Locator,
  name: string,
  view: string,
  shotPath: string,
): Promise<ChartWalk> {
  await chart.scrollIntoViewIfNeeded()
  await chart.focus()
  const focusable = await chart.evaluate((el) => document.activeElement === el)
  const initial = await readSignature(page, chart)
  const observed: Array<{ key: Key; signature: string }> = []
  let previous = initial
  for (const key of KEY_WALK) {
    // The focused-state screenshot is taken before Enter: Enter only pins on a coarse pointer.
    if (key === 'Enter') await page.screenshot({ path: shotPath })
    await page.keyboard.press(key)
    previous = await settledSignature(page, chart, previous)
    observed.push({ key, signature: previous })
  }
  return { name, view, focusable, steps: toSteps(initial, observed) }
}

type View = { value: string; label: Locator }

/** The view switch's radios, scoped to its radiogroup. Throws below `MIN_VIEWS`. */
async function discoverViews(page: Page): Promise<View[]> {
  const radios = page.getByRole('radiogroup').getByRole('radio')
  const count = await radios.count()
  if (count < MIN_VIEWS) {
    throw new Error(`keyboard: found ${count} views on ${KEYBOARD_ROUTE}, expected >= ${MIN_VIEWS}`)
  }
  return Promise.all(
    Array.from({ length: count }, async (_, i): Promise<View> => {
      // `check()` fails on Mantine's clipped input ("outside of the viewport"), so click the label
      // a user clicks.
      const radio = radios.nth(i)
      const [id, value] = await Promise.all([radio.getAttribute('id'), radio.getAttribute('value')])
      if (id === null || value === null) throw new Error(`keyboard: view ${i} has no id/value`)
      return { value, label: page.locator(`label[for="${id}"]`) }
    }),
  )
}

export const keyboard: Lane = async ({ outDir, baseUrl, openBrowser }): Promise<LaneResult> => {
  const dir = join(outDir, 'keyboard')
  await mkdir(dir, { recursive: true })
  const browser = await openBrowser()
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  })
  await context.addInitScript(() => localStorage.setItem('mantine-color-scheme-value', 'light'))
  const page = await context.newPage()
  page.setDefaultTimeout(NAV_TIMEOUT_MS)

  const walks: ChartWalk[] = []
  const charts = page.locator(CHART_SELECTOR)
  try {
    await page.goto(`${baseUrl}${KEYBOARD_ROUTE}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    // Every view is walked, keyed on the view's identity; only chart names are de-duplicated.
    for (const view of await discoverViews(page)) {
      await view.label.click()
      await page.waitForTimeout(VIEW_SETTLE_MS)
      await page.waitForLoadState('networkidle')
      const count = await charts.count()
      if (count === 0) throw new Error(`keyboard: view "${view.value}" mounts no chart`)
      const labels = await Promise.all(
        Array.from({ length: count }, async (_, i) => {
          const label = await charts.nth(i).getAttribute('aria-label')
          if (label === null)
            throw new Error(`keyboard: view "${view.value}" chart ${i} has no aria-label`)
          return label
        }),
      )
      const names = uniqueNames([...walks.map((w) => w.name), ...labels]).slice(walks.length)
      for (let i = 0; i < count; i++) {
        const shot = join(
          dir,
          `${String(walks.length + 1).padStart(2, '0')}-${chartSlug(names[i]!)}.png`,
        )
        walks.push(await walkChart(page, charts.nth(i), names[i]!, view.value, shot))
      }
    }
  } finally {
    await context.close()
  }
  for (const w of walks) {
    // oxlint-disable-next-line no-console -- failing charts are named on the terminal, not thrown
    if (!verdictOf(w).pass) console.error(`[evidence] keyboard FAIL: ${w.name} (${w.view})`)
  }
  return {
    lane: 'keyboard',
    summary: summaryRows(walks),
    detail: sortKeys({ keys: KEY_WALK, route: KEYBOARD_ROUTE, walks }),
  }
}
