/**
 * Wave 42: the table header and cell kinds, measured as computed style in a real browser — the
 * colour, background and wrapping outcomes happy-dom cannot resolve through the cascade.
 *
 * - A SORTED header is a different (brighter) colour than an unsorted sortable one.
 * - The head paints no band: `thead` and `th` backgrounds equal the body cell's.
 * - An `entity` cell never wraps (`white-space: nowrap`, one row high) where a `text` cell may.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w42Kinds: true,
}

const TABLE = '[data-testid="w42-kinds"] table'
const SORTED_TH = `${TABLE} th[aria-sort="descending"]`
const UNSORTED_TH = `${TABLE} th[aria-sort="none"]`

layout('table kinds — computed style', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const viewport of [DESKTOP_1440, PHONE]) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`sorted header is brighter than an unsorted one (${viewport.name}, ${scheme})`, async () => {
        const p = await openFixture({ ...spec, colorScheme: scheme }, viewport)
        const sorted = await p.computed(SORTED_TH, 'color')
        const unsorted = await p.computed(UNSORTED_TH, 'color')
        expect(sorted).not.toBe(unsorted)
      })
    }

    test(`the head shares the body fill (${viewport.name})`, async () => {
      const p = await openFixture(spec, viewport)
      const td = await p.computed(`${TABLE} tbody td`, 'background-color')
      expect(await p.computed(`${TABLE} thead`, 'background-color')).toBe(td)
      expect(await p.computed(`${TABLE} thead th`, 'background-color')).toBe(td)
    })

    test(`an entity cell holds one line; a text cell may wrap (${viewport.name})`, async () => {
      const p = await openFixture(spec, viewport)
      const entity = await p.box('entity', `${TABLE} tbody td[data-kind="entity"]`)
      const text = await p.box('text', `${TABLE} tbody td[data-kind="text"]`)
      expect(entity.box.height).toBeLessThanOrEqual(41)
      expect(await p.computed(`${TABLE} tbody td[data-kind="entity"]`, 'white-space')).toBe(
        'nowrap',
      )
      expect(await p.computed(`${TABLE} tbody td[data-kind="text"]`, 'white-space')).toBe('normal')
      expect(text.box.height).toBeGreaterThanOrEqual(entity.box.height)
    })
  }
})
