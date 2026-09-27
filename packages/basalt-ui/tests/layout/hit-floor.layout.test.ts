/**
 * Layout invariant for the pointer tier: under `hasTouch` (`(pointer: coarse)`) every interactive
 * element's EFFECTIVE hit box — its own rect unioned with its `[data-basalt-hit]::after` — is at
 * least `--vx-hit` (44px) on both axes (`docs/DESIGN-CORE.md` § Layout, elevation, shapes, WCAG 2.5.5).
 *
 * One honest exception: inside a `--vx-hit-gap` host (the C1 homes) the overlay is capped so it can
 * never overlap a neighbour (`hit-overlap.layout.test.ts`), so the floor there is
 * `min(44, size + gap)` — the WCAG 2.5.8 spacing route.
 *
 * Known exception: the medium-class icon rail (`.mantine-AppShell-navbar`) is ~37px wide, so its
 * rows hold the 24px WCAG 2.5.8 floor, not 44. Widening the rail is a shell design change (PLAN.md
 * wave 4 "Left behind").
 *
 * Runs on the fixture app (the harness has no playground routes): a shell, a `PageBar`, a table
 * and a chart cover the C1 homes, table chrome and legend toggles.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  LAPTOP_1024,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const SPEC: FixtureSpec = {
  sections: [
    {
      label: 'Main',
      items: [
        { key: 'a', label: 'Overview', mobile: 'tab', active: true },
        { key: 'b', label: 'Reports', mobile: 'tab' },
      ],
    },
  ],
  bar: { pills: 3, tabs: 2, actions: 3, actionIcons: true },
  table: { rows: 12, columns: 3, search: true },
  charts: { kind: 'multiLine', legendEntries: 3 },
}

const INTERACTIVE =
  'button, a[href], input:not([type="hidden"]), select, textarea, [role="switch"], [role="tab"], [role="checkbox"], [role="menuitem"]'

layout('pointer tier — hit floor', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each([PHONE, LAPTOP_1024])(
    'every interactive element clears --vx-hit at $name',
    async (viewport) => {
      const p = await openFixture(SPEC, viewport)
      await p.settle()

      const { short, checked } = await p.raw.evaluate((selector) => {
        const HIT = 44
        const short: string[] = []
        let checked = 0
        for (const el of document.querySelectorAll<HTMLElement>(selector)) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          const style = getComputedStyle(el)
          if (style.visibility === 'hidden' || style.pointerEvents === 'none') continue
          // A native input wrapped in a label shares the label's hit box — judge the label.
          if (el.closest('label[data-basalt-hit], label') && el instanceof HTMLInputElement) {
            const label = el.closest('label') as HTMLElement
            const lr = label.getBoundingClientRect()
            if (lr.width >= HIT && lr.height >= HIT) continue
          }
          const after = getComputedStyle(el, '::after')
          const aw = parseFloat(after.width)
          const ah = parseFloat(after.height)
          const w = Math.max(r.width, Number.isNaN(aw) || after.content === 'none' ? 0 : aw)
          const h = Math.max(r.height, Number.isNaN(ah) || after.content === 'none' ? 0 : ah)
          const inRail = el.closest('.mantine-AppShell-navbar') !== null && r.width < HIT
          const gap = parseFloat(style.getPropertyValue('--vx-hit-gap')) || 0
          const needW = inRail ? 24 : gap ? Math.min(HIT, r.width + gap) : HIT
          const needH = gap ? Math.min(HIT, r.height + gap) : HIT
          checked++
          if (w + 0.5 < needW || h + 0.5 < needH)
            short.push(
              `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}" ${w.toFixed(0)}x${h.toFixed(0)} < ${needW.toFixed(0)}x${needH.toFixed(0)}`,
            )
        }
        return { short, checked }
      }, INTERACTIVE)

      expect(checked).toBeGreaterThan(8)
      expect(short).toEqual([])
    },
  )
})
