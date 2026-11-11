/**
 * S8 (docs/v3/concepts/charts-cards-kanban.md section 9): the `StatCard` exemplar at 1800x1200 and
 * 390x844, in both schemes. Geometry the owner's eye cannot hold across five states is asserted
 * here: one height across every phase, one left edge from tile to figure to footer label, controls
 * that wrap below `@regular`, a chart slot that cannot move the card, a focus ring that paints, and
 * a phone with no sideways scroll.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  PHONE,
  closeLayoutSuite,
  expectNoHorizontalOverflow,
  initLayoutSuite,
  openFixture,
} from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const DESKTOP: Viewport = { name: 'desktop 1800', width: 1800, height: 1200 }
const VIEWPORTS: Viewport[] = [DESKTOP, PHONE]
const PHASES = ['ready', 'loading', 'stale', 'empty', 'error'] as const

const specOf = (colorScheme: 'light' | 'dark'): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  colorScheme,
  cardsExemplar: true,
})

async function open(viewport: Viewport, scheme: 'light' | 'dark'): Promise<LayoutPage> {
  const page = await openFixture(
    specOf(scheme),
    viewport,
    '/',
    'reduce',
    viewport === PHONE ? 'coarse' : 'fine',
  )
  await page.settle()
  return page
}

const within = (id: string, selector: string): string => `[data-testid="${id}"] ${selector}`
const EDGE_TOLERANCE = 0.5
const titleOf = (id: string): string => within(id, '[data-slot="card-band"] p')
const controlsOf = (id: string): string => within(id, '[data-slot="stat-controls"]')

layout('StatCard exemplar', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const viewport of VIEWPORTS) {
      describe(`${viewport.name}, ${scheme}`, () => {
        test('card height is equal across all five phases', async () => {
          const page = await open(viewport, scheme)
          const heights: [string, number][] = []
          for (const phase of PHASES) {
            const { box } = await page.box(phase, within(`cx-${phase}`, '[data-slot="card"]'))
            heights.push([phase, box.height])
          }
          const first = heights[0]![1]
          for (const [phase, height] of heights) {
            expect(
              Math.abs(height - first),
              `${phase} is ${height}px, ready is ${first}px`,
            ).toBeLessThanOrEqual(0.5)
          }
        })

        test('every phase prints its own data-phase and the slot runs only in ready and stale', async () => {
          const page = await open(viewport, scheme)
          for (const phase of PHASES) {
            const printed = await page.raw.getAttribute(
              within(`cx-${phase}`, '[data-slot="card-phase"]'),
              'data-phase',
            )
            expect(printed).toBe(phase)
            const drawn = await page.count(within(`cx-${phase}`, '[data-slot="stat-chart"]'))
            expect(drawn, `${phase} chart box`).toBe(phase === 'ready' || phase === 'stale' ? 1 : 0)
          }
        })

        test('tile, figure and footer label share one left edge', async () => {
          const page = await open(viewport, scheme)
          const tile = await page.box('tile', within('cx-ready', '[data-slot="icon-tile"]'))
          const figure = await page.box('figure', within('cx-ready', '[data-slot="stat-figure"]'))
          const label = await page.box(
            'footer label',
            within('cx-ready', '[data-slot="stat-footer"] dt'),
          )
          const sub = await page.box('sub', within('cx-ready', '[data-slot="stat-sub"]'))
          const chart = await page.box('chart', within('cx-ready', '[data-slot="stat-chart"]'))
          const card = await page.box('card', within('cx-ready', '[data-slot="card"]'))
          const edge = tile.box.left
          for (const part of [figure, label, sub, chart]) {
            expect(
              Math.abs(part.box.left - edge),
              `${part.name} at ${part.box.left}, tile at ${edge}`,
            ).toBeLessThanOrEqual(EDGE_TOLERANCE)
          }
          // The left edge is a real gutter, not the card's own border.
          expect(edge - card.box.left).toBeGreaterThanOrEqual(12 - EDGE_TOLERANCE)
        })

        test('the chart slot gets the 72 px box and cannot grow the card', async () => {
          const page = await open(viewport, scheme)
          const box = await page.box('chart box', within('cx-ready', '[data-slot="stat-chart"]'))
          expect(box.box.height).toBeCloseTo(72, 0)
          expect(
            await page.raw.getAttribute(
              within('cx-ready', '[data-testid="cx-chart-fill"]'),
              'data-box-height',
            ),
          ).toBe('72')
          expect(
            await page.raw.getAttribute(
              within('cx-stale', '[data-testid="cx-chart-fill"]'),
              'data-box-phase',
            ),
          ).toBe('stale')
          const normal = await page.box('narrow card', within('cx-narrow', '[data-slot="card"]'))
          const greedy = await page.box('greedy card', within('cx-greedy', '[data-slot="card"]'))
          expect(Math.abs(greedy.box.height - normal.box.height)).toBeLessThanOrEqual(0.5)
        })

        test('a card with no icon, no chart and no sub keeps the left edge and a dash', async () => {
          const page = await open(viewport, scheme)
          const figure = await page.box('figure', within('cx-bare', '[data-slot="stat-figure"]'))
          const label = await page.box(
            'footer label',
            within('cx-bare', '[data-slot="stat-footer"] dt'),
          )
          expect(Math.abs(figure.box.left - label.box.left)).toBeLessThanOrEqual(EDGE_TOLERANCE)
          expect(
            await page.raw.textContent(within('cx-bare', '[data-slot="stat-figure"]')),
          ).toContain('–')
        })

        test('the stretched link paints its focus ring inside the card', async () => {
          const page = await open(viewport, scheme)
          const target = within('cx-link', '[data-slot="stat-target"]')
          await page.raw.focus(target)
          await page.raw.keyboard.press('Shift+Tab')
          await page.raw.keyboard.press('Tab')
          expect(await page.computed(target, 'outline-style')).toBe('solid')
          const ring = await page.box('target', target)
          const card = await page.box('card', within('cx-link', '[data-slot="card"]'))
          expect(ring.box.left).toBeGreaterThanOrEqual(card.box.left)
          expect(ring.box.right).toBeLessThanOrEqual(card.box.right + 0.5)
          // The offset is negative, so the outline lies inside the clipped card.
          expect(Number.parseFloat(await page.computed(target, 'outline-offset'))).toBeLessThan(0)
        })
      })
    }
  }

  describe('controls wrap below @regular', () => {
    test('at 360 px the controls take a second header row; at 560 px they share the title row', async () => {
      const page = await open(DESKTOP, 'light')
      const narrowTitle = await page.box('narrow title', titleOf('cx-narrow'))
      const narrowControls = await page.box('narrow controls', controlsOf('cx-narrow'))
      expect(narrowControls.box.top).toBeGreaterThanOrEqual(narrowTitle.box.bottom)
      const wideTitle = await page.box('wide title', titleOf('cx-wide'))
      const wideControls = await page.box('wide controls', controlsOf('cx-wide'))
      expect(wideControls.box.top).toBeLessThan(wideTitle.box.bottom)
      expect(wideControls.box.left).toBeGreaterThan(wideTitle.box.left)
    })

    test('on the phone the controls sit on a second row', async () => {
      const page = await open(PHONE, 'light')
      const title = await page.box('title', within('cx-ready', '[data-slot="card-band"] p'))
      const controls = await page.box('controls', within('cx-ready', '[data-slot="stat-controls"]'))
      expect(controls.box.top).toBeGreaterThanOrEqual(title.box.bottom)
    })
  })

  describe('phone', () => {
    for (const scheme of ['light', 'dark'] as const) {
      test(`no horizontal overflow at 390, ${scheme}`, async () => {
        const page = await open(PHONE, scheme)
        expectNoHorizontalOverflow(
          await page.horizontalOverflow(),
          'a stat card must fit a 390 px phone with no sideways scroll',
          PHONE,
        )
      })
    }
  })
})
