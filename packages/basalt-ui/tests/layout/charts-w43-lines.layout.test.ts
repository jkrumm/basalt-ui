/**
 * Wave 43: argo's body-weight Lines (Weight + 7 d mean ending 0.1 kg apart) at 390 and 1440 — the
 * end labels must not intersect each other, and each must stay inside the chart.
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

const ROOT = '[data-testid="w43-lines"]'
const LABELS = '[data-ts-key$="-end-label"] text'
/** Sub-pixel slack on a measured edge, px. */
const EDGE_EPS = 0.5
/** Air between the two label boxes, px: one label line is the pitch, so the boxes never touch. */
const LABEL_AIR = 2
/** Path samples per px of length, so a thin stroke cannot slip between two. */
const SAMPLE_STEP_PX = 0.5
/** The widest stroke's half width (1.125) plus 3 px of air, px: how near a path may come to a label's glyphs (r2 #12: 1.5 px read as touching). */
const INK = 4.1
/** A label's glyph ink is this share of its font size tall; the text box's rest is line-height air. */
const GLYPH_INK = 0.75

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w43Lines: true,
}

layout('Wave 43 end labels on two close lines', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)(
    '%s: the end labels do not intersect and stay inside the chart',
    async (_, viewport) => {
      const p = await openFixture(spec, viewport)
      await p.settle()
      const m = await p.raw.evaluate(
        ({ root, labels }) => {
          const svg = document.querySelector(`${root} svg`)
          if (!svg) throw new Error('LAYOUT: no chart svg')
          const frame = svg.getBoundingClientRect()
          const boxes = [...svg.querySelectorAll(labels)].map((el) => {
            const r = el.getBoundingClientRect()
            return {
              text: el.textContent,
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
            }
          })
          // The end point of each drawn line, in page px: the stretch a label must not sit on.
          const tails = [...svg.querySelectorAll('path')].flatMap((path) => {
            const d = path.getAttribute('d') ?? ''
            const pts = [...d.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => [
              Number(m[1]),
              Number(m[2]),
            ])
            if (pts.length < 20) return []
            const ctm = path.getScreenCTM()
            if (!ctm) return []
            return pts
              .slice(-1)
              .map(([x, y]) => ({ x: ctm.a * (x ?? 0) + ctm.e, y: ctm.d * (y ?? 0) + ctm.f }))
          })
          return { frame: { left: frame.left, right: frame.right }, boxes, tails }
        },
        { root: ROOT, labels: LABELS },
      )
      expect(m.boxes).toHaveLength(2)
      const [first, second] = m.boxes
      if (!first || !second) throw new Error('LAYOUT: missing end labels')
      const intersect =
        first.left < second.right &&
        second.left < first.right &&
        first.top < second.bottom &&
        second.top < first.bottom
      expect(intersect).toBe(false)
      const air = Math.max(first.top - second.bottom, second.top - first.bottom)
      expect(air).toBeGreaterThanOrEqual(LABEL_AIR)
      // No label covers either line's end point (a noisy line's earlier vertices can still pass under a flipped label: the room to the right of the plot is a separate fix).
      expect(m.tails.length).toBeGreaterThan(0)
      for (const t of m.tails)
        for (const b of m.boxes)
          expect(t.x >= b.left && t.x <= b.right && t.y >= b.top && t.y <= b.bottom).toBe(false)
      for (const b of m.boxes) {
        expect(b.left).toBeGreaterThanOrEqual(m.frame.left - EDGE_EPS)
        expect(b.right).toBeLessThanOrEqual(m.frame.right + EDGE_EPS)
      }
    },
  )

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)(
    '%s: the end labels and the Goal caption sit on no line and on each other',
    async (_, viewport) => {
      const p = await openFixture(spec, viewport)
      await p.settle()
      const m = await p.raw.evaluate(
        ({ root, labels, step, ink, inkH }) => {
          const svg = document.querySelector(`${root} svg`)
          if (!svg) throw new Error('LAYOUT: no chart svg')
          const boxOf = (el: Element) => {
            const r = el.getBoundingClientRect()
            const fs = parseFloat(getComputedStyle(el).fontSize)
            const mid = (r.top + r.bottom) / 2
            return {
              text: el.textContent ?? '',
              left: r.left,
              right: r.right,
              top: mid - (fs * inkH) / 2,
              bottom: mid + (fs * inkH) / 2,
            }
          }
          const texts = [
            ...[...svg.querySelectorAll(labels)].map(boxOf),
            ...[...svg.querySelectorAll('[data-ts-key="ref-0-label"] text')].map(boxOf),
          ]
          const paths = [...svg.querySelectorAll<SVGPathElement>('path')].filter(
            (path) => (path.getAttribute('d') ?? '').split(/[ML]/).length > 20,
          )
          // The Goal rule is a <line>: sampled along its width, at its y.
          const rule = svg.querySelector('[data-ts-key="ref-0"] line')?.getBoundingClientRect()
          const ruleY = rule ? (rule.top + rule.bottom) / 2 : undefined
          const hits = texts.map(() => 0)
          for (const path of paths) {
            const ctm = path.getScreenCTM()
            if (!ctm) continue
            const len = path.getTotalLength()
            for (let at = 0; at <= len; at += step) {
              const pt = path.getPointAtLength(at).matrixTransform(ctm)
              texts.forEach((b, i) => {
                if (
                  pt.x + ink >= b.left &&
                  pt.x - ink <= b.right &&
                  pt.y + ink >= b.top &&
                  pt.y - ink <= b.bottom
                )
                  hits[i] = (hits[i] ?? 0) + 1
              })
            }
          }
          // Each end point (page px) and the Goal rule's y: a label stays on its series' side of the rule.
          const ends = paths.flatMap((path) => {
            const ctm = path.getScreenCTM()
            if (!ctm) return []
            const pt = path.getPointAtLength(path.getTotalLength()).matrixTransform(ctm)
            return [pt.y]
          })
          if (rule)
            for (let x = rule.left; x <= rule.right; x += step)
              texts.forEach((b, i) => {
                if (
                  x + ink >= b.left &&
                  x - ink <= b.right &&
                  Math.abs((b.top + b.bottom) / 2 - (ruleY ?? 0)) <= (b.bottom - b.top) / 2 + ink
                )
                  hits[i] = (hits[i] ?? 0) + 1
              })
          return { texts, hits, ends, ruleY }
        },
        { root: ROOT, labels: LABELS, step: SAMPLE_STEP_PX, ink: INK, inkH: GLYPH_INK },
      )
      expect(m.texts.map((t) => t.text).toSorted()).toEqual([
        '7\u00a0d\u00a0mean',
        'Goal',
        'Weight',
      ])
      m.texts.forEach((t, i) => {
        // A text over a line, named by the text, so the failing tail says which one.
        expect(`${t.text}: ${m.hits[i]} samples on a line`).toBe(`${t.text}: 0 samples on a line`)
      })
      const ruleY = m.ruleY
      if (ruleY === undefined) throw new Error('LAYOUT: no Goal rule')
      for (const t of m.texts.filter((x) => x.text !== 'Goal')) {
        const centre = (t.top + t.bottom) / 2
        const nearest = m.ends.reduce((a, b) =>
          Math.abs(b - centre) < Math.abs(a - centre) ? b : a,
        )
        const apart = (centre - ruleY) * (nearest - ruleY) < 0
        // The Goal rule between a label and its series' end reads as the rule's label.
        expect(`${t.text}: ${apart ? 'across the Goal rule' : 'beside its series'}`).toBe(
          `${t.text}: beside its series`,
        )
      }
      m.texts.forEach((a, i) =>
        m.texts.slice(i + 1).forEach((b) => {
          const over = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
          expect(`${a.text}/${b.text}: ${over}`).toBe(`${a.text}/${b.text}: false`)
        }),
      )
    },
  )
})
