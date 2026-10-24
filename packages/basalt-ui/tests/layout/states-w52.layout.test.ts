/**
 * Wave 52 states in a real browser: a `Section` that loads is as tall as the figure it will hold, a
 * Meter's empty state is the same box as a `BarList`'s, Retry has an edge that reads as a control in
 * both schemes, and a track-start caption stays off the reading tick.
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

type Scheme = 'light' | 'dark'

const specFor = (colorScheme: Scheme): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  colorScheme,
  w52States: true,
})

/** The loading height may differ from the loaded one by this fraction. */
const TOLERANCE = 0.25

layout('Wave 52 states', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each(['bar', 'events', 'meter'])(
    'a Section loading %s is within 25% of its loaded height',
    async (kind) => {
      const p = await openFixture(specFor('light'), DESKTOP_1440)
      await p.settle()
      const [loaded, loading] = await p.raw.evaluate((kind) => {
        const h = (state: string) =>
          document
            .querySelector(`[data-testid="w52-sec-${kind}-${state}"]`)
            ?.getBoundingClientRect().height ?? 0
        return [h('loaded'), h('loading')]
      }, kind)
      expect(loaded).toBeGreaterThan(0)
      expect(Math.abs((loading ?? 0) - (loaded ?? 0)) / (loaded ?? 1)).toBeLessThanOrEqual(
        TOLERANCE,
      )
    },
  )

  test.each(['bar', 'events', 'meter'])(
    'a pending ChartCard over a %s loads as that figure, never the real one, at its footprint',
    async (kind) => {
      const p = await openFixture(specFor('light'), DESKTOP_1440)
      await p.settle()
      const r = await p.raw.evaluate((kind) => {
        const host = (state: string) =>
          document.querySelector<HTMLElement>(`[data-testid="w53-card-${kind}-${state}"]`)
        const loading = host('loading')
        return {
          loaded: host('loaded')?.getBoundingClientRect().height ?? 0,
          loading: loading?.getBoundingClientRect().height ?? 0,
          busy: loading?.querySelector('[aria-busy="true"]') !== null,
          real: /project 0|step 0|40/.test(loading?.textContent ?? ''),
        }
      }, kind)
      expect(r.busy).toBe(true)
      expect(r.real).toBe(false)
      expect(r.loaded).toBeGreaterThan(0)
      expect(Math.abs(r.loading - r.loaded) / r.loaded).toBeLessThanOrEqual(TOLERANCE)
    },
  )

  test('an empty Meter is the BarList empty box: same class geometry, no track stripe', async () => {
    const p = await openFixture(specFor('light'), DESKTOP_1440)
    await p.settle()
    const m = await p.raw.evaluate(() => {
      const box = (id: string) => {
        const host = document.querySelector(`[data-testid="${id}"]`)
        const tile = host?.querySelector<HTMLElement>('[role="status"] > div')
        if (!host || !tile) throw new Error(`LAYOUT: no empty tile in ${id}`)
        const cs = getComputedStyle(tile)
        return {
          paddingTop: cs.paddingTop,
          paddingLeft: cs.paddingLeft,
          borderRadius: cs.borderRadius,
          boxShadow: cs.boxShadow,
          track: host.querySelector('[data-meter-track]') !== null,
        }
      }
      return { meter: box('w52-empty-meter'), bar: box('w52-empty-bar') }
    })
    expect(m.meter.track).toBe(false)
    expect({ ...m.meter, track: false }).toEqual({ ...m.bar, track: false })
  })

  test.each(['light', 'dark'] as const)(
    'in %s, Retry has a border at least 3:1 against its surface',
    async (scheme) => {
      const p = await openFixture(specFor(scheme), DESKTOP_1440)
      await p.settle()
      const ratios = await p.raw.evaluate(() => {
        const rgba = (color: string): [number, number, number, number] => {
          const c = document.createElement('canvas')
          c.width = c.height = 1
          const ctx = c.getContext('2d') as CanvasRenderingContext2D
          ctx.fillStyle = color
          ctx.fillRect(0, 0, 1, 1)
          const d = ctx.getImageData(0, 0, 1, 1).data
          return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, d[3] ?? 0]
        }
        const lum = ([r, g, b]: [number, number, number, number]) => {
          const f = (v: number) => {
            const s = v / 255
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
          }
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
        }
        const ratio = (a: string, b: string) => {
          // A border that is not opaque is no edge at all.
          if (rgba(a)[3] < 255) return 1
          const [hi, lo] = [lum(rgba(a)), lum(rgba(b))].sort((x, y) => y - x)
          return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
        }
        return ['w52-retry-bg', 'w52-retry-panel'].map((id) => {
          const host = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
          const btn = host?.querySelector('button')
          if (!host || !btn) throw new Error(`LAYOUT: no retry in ${id}`)
          const cs = getComputedStyle(btn)
          return {
            width: cs.borderTopWidth,
            ratio: ratio(cs.borderTopColor, getComputedStyle(host).backgroundColor),
          }
        })
      })
      for (const r of ratios) {
        expect(r.width).not.toBe('0px')
        expect(r.ratio).toBeGreaterThanOrEqual(3)
      }
    },
  )

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)(
    '%s: the track-start caption sits at the track start, not under the tick',
    async (_, viewport) => {
      const p = await openFixture(specFor('light'), viewport)
      await p.settle()
      const m = await p.raw.evaluate(() => {
        const host = document.querySelector('[data-testid="w52-start"]') as Element
        const track = host.querySelector('[data-meter-track]') as HTMLElement
        const caption = [...host.querySelectorAll('span, p, div')].find(
          (el) => el.children.length === 0 && (el.textContent ?? '').startsWith('60-day low'),
        ) as HTMLElement
        const r = document.createRange()
        r.selectNodeContents(caption)
        const glyphs = r.getBoundingClientRect()
        const tick = host.querySelector('[data-meter-tick="marker"]') as HTMLElement | null
        const t = tick?.getBoundingClientRect()
        return {
          trackLeft: track.getBoundingClientRect().left,
          captionLeft: glyphs.left,
          captionRight: glyphs.right,
          tickCentre: t === undefined ? null : t.left + t.width / 2,
        }
      })
      expect(Math.abs(m.captionLeft - m.trackLeft)).toBeLessThanOrEqual(1)
      // On the wide strip the reading tick is further from the start than the caption is long.
      if (viewport === DESKTOP_1440) {
        expect(m.tickCentre).not.toBeNull()
        expect(m.captionRight).toBeLessThan(m.tickCentre ?? 0)
      }
    },
  )
})
