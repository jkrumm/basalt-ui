/**
 * `AppShell globalControls={globalControls(specs)}` in real Chrome (concept 4.1): from md up the
 * header holds one pill per global, below md it keeps its center and shows the `Filters (n)` trigger
 * (the slot says `compact: true`, so the header no longer hides it; md is 840 px). The header never scrolls
 * sideways at 1440, 900, 768, 390 or 320 and the trigger sits inside the window. v3 only.
 */
import { acquireShellTarget } from './shell-target'
import { afterAll, describe, expect, test } from 'bun:test'
import type { ShellChromeSpec } from './fixture/v3/scenarios/shell-chrome'
import { LAYOUT_TARGET, S } from './shell-slots'
import {
  DESKTOP_1440,
  PHONE,
  PHONE_SMALL,
  LAPTOP_900,
  TABLET_768,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'
import type { Viewport } from './harness'

acquireShellTarget()
const ready = await initLayoutSuite()

afterAll(closeLayoutSuite)

const layout = ready && LAYOUT_TARGET === 'v3' ? describe : describe.skip

const SPEC: ShellChromeSpec = {
  sections: [
    {
      label: 'Library',
      items: [{ key: 'sessions', label: 'Sessions', mobile: 'tab', active: true }],
    },
  ],
  globals: 2,
  globalControls: true,
}

const CASES: readonly { viewport: Viewport; form: 'pills' | 'compact' }[] = [
  { viewport: DESKTOP_1440, form: 'pills' },
  { viewport: LAPTOP_900, form: 'pills' },
  { viewport: TABLET_768, form: 'compact' },
  { viewport: PHONE, form: 'compact' },
  { viewport: PHONE_SMALL, form: 'compact' },
]

layout('header global controls', () => {
  for (const { viewport, form } of CASES) {
    test(`${viewport.width}px: ${form}, one row, inside the window`, async () => {
      const p = await openFixture(SPEC, viewport, '/', 'reduce', 'fine')
      await p.settle()

      const state = await p.raw.evaluate(
        ({ rowSel, centerSel }) => {
          const row = document.querySelector<HTMLElement>(rowSel)
          const center = document.querySelector<HTMLElement>(centerSel)
          if (row === null) throw new Error('LAYOUT: no header row')
          const shown = (sel: string): HTMLElement | null => {
            const el = center?.querySelector<HTMLElement>(sel) ?? null
            return el !== null && el.getClientRects().length > 0 ? el : null
          }
          const trigger = shown('[data-slot="filter-count"]')?.closest('button') ?? null
          const rect = (el: Element | null) => el?.getBoundingClientRect() ?? null
          return {
            centerShown: center !== null && getComputedStyle(center).display !== 'none',
            pillsShown: shown('[data-slot="global-pills"]') !== null,
            triggerText: trigger?.textContent?.trim() ?? null,
            triggerRight: rect(trigger)?.right ?? null,
            centerRight: rect(center)?.right ?? null,
            rowScrolls: row.scrollWidth > row.clientWidth + 0.5,
            rowHeight: row.getBoundingClientRect().height,
            centerHeight: rect(center)?.height ?? 0,
          }
        },
        { rowSel: S('shell-header-row'), centerSel: S('shell-center') },
      )

      expect(state.centerShown, 'the header keeps the center at every width').toBe(true)
      expect(state.pillsShown, 'pills from md up only').toBe(form === 'pills')
      if (form === 'compact') {
        expect(state.triggerText, 'the compact trigger is the Filters button').toMatch(/^Filters/)
        expect(state.triggerRight ?? Infinity).toBeLessThanOrEqual(viewport.width)
      } else {
        expect(state.triggerText, 'no Filters button beside the pills').toBeNull()
      }
      expect(state.rowScrolls, 'the header never scrolls sideways').toBe(false)
      expect(state.centerHeight, 'the center is one row').toBeLessThanOrEqual(state.rowHeight)
    })
  }
})
