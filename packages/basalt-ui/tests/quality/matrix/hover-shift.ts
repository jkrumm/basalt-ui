/**
 * The hover-shift guard: a hover changes what a chart says, never where it sits. Sweeps the pointer
 * across each chart plot on a page and names every plot whose box moved while the pointer was over
 * it. A move there is the loop owner review 1 saw on n04: a line that opens on hover pushes the plot
 * from under the pointer, focus clears, the line closes, and it starts again.
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

/** The boxes a pointer sweeps: a cartesian chart's root and an answering sparkline's plot. */
const PLOTS = '[data-basalt-chart], [data-slot="spark-plot"]'
/** Where across the plot the pointer stops, as a share of its width, at half its height. */
const STOPS = [0.1, 0.3, 0.5, 0.7, 0.9] as const
/** Sub-pixel layout noise stays below this. */
const TOLERANCE_PX = 0.5
/** A page of many small charts is judged on its first ones: the cause is shared, the sweep is not free. */
const MAX_PLOTS = 8

const frames = (page: Page): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  )

/** Every plot that moved under the pointer, as `<label>: moved <dx>,<dy> px at <stop>`; empty when none. */
export async function hoverShift(page: Page): Promise<string[]> {
  const plots = page.locator(PLOTS)
  const count = Math.min(await plots.count(), MAX_PLOTS)
  const moved: string[] = []
  for (let i = 0; i < count; i++) {
    const plot = plots.nth(i)
    if (!(await plot.isVisible())) continue
    await plot.scrollIntoViewIfNeeded()
    await page.mouse.move(0, 0)
    await frames(page)
    const rest = await plot.boundingBox()
    if (rest === null || rest.width < 8 || rest.height < 8) continue
    const label =
      (await plot.evaluate(
        (el) =>
          el.closest('[data-slot="chart-card"], [data-slot="stat-card"]')?.querySelector('h2, h3')
            ?.textContent ?? el.getAttribute('aria-label'),
      )) ?? `plot ${i + 1}`
    for (const stop of STOPS) {
      await page.mouse.move(rest.x + rest.width * stop, rest.y + rest.height / 2)
      await frames(page)
      const now = await plot.boundingBox()
      if (now === null) break
      const dx = now.x - rest.x
      const dy = now.y - rest.y
      if (Math.abs(dx) > TOLERANCE_PX || Math.abs(dy) > TOLERANCE_PX) {
        moved.push(`${label.trim()}: moved ${dx.toFixed(1)},${dy.toFixed(1)} px at ${stop}`)
        break
      }
    }
  }
  await page.mouse.move(0, 0)
  return moved
}
