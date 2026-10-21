/**
 * Wave 42 (SPEC § 6.6): the table toolbar is ONE row at the dense 28px tier from the `compact`
 * container class up — title, search, facet chips and an `actions` button — and the table reads its
 * own container, never the viewport. The viewport stays 1440 throughout; only the container moves.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { Viewport } from './harness'
import { CLOSE_BUDGET_MS, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const DESKTOP: Viewport = { name: 'desktop', width: 1440, height: 900 }
const TOOLBAR = '[data-basalt-tier="ctl"] > .mantine-Group-root'

const specAt = (containerWidth: number): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'home', label: 'Home', mobile: 'tab', active: true }] },
  ],
  table: {
    rows: 8,
    columns: 6,
    stickyHeader: false,
    search: true,
    facets: 2,
    actions: true,
    containerWidth,
  },
})

layout('BasaltDataTable toolbar — one row at the dense tier', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const width of [480, 800]) {
    test(`a ${width}px container keeps ONE toolbar row of 28px controls`, async () => {
      const p = await openFixture(specAt(width), DESKTOP, '/', 'reduce', 'fine')
      const rects = await p.raw.evaluate((sel) => {
        const group = document.querySelector(sel)
        if (!group) throw new Error(`no toolbar under ${sel}`)
        const controls = [
          ...group.querySelectorAll<HTMLElement>(
            '.mantine-TextInput-input, [data-filter-slot]:not([data-folded]) button, [data-filter-row] > button[data-shown], .mantine-Button-root:not([data-filter-row] *)',
          ),
        ]
        return controls
          .map((el) => el.getBoundingClientRect())
          .filter((rect) => rect.height > 0)
          .map((rect) => ({ top: Math.round(rect.top), height: Math.round(rect.height) }))
      }, TOOLBAR)
      // search + at least one facet pill + the action
      expect(rects.length).toBeGreaterThanOrEqual(3)
      expect(
        Math.max(...rects.map((r) => r.top)) - Math.min(...rects.map((r) => r.top)),
      ).toBeLessThanOrEqual(1)
      for (const rect of rects) expect(rect.height).toBe(28)
      // the actions button sits at the toolbar's right edge
      const edges = await p.raw.evaluate((sel) => {
        const group = document.querySelector(sel)
        const action = [...(group?.querySelectorAll('button') ?? [])].find((b) =>
          b.textContent?.includes('Export CSV'),
        )
        return {
          group: group?.getBoundingClientRect().right ?? 0,
          action: action?.getBoundingClientRect().right ?? 0,
        }
      }, TOOLBAR)
      expect(Math.abs(edges.group - edges.action)).toBeLessThanOrEqual(1)
    })
  }
})
