/**
 * Wave 46 r1 in a real browser: a chart's empty body is the § 6.11 tile (one ring, card radius, the
 * title at md 500, centred) inside the chart's own D37 box; a pending line chart draws a line ghost;
 * a loading StatCard keeps its delta and a sparkline-shaped row, at the loaded card's height.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage } from './harness'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const specFor = (colorScheme: 'light' | 'dark'): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  colorScheme,
  w46Charts: true,
})

/** Rounding slack for subpixel text metrics. */
const SLACK = 2

const heightOf = (p: LayoutPage, id: string): Promise<number> =>
  p.raw.evaluate((testid) => {
    const card = document.querySelector(`[data-testid="${testid}"] > *`)
    if (!card) throw new Error(`LAYOUT: no ${testid}`)
    return card.getBoundingClientRect().height
  }, id)

layout('Wave 46 r1 chart and stat states', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: the empty chart is a ringed tile that fills the chart's box, title at 500`, async () => {
      const p = await openFixture(specFor(scheme), DESKTOP_1440)
      await p.settle()
      const tile = await p.raw.evaluate(() => {
        const t = document.querySelector<HTMLElement>(
          '[data-testid="w46-chart-empty"] [data-basalt-empty-tile]',
        )
        if (!t) throw new Error('LAYOUT: no empty tile')
        const b = t.getBoundingClientRect()
        const title = t.querySelector('span')!
        const copy = t.querySelector('output')!
        const cardTitle = document.querySelector(
          '[data-testid="w46-chart-empty"] [data-widget-title]',
        )
        if (!cardTitle) throw new Error('LAYOUT: no [data-widget-title] on the chart card')
        const cs = getComputedStyle(t)
        return {
          shadow: cs.boxShadow,
          radius: cs.borderTopLeftRadius,
          weight: getComputedStyle(title).fontWeight,
          titleSize: parseFloat(getComputedStyle(title).fontSize),
          cardTitleSize: parseFloat(getComputedStyle(cardTitle).fontSize),
          // The copy block's centre against the tile's, both axes.
          midY:
            b.top +
            b.height / 2 -
            (copy.getBoundingClientRect().top + copy.getBoundingClientRect().height / 2),
          midX:
            b.left +
            b.width / 2 -
            (copy.getBoundingClientRect().left + copy.getBoundingClientRect().width / 2),
        }
      })
      expect(tile.shadow).not.toBe('none')
      expect(parseFloat(tile.radius)).toBeGreaterThan(0)
      expect(tile.weight).toBe('500')
      // Never louder than the card title beside it.
      expect(tile.titleSize).toBeLessThanOrEqual(tile.cardTitleSize + SLACK)
      // The D37 height: the empty card is as tall as the card at rest.
      const [rest, empty] = [
        await heightOf(p, 'w46-chart-rest'),
        await heightOf(p, 'w46-chart-empty'),
      ]
      expect(Math.abs(empty - rest)).toBeLessThanOrEqual(SLACK)
      // With no action the copy block is centred in the tile, both ways.
      expect(Math.abs(tile.midY)).toBeLessThanOrEqual(SLACK)
      expect(Math.abs(tile.midX)).toBeLessThanOrEqual(SLACK)
    })

    test(`${scheme}: a pending line chart draws a line ghost, at the loaded height`, async () => {
      const p = await openFixture(specFor(scheme), DESKTOP_1440)
      await p.settle()
      const kind = await p.raw.evaluate(
        () =>
          document
            .querySelector('[data-testid="w46-chart-pending"] [data-basalt-plot-ghost]')
            ?.getAttribute('data-basalt-plot-ghost') ?? null,
      )
      expect(kind).toBe('line')
      const [rest, pending] = [
        await heightOf(p, 'w46-chart-rest'),
        await heightOf(p, 'w46-chart-pending'),
      ]
      expect(Math.abs(pending - rest)).toBeLessThanOrEqual(SLACK)
    })

    test(`${scheme}: the empty StatCard is a ringed tile, its title at 500 and no louder than sm`, async () => {
      const p = await openFixture(specFor(scheme), DESKTOP_1440)
      await p.settle()
      const tile = await p.raw.evaluate(() => {
        const card = document.querySelector('[data-testid="w46-stat-empty"] > *')
        const ring = [...(card?.querySelectorAll<HTMLElement>('*') ?? [])].find(
          (el) => getComputedStyle(el).boxShadow !== 'none' && el.querySelector('span'),
        )
        if (!card || !ring) throw new Error('LAYOUT: no empty tile in the StatCard')
        const span = ring.querySelector('span')!
        const cs = getComputedStyle(ring)
        const [c, r] = [card.getBoundingClientRect(), ring.getBoundingClientRect()]
        return {
          weight: getComputedStyle(span).fontWeight,
          size: parseFloat(getComputedStyle(span).fontSize),
          sm: parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.875,
          radius: parseFloat(cs.borderTopLeftRadius),
          inside: r.left >= c.left && r.right <= c.right && r.top >= c.top && r.bottom <= c.bottom,
        }
      })
      expect(tile.weight).toBe('500')
      expect(tile.size).toBeLessThanOrEqual(tile.sm + SLACK)
      expect(tile.radius).toBeGreaterThan(0)
      expect(tile.inside).toBe(true)
    })

    test(`${scheme}: a loading StatCard keeps the delta chip and a sparkline-shaped row, at rest height`, async () => {
      const p = await openFixture(specFor(scheme), DESKTOP_1440)
      await p.settle()
      const seen = await p.raw.evaluate(() => {
        const q = (s: string) =>
          document.querySelector(`[data-testid="w46-stat-loading"] ${s}`)?.getBoundingClientRect()
        return {
          delta: q('[data-stat-skeleton-delta]')?.width ?? 0,
          spark: q('[data-stat-skeleton-spark] polyline')?.width ?? 0,
        }
      })
      expect(seen.delta).toBeGreaterThan(0)
      expect(seen.spark).toBeGreaterThan(0)
      const [rest, loading] = [
        await heightOf(p, 'w46-stat-rest'),
        await heightOf(p, 'w46-stat-loading'),
      ]
      expect(Math.abs(loading - rest)).toBeLessThanOrEqual(SLACK)
    })
  }
})
