/**
 * Wave 43: argo's Weight cell low–high Meter with the reading at the track start. The start caption's
 * descender paints in full, and the end caption stays on one line when both captions fit the track.
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
  w43MeterStart: true,
}

/** Sub-pixel slack on a measured edge, px. */
const EPS = 0.5
/** A caption box taller than this many line-heights is wrapped. */
const ONE_LINE = 1.5

type Probe = {
  texts: string[]
  /** Per caption: its glyph box bottom past the lowest clipping ancestor edge, px (≤ 0 = whole). */
  clipped: number[]
  /** Per caption: height over its own line-height. */
  lines: number[]
  /** Per caption: its box top, px. */
  tops: number[]
  /** The captions' combined natural width fits the track. */
  fits: boolean
}

const probe = (p: Awaited<ReturnType<typeof openFixture>>, id: string): Promise<Probe> =>
  p.raw.evaluate((id) => {
    const host = document.querySelector(`[data-testid="${id}"]`) as Element
    const track = host.querySelector('[data-meter-track]') as HTMLElement
    const named = [...host.querySelectorAll('span, p, div')].filter(
      (el) =>
        el.children.length === 0 &&
        /^(low|high) \d/.test(el.textContent ?? '') &&
        !el.closest('[data-hidden]'),
    ) as HTMLElement[]
    const clips = (el: Element) => {
      const cs = getComputedStyle(el)
      return cs.overflowY !== 'visible'
    }
    const clipped = named.map((el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const glyphs = range.getBoundingClientRect()
      let worst = -Infinity
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        if (!clips(a)) continue
        worst = Math.max(worst, glyphs.bottom - a.getBoundingClientRect().bottom)
      }
      return worst === -Infinity ? -1 : worst
    })
    const lines = named.map((el) => {
      const lh = parseFloat(getComputedStyle(el).lineHeight)
      return el.getBoundingClientRect().height / lh
    })
    const tops = named.map((el) => el.getBoundingClientRect().top)
    const natural = named.reduce((sum, el) => {
      const r = document.createRange()
      r.selectNodeContents(el)
      return sum + r.getBoundingClientRect().width
    }, 0)
    return {
      texts: named.map((el) => el.textContent ?? ''),
      clipped,
      lines,
      tops,
      fits: natural + 8 <= track.getBoundingClientRect().width,
    }
  }, id)

layout('Wave 43 start-side Meter captions', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)('%s: the captions are whole and on one line', async (_, viewport) => {
    const p = await openFixture(spec, viewport)
    await p.settle()
    for (const id of ['w43-start', 'w43-fill-short', 'w43-start-two']) {
      const m = await probe(p, id)
      expect(m.texts.length).toBe(2)
      // (a) no clipping ancestor cuts the glyph box
      for (const c of m.clipped) expect(c).toBeLessThanOrEqual(EPS)
      // (b) argo's captions (~128px together) fit the track at both widths (1440: ~355px, 390: ~164px),
      // so the single-line assertions can never be skipped: a track that stopped fitting fails here.
      expect(m.fits).toBe(true)
      for (const l of m.lines) expect(l).toBeLessThan(ONE_LINE)
      expect(Math.abs((m.tops[0] ?? 0) - (m.tops[1] ?? 0))).toBeLessThanOrEqual(EPS)
    }
  })
})
