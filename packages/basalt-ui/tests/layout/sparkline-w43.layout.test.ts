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

const SPARK = '[data-testid="w43-spark"] [data-basalt-sparkline]'
/** Path samples per px of length, so a thin stroke cannot slip between two. */
const SAMPLE_STEP_PX = 0.5
/** The stroke's half width and the end dot's radius, px: the path's real ink. */
const INK = 2.5
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
    expect(rows.length).toBe(2)
    for (const r of rows) {
      expect(r.hits).toBe(0)
      expect(r.inside).toBe(true)
    }
  })
})
