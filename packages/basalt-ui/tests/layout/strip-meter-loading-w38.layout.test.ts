/**
 * Wave 38 loading in the loaded shape, in a real browser: a loading strip cell and a loading Meter
 * stand at the loaded height (±2px) at the widths of 1440 and 390; the forecast caption ends where the
 * forecast fill ends; the cards of one StatGroup share one hero size and baseline at 390.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage } from './harness'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
  moduleClass,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w38StripMeter: true,
}

const TOLERANCE = 2

/** The widths the strip and the Meters are probed at: the 1440 cell/card and the 390 one. */
const STRIP_WIDTHS = [900, 358] as const
const METER_WIDTHS = [640, 328] as const
const METERS = ['goal', 'load', 'forecast', 'mix'] as const
const CELLS = ['mtd', 'forecast', 'budget'] as const

layout('loading keeps the loaded shape (Wave 38)', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)
  let p: LayoutPage
  beforeAll(async () => {
    p = await openFixture(SPEC, DESKTOP_1440)
    await p.settle()
  }, CLOSE_BUDGET_MS)

  const heightOf = (selector: string): Promise<number> =>
    p.raw.evaluate((selector) => {
      const el = document.querySelector(selector)
      if (!el) throw new Error(`LAYOUT: no ${selector}`)
      return el.getBoundingClientRect().height
    }, selector)

  test.each(STRIP_WIDTHS.flatMap((w) => CELLS.map((c) => [w, c] as const)))(
    'strip at %ipx: the loading %s cell is as tall as the loaded one',
    async (w, key) => {
      const cell = (state: string) =>
        `[data-testid="w38l-strip-${w}-${state}"] [data-strip-cell="${key}"]`
      const rest = await heightOf(cell('rest'))
      const loading = await heightOf(cell('loading'))
      expect(Math.abs(loading - rest)).toBeLessThanOrEqual(TOLERANCE)
    },
  )

  test('a loading strip cell shows no reading: the visual is hidden under a skeleton, a Meter in it loads itself', async () => {
    const probe = await p.raw.evaluate(() => {
      const cell = (key: string) =>
        document.querySelector(`[data-testid="w38l-strip-900-loading"] [data-strip-cell="${key}"]`)
      const spark = cell('mtd')?.querySelector('[data-strip-visual] svg')
      const slot = cell('mtd')?.querySelector('[data-strip-visual]')
      return {
        sparkShown:
          spark === null || spark === undefined ? null : getComputedStyle(spark).visibility,
        skeleton: slot?.querySelector('.mantine-Skeleton-root') !== null,
        meterBusy: cell('forecast')
          ?.querySelector('[data-basalt-meter]')
          ?.getAttribute('aria-busy'),
        meterFill: cell('forecast')?.querySelector('[data-meter-fill]') !== null,
      }
    })
    expect(probe.sparkShown).toBe('hidden')
    expect(probe.skeleton).toBe(true)
    expect(probe.meterBusy).toBe('true')
    expect(probe.meterFill).toBe(false)
  })

  test.each(METERS.flatMap((m) => METER_WIDTHS.map((w) => [m, w] as const)))(
    'the loading %s Meter at %ipx is as tall as the loaded one',
    async (kind, w) => {
      const root = (state: string) =>
        `[data-testid="w38l-meter-${kind}-${w}-${state}"] [data-basalt-meter]`
      const rest = await heightOf(root('rest'))
      const loading = await heightOf(root('loading'))
      expect(Math.abs(loading - rest)).toBeLessThanOrEqual(TOLERANCE)
    },
  )

  test('a loading Meter shows no values: its caption text is transparent and hidden from assistive tech', async () => {
    const probe = await p.raw.evaluate(() => {
      const root = document.querySelector(
        '[data-testid="w38l-meter-goal-640-loading"] [data-basalt-meter]',
      )
      const caption = root?.querySelector('[data-meter-captions] > *')
      return {
        busy: root?.getAttribute('aria-busy'),
        ink: caption === null || caption === undefined ? null : getComputedStyle(caption).color,
        hidden: caption?.closest('[aria-hidden="true"]') !== null,
      }
    })
    expect(probe.busy).toBe('true')
    expect(probe.ink).toBe('rgba(0, 0, 0, 0)')
    expect(probe.hidden).toBe(true)
  })

  test.each(METER_WIDTHS.map((w) => [w] as const))(
    'the forecast caption ends at the forecast fill end at %ipx',
    async (w) => {
      const probe = await p.raw.evaluate((w) => {
        const root = document.querySelector(`[data-testid="w38l-meter-forecast-${w}-rest"]`)
        const fill = root?.querySelector('[data-meter-fill="forecast"]')
        const caption = [...(root?.querySelectorAll('[data-meter-captions] > *') ?? [])].find(
          (el) => el.textContent === 'Forecast',
        )
        const spent = [...(root?.querySelectorAll('[data-meter-captions] > *') ?? [])].find(
          (el) => el.textContent === 'Spent',
        )
        const committed = root?.querySelector('[data-meter-fill="committed"]')
        if (!fill || !caption || !spent || !committed)
          throw new Error('LAYOUT: forecast Meter parts missing')
        return {
          fillEnd: fill.getBoundingClientRect().right,
          captionEnd: caption.getBoundingClientRect().right,
          hidden: caption.hasAttribute('data-hidden'),
          committedEnd: committed.getBoundingClientRect().right,
          spentEnd: spent.getBoundingClientRect().right,
        }
      }, w)
      expect(probe.hidden).toBe(false)
      expect(Math.abs(probe.captionEnd - probe.fillEnd)).toBeLessThanOrEqual(TOLERANCE)
      // The reading stays at the committed end.
      expect(Math.abs(probe.spentEnd - probe.committedEnd)).toBeLessThanOrEqual(TOLERANCE)
    },
  )

  test('the cards of one StatGroup share one hero size at 390, and a row shares one baseline', async () => {
    const cards = await p.raw.evaluate((valueClass) => {
      const group = document.querySelector('[data-testid="w38l-group"]')
      return [...(group?.querySelectorAll(valueClass) ?? [])].map((el) => {
        const r = el.getBoundingClientRect()
        return {
          size: Number.parseFloat(getComputedStyle(el).fontSize),
          bottom: r.bottom,
          top: r.top,
        }
      })
    }, moduleClass('value'))
    expect(cards).toHaveLength(3)
    const sizes = new Set(cards.map((c) => c.size))
    expect(sizes.size).toBe(1)
    // The first two cards share a row: one baseline.
    expect(Math.abs((cards[0]?.bottom ?? 0) - (cards[1]?.bottom ?? 1))).toBeLessThanOrEqual(1)
  })
})
