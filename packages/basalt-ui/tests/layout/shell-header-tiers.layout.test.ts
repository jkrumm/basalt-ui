/**
 * The header's priority tiers in a real browser, with spike S6's cluster (docs/v3/spikes/shell-frame.md):
 * status badges at priority 1, job progress at 2, two quick actions at 3, then the one kebab.
 *
 * At 1024, 1200 and 1440 with the rail expanded and collapsed: nothing wraps, nothing is lost (every
 * action is in the row or in the kebab), labels are long from 1200 and short below, and a yielded
 * action never outranks a shown one. v3 only: the 2.x header had no tiers.
 */
import { acquireShellTarget } from './shell-target'
import { afterAll, describe, expect, test } from 'bun:test'
import type { ShellChromeSpec } from './fixture/v3/scenarios/shell-chrome'
import { LAYOUT_TARGET, S } from './shell-slots'
import { closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'

acquireShellTarget()
const ready = await initLayoutSuite()

afterAll(closeLayoutSuite)

const layout = ready && LAYOUT_TARGET === 'v3' ? describe : describe.skip

const ITEMS = ['status', 'progress', 'import', 'tag'] as const

const specOf = (rail: 'collapsed' | 'expanded'): ShellChromeSpec => ({
  sections: [
    {
      label: 'Library',
      items: [
        { key: 'sessions', label: 'Alpine trip, batch 2026-11', mobile: 'tab', active: true },
      ],
    },
  ],
  cluster: true,
  rail,
})

/** What each window shows: the rows of the row, the rows of the kebab, the label length. */
const EXPECTED = [
  { width: 1024, shown: ['status'], kebab: ['progress', 'import', 'tag'], labels: 'short' },
  { width: 1200, shown: ['status', 'progress'], kebab: ['import', 'tag'], labels: 'long' },
  { width: 1440, shown: [...ITEMS], kebab: [], labels: 'long' },
] as const

layout('header tiers — spike S6 cluster', () => {
  for (const { width, shown, kebab, labels } of EXPECTED) {
    for (const rail of ['expanded', 'collapsed'] as const) {
      const viewport: Viewport = { name: `${width} ${rail}`, width, height: 720 }
      test(`${width}px, rail ${rail}: shown ${shown.join('+')}, kebab ${kebab.join('+') || 'none'}, ${labels} labels`, async () => {
        const p = await openFixture(specOf(rail), viewport, '/', 'reduce', 'fine')
        await p.settle()

        const state = await p.raw.evaluate(
          ({ rowSel, trailSel, kebabSel }) => {
            const row = document.querySelector<HTMLElement>(rowSel)
            const trail = document.querySelector<HTMLElement>(trailSel)
            if (row === null || trail === null) throw new Error('LAYOUT: no header row or trail')
            const items = [...trail.querySelectorAll<HTMLElement>('[data-item]')]
            const kebabEl = document.querySelector<HTMLElement>(kebabSel)
            return {
              shown: items
                .filter((el) => getComputedStyle(el).display !== 'none')
                .map((el) => el.dataset['item']),
              trailHeight: trail.getBoundingClientRect().height,
              rowHeight: row.getBoundingClientRect().height,
              rowScrolls: row.scrollWidth > row.clientWidth + 0.5,
              kebabShown: kebabEl !== null && getComputedStyle(kebabEl).display !== 'none',
              status: document.querySelector('[data-testid="cluster-status"]')?.textContent ?? '',
            }
          },
          { rowSel: S('shell-header-row'), trailSel: S('shell-trail'), kebabSel: S('shell-kebab') },
        )

        expect(state.shown, 'the row holds exactly the tiers this width allows').toEqual([...shown])
        expect(state.rowScrolls, 'the header never scrolls sideways').toBe(false)
        expect(state.trailHeight, 'the cluster is one row, never wrapped').toBeLessThanOrEqual(
          state.rowHeight,
        )
        expect(state.kebabShown, 'one kebab exactly when something yielded').toBe(kebab.length > 0)
        expect(state.status.includes('·'), 'long labels from 1200, short below').toBe(
          labels === 'long',
        )

        if (kebab.length === 0) return
        await p.raw.click(`${S('shell-kebab')} button`)
        await p.raw.waitForSelector('[data-slot="menu-content"]')
        const listed = await p.raw.evaluate(() => {
          const menu = document.querySelector('[data-slot="menu-content"]')
          return [...(menu?.children ?? [])].map((el) => el.textContent?.trim() ?? '')
        })
        // Nothing lost: every yielded action is listed, in declaration order.
        expect(listed).toHaveLength(kebab.length)
        const needles = { progress: 'Export', import: 'Import', tag: 'Tag selection' } as const
        kebab.forEach((id, i) => expect(listed[i]).toContain(needles[id as keyof typeof needles]))
      })
    }
  }

  test('a yielded action never outranks a shown one, at every width from 1024 to 1480', async () => {
    const p = await openFixture(
      specOf('expanded'),
      { name: 'sweep', width: 1024, height: 720 },
      '/',
      'reduce',
      'fine',
    )
    for (let width = 1024; width <= 1480; width += 12) {
      await p.raw.setViewportSize({ width, height: 720 })
      await p.settle()
      const tiers = await p.raw.evaluate((trailSel) => {
        const items = [
          ...(document.querySelector(trailSel)?.querySelectorAll<HTMLElement>('[data-item]') ?? []),
        ]
        return items.map((el) => ({
          priority: Number(el.dataset['priority']),
          shown: getComputedStyle(el).display !== 'none',
        }))
      }, S('shell-trail'))
      const hiddenBest = Math.min(...tiers.filter((t) => !t.shown).map((t) => t.priority), 9)
      const shownWorst = Math.max(...tiers.filter((t) => t.shown).map((t) => t.priority), 0)
      expect(hiddenBest, `at ${width}px`).toBeGreaterThanOrEqual(shownWorst)
    }
  })
})
