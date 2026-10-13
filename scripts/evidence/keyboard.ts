/**
 * Evidence lane: keyboard walk over every chart on the playground `/charts` route (every tab
 * it offers). Charts are discovered generically — the engine surface is
 * `svg[role=img][aria-roledescription=chart]` and always carries the chart's `ariaLabel` — so new
 * demos are picked up without naming them.
 *
 * Per chart: focus the surface, press ArrowRight ×3, Home, End, Enter, Escape. After every key the
 * lane records a signature (the surface's aria-label + the visible tooltip text) and whether it
 * changed. A screenshot is taken at the pinned state (after Enter). Light scheme, desktop.
 * PASS = at least one ArrowRight moved the cursor; a chart that ignores ArrowRight is a FAIL row.
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Locator, Page } from 'playwright-core'
import { VIEWPORT, sortKeys } from './perf-util'
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

const CHART_SELECTOR = 'svg[role="img"][aria-roledescription="chart"]'
const NAV_TIMEOUT_MS = 30_000
const SETTLE_MS = 60

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
export function toSteps(initial: string, observed: ReadonlyArray<{ key: Key; signature: string }>) {
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

/** Duplicate labels across (or within) pages get a `#2`, `#3`… suffix so rows stay unique. */
export function uniqueNames(labels: readonly string[]): string[] {
  const seen = new Map<string, number>()
  return labels.map((label) => {
    const n = (seen.get(label) ?? 0) + 1
    seen.set(label, n)
    return n === 1 ? label : `${label} #${n}`
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
    ...rows,
  ]
}

async function readSignature(page: Page, chart: Locator): Promise<string> {
  const ariaLabel = (await chart.getAttribute('aria-label')) ?? ''
  const tooltip = await page.evaluate(() =>
    [...document.querySelectorAll('.ts-chart-tooltip:not([hidden])')]
      .map((t) => t.textContent ?? '')
      .join(' | '),
  )
  return signatureOf(ariaLabel, tooltip)
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
  for (const key of KEY_WALK) {
    await page.keyboard.press(key)
    await page.waitForTimeout(SETTLE_MS)
    observed.push({ key, signature: await readSignature(page, chart) })
    // Pinned state = right after Enter, before Escape clears it.
    if (key === 'Enter') await page.screenshot({ path: shotPath })
  }
  return { name, view, focusable, steps: toSteps(initial, observed) }
}

export const keyboard: Lane = async ({ outDir, baseUrl, openBrowser }) => {
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
  const seenViews = new Set<string>()
  const charts = page.locator(CHART_SELECTOR)
  try {
    await page.goto(`${baseUrl}${KEYBOARD_ROUTE}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    // The route's tabs are discovered, not named: the default view first, then each radio of the view switch.
    const tabs = page.getByRole('radio')
    const tabCount = await tabs.count()
    for (let view = -1; view < tabCount; view++) {
      if (view >= 0) {
        // The input is visually hidden; its label is what a user clicks.
        const id = await tabs.nth(view).getAttribute('id')
        await page.locator(`label[for="${id}"]`).click()
        await page.waitForTimeout(SETTLE_MS * 4)
        await page.waitForLoadState('networkidle')
      }
      const count = await charts.count()
      const labels = await Promise.all(
        Array.from(
          { length: count },
          async (_, i) => (await charts.nth(i).getAttribute('aria-label')) ?? '',
        ),
      )
      // A tab that mounts the same charts as one already walked is walked once.
      const viewKey = labels.join('\n')
      if (count === 0 || seenViews.has(viewKey)) continue
      seenViews.add(viewKey)
      const names = uniqueNames([...walks.map((w) => w.name), ...labels]).slice(walks.length)
      const tab =
        view >= 0 ? ((await tabs.nth(view).getAttribute('value')) ?? `tab ${view}`) : 'default'
      for (let i = 0; i < count; i++) {
        const shot = join(
          dir,
          `${String(walks.length + 1).padStart(2, '0')}-${chartSlug(names[i]!)}.png`,
        )
        walks.push(await walkChart(page, charts.nth(i), names[i]!, tab, shot))
      }
    }
  } finally {
    await context.close()
  }
  if (walks.length === 0) throw new Error(`keyboard: no chart (${CHART_SELECTOR}) found`)
  return {
    lane: 'keyboard',
    summary: summaryRows(walks),
    detail: sortKeys({ keys: KEY_WALK, route: KEYBOARD_ROUTE, walks }),
  }
}
