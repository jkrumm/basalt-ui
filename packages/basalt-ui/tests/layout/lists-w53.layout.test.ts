/**
 * Wave 53 lists in real Chrome:
 * - A bounded `EventList` cue beside a "Show earlier (N)" control says what it counts ("loaded"); without
 *   the control it stays "above".
 * - A feed message wraps at 390 and 1440 — no ellipsis, no clipped overflow.
 * - The `DangerZone` ring is visibly red in light as well as dark: light at least 3:1 against page and panel.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  moduleClass,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const HOST = '[data-testid="el-host"]'

const base: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
}

const eventSpec = (mode: NonNullable<FixtureSpec['eventList']>): FixtureSpec => ({
  ...base,
  eventList: mode,
})

layout('Wave 53 EventList', () => {
  for (const [name, viewport] of [
    ['390', PHONE],
    ['1440', DESKTOP_1440],
  ] as const) {
    test(`${name}: the cue beside Show earlier names what it counts`, async () => {
      const p = await openFixture(eventSpec('timeline-oldest'), viewport)
      await p.raw.waitForSelector(`${HOST} time`)
      await p.raw.waitForTimeout(400)
      const r = (await p.raw.evaluate(`(() => {
        const box = document.querySelector('${HOST} [data-above]')
        return { cue: box ? getComputedStyle(box, '::before').content : null, button: document.querySelector('${HOST} button')?.textContent }
      })()`)) as { cue: string | null; button: string | null }
      expect(r.button).toContain('Show earlier')
      expect(r.cue).toMatch(/^"↑ \d+ loaded above"$/)
    })
  }

  test('without a Show earlier control the cue keeps its plain wording', async () => {
    const p = await openFixture(eventSpec('plain-oldest'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} time`)
    await p.raw.waitForTimeout(400)
    const cue = (await p.raw.evaluate(`(() => {
      const box = document.querySelector('${HOST} [data-above]')
      return box ? getComputedStyle(box, '::before').content : null
    })()`)) as string | null
    expect(cue).toMatch(/^"↑ \d+ above"$/)
  })

  for (const [name, viewport] of [
    ['390', PHONE],
    ['1440', DESKTOP_1440],
  ] as const) {
    test(`${name}: a long feed sentence wraps — never an ellipsis or a clipped line`, async () => {
      const p = await openFixture(eventSpec('wrap'), viewport)
      await p.raw.waitForSelector(`${HOST} ${moduleClass('line')}`)
      const r = (await p.raw.evaluate(`(() => {
        const line = [...document.querySelectorAll('${HOST} ${moduleClass('line')}')].find((l) => l.textContent.includes('rebuilt the nightly'))
        const cs = getComputedStyle(line)
        return { overflow: cs.textOverflow, whiteSpace: cs.whiteSpace, fits: line.scrollWidth <= line.clientWidth + 1, height: line.getBoundingClientRect().height, lh: parseFloat(cs.lineHeight) }
      })()`)) as { overflow: string; whiteSpace: string; fits: boolean; height: number; lh: number }
      expect(r.overflow).not.toBe('ellipsis')
      expect(r.whiteSpace).not.toBe('nowrap')
      expect(r.fits).toBe(true)
      expect(r.height).toBeGreaterThan(r.lh * 1.5)
    })
  }
})

layout('Wave 53 DangerZone ring', () => {
  /** In-page: the ring colour of the card and the page behind it, as sRGB triples. */
  const READ = `(() => {
    const norm = (c) => {
      const x = document.createElement('canvas').getContext('2d')
      x.fillStyle = '#000'
      x.fillStyle = c
      x.fillRect(0, 0, 1, 1)
      return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3)
    }
    const card = document.querySelector('[data-testid="w53-danger-host"] > *')
    const shadow = getComputedStyle(card).boxShadow
    const ring = shadow.split(/,(?![^(]*\\))/).map((s) => s.trim()).find((s) => /0px 0px 0px 1px$/.test(s))
    const colour = ring.replace(/\\s*0px 0px 0px 1px\\s*/, '').trim()
    return { ring: norm(colour), page: norm(getComputedStyle(document.body).backgroundColor), panel: norm(getComputedStyle(card).backgroundColor), raw: ring }
  })()`
  const lum = (c: number[]): number => {
    const [r = 0, g = 0, b = 0] = c.map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const contrast = (a: number[], b: number[]): number => {
    const [hi = 0, lo = 0] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: the ring is red and holds its contrast against the page and panel`, async () => {
      const p = await openFixture({ ...base, colorScheme: scheme, w53Danger: true }, DESKTOP_1440)
      await p.raw.waitForSelector('[data-testid="w53-danger-host"]')
      await p.settle()
      const r = (await p.raw.evaluate(READ)) as {
        ring: number[]
        page: number[]
        panel: number[]
        raw: string
      }
      const [red = 0, green = 0, blue = 0] = r.ring
      expect(red).toBeGreaterThan(green + 40)
      expect(red).toBeGreaterThan(blue + 40)
      // Dark's ring (2.2:1) is the weight light is held to or past: 40% in light measured 1.7:1.
      const floor = scheme === 'light' ? 3 : 2
      expect(contrast(r.ring, r.page)).toBeGreaterThanOrEqual(floor)
      expect(contrast(r.ring, r.panel)).toBeGreaterThanOrEqual(floor)
    })
  }
})
