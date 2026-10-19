/**
 * Wave 38 chart-card loading in a real browser: a pending card keeps the facts row's footprint, so
 * its height equals the card at rest (a chart body and a `placeholderHeight="content"` list body),
 * and a pending plot paints a ghost visible against the card surface in both schemes.
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
  w38Loading: true,
})

/** Rounding slack for subpixel text metrics. */
const SLACK = 2

const cardHeight = (p: LayoutPage, body: string, mode: string): Promise<number> =>
  p.raw.evaluate(
    ([body, mode]) => {
      const card = document.querySelector(
        `[data-testid="w38-load-${body}-${mode}"] [data-basalt-chart-card]`,
      )
      if (!card) throw new Error(`LAYOUT: no card for ${body}-${mode}`)
      return card.getBoundingClientRect().height
    },
    [body, mode] as const,
  )

/** The luminance contrast between the ghost's bar and the card surface behind it. */
const ghostContrast = (p: LayoutPage): Promise<number> =>
  p.raw.evaluate(() => {
    const bar = document.querySelector('[data-basalt-plot-ghost] > span')
    const card = document.querySelector(
      '[data-testid="w38-load-chart-loading"] [data-basalt-chart-card]',
    )
    if (!bar || !card) throw new Error('LAYOUT: no plot ghost')
    // `color-mix` computes to `color(srgb …)`; a canvas pixel normalises any CSS colour to 0–255.
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
    const rgb = (css: string): number[] => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      return [...ctx.getImageData(0, 0, 1, 1).data]
    }
    const lum = ([r = 0, g = 0, b = 0]: number[]): number => {
      const f = (c: number): number => {
        const s = c / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const a = lum(rgb(getComputedStyle(bar).backgroundColor))
    const b = lum(rgb(getComputedStyle(card).backgroundColor))
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  })

layout('chart card loading (Wave 38)', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const scheme of ['light', 'dark'] as const) {
    for (const body of ['chart', 'list']) {
      test(`${scheme}: a pending ${body} card is as tall as at rest`, async () => {
        const p = await openFixture(specFor(scheme), DESKTOP_1440)
        await p.settle()
        const rest = await cardHeight(p, body, 'rest')
        const loading = await cardHeight(p, body, 'loading')
        expect(Math.abs(loading - rest)).toBeLessThanOrEqual(SLACK)
      })
    }

    test(`${scheme}: the plot ghost is visible against the card`, async () => {
      const p = await openFixture(specFor(scheme), DESKTOP_1440)
      await p.settle()
      const c = await ghostContrast(p)
      expect(c).toBeGreaterThan(1.3)
    })
  }
})
