/**
 * Wave 43: argo's lift strip `PR` reference. The label sits where the plotted line is not: its box
 * never meets the path in its x-range, and stays inside the plot, at 1440 and 390.
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

const SPARK = '[data-testid^="w43-spark"] [data-basalt-sparkline]'
/** Path samples per px of length, so a thin stroke cannot slip between two. */
const SAMPLE_STEP_PX = 0.5
/** The stroke's half width (0.75) plus 4 px of air, px: how near the path may come to a label's glyphs (r2 #16: 2.5 px read as touching). */
const INK = 4.75
/** A label's glyph ink is this share of its font size tall; the text box's rest is line-height air. */
const GLYPH_INK = 0.75

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w43Spark: true,
}

layout('Wave 43 sparkline reference label', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)('%s: the PR label clears the line and stays in the plot', async (_, viewport) => {
    const p = await openFixture(spec, viewport)
    await p.settle()
    const rows = await p.raw.evaluate(
      ({ sel, step, ink, inkH }) =>
        [...document.querySelectorAll(sel)].map((root) => {
          const svg = root.querySelector('svg')
          const label = [...root.querySelectorAll('text')].find((t) => t.textContent === 'PR')
          const path = root.querySelector<SVGPathElement>('[data-ts-key^="line"] path')
          if (!svg || !label || !path) throw new Error('LAYOUT: missing svg, PR label or line path')
          const line = label.getBoundingClientRect()
          const fs = parseFloat(getComputedStyle(label).fontSize)
          const mid = (line.top + line.bottom) / 2
          const box = {
            left: line.left,
            right: line.right,
            top: mid - (fs * inkH) / 2,
            bottom: mid + (fs * inkH) / 2,
          }
          const frame = svg.getBoundingClientRect()
          const m = path.getScreenCTM()
          if (!m) throw new Error('LAYOUT: no CTM')
          let hits = 0
          const len = path.getTotalLength()
          for (let at = 0; at <= len; at += step) {
            const pt = path.getPointAtLength(at).matrixTransform(m)
            if (
              pt.x + ink >= box.left &&
              pt.x - ink <= box.right &&
              pt.y + ink >= box.top &&
              pt.y - ink <= box.bottom
            )
              hits += 1
          }
          return {
            hits,
            inside:
              line.left >= frame.left - 0.5 &&
              line.right <= frame.right + 0.5 &&
              box.top >= frame.top - 0.5 &&
              box.bottom <= frame.bottom + 0.5,
          }
        }),
      { sel: SPARK, step: SAMPLE_STEP_PX, ink: INK, inkH: GLYPH_INK },
    )
    expect(rows.length).toBe(4)
    for (const r of rows) {
      expect(r.hits).toBe(0)
      expect(r.inside).toBe(true)
    }
  })

  test('the INOL band is drawn in full inside its plot', async () => {
    const p = await openFixture(spec, DESKTOP_1440)
    await p.settle()
    const rows = await p.raw.evaluate(() =>
      [...document.querySelectorAll('[data-testid="w43-inol"] [data-lift]')].map((root) => {
        const svg = root.querySelector('svg')
        const band = svg?.querySelector('[data-ts-key="band"] rect')
        const line = svg?.querySelector<SVGPathElement>('[data-ts-key^="line"] path')
        if (!svg || !band || !line) throw new Error('LAYOUT: missing svg, band or line')
        const box = svg.getBoundingClientRect()
        const b = band.getBoundingClientRect()
        const l = line.getBoundingClientRect()
        return {
          lift: root.getAttribute('data-lift'),
          top: b.top - box.top,
          bottom: box.bottom - b.bottom,
          height: b.height,
          left: b.left - box.left,
          right: box.right - b.right,
          lineLeft: l.left - box.left,
          lineRight: box.right - l.right,
        }
      }),
    )
    const INOL = {
      squat: [0.62, 0.7, 0.78, 0.74, 0.85, 0.9, 0.82, 0.88],
      bench: [0.9, 1.05, 1.2, 1.15, 1.3, 1.4, 1.25, 1.35],
      deadlift: [0.35, 0.4, 0.3, 0.45, 0.38, 0.42, 0.33, 0.4],
    } as const
    expect(rows.map((r) => r.lift)).toEqual(['squat', 'bench', 'deadlift'])
    for (const r of rows) {
      const data = INOL[r.lift as keyof typeof INOL]
      // The y domain is the data and the band, padded a quarter of its span each side: the plot is
      // 22 px of the 28, and the band is its 0.6–1.0 share of the padded domain.
      const lo = Math.min(...data, 0.6)
      const hi = Math.max(...data, 1)
      const expected = (22 * 0.4) / ((hi - lo) * 1.5)
      expect(r.height).toBeCloseTo(expected, 0)
      // Both edges inside the box with air (r2 #21: 4.8 px read as running off the plot).
      expect(r.top).toBeGreaterThan(6)
      expect(r.bottom).toBeGreaterThan(6)
      // The band spans the plot the line is drawn in: its start (and, with the end dot, its end).
      expect(r.left).toBeLessThanOrEqual(r.lineLeft + 0.5)
      expect(r.right).toBeLessThanOrEqual(r.lineRight + 0.5)
    }
  })
})
