/**
 * Expression cycle 2's chart kit fixes in real Chrome, at 1800 and 390 px (docs/v3/cycles/expression-2.md
 * rows .41, .44, .48, .55, .63): the captions of reference lines and vertical rules never overprint
 * each other, a data line or the axis ticks, and a multi-day time axis keeps at least three ticks.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { Viewport } from './harness'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const WIDE: Viewport = { name: 'wide', width: 1800, height: 1200 }
const SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  k2Kit: true,
}

const CHARTS = ['rules', 'pinned', 'zero', 'cap', 'ticks']

layout('expression cycle 2 chart kit fixes', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const viewport of [WIDE, PHONE]) {
    const at = `${viewport.width}px`

    test(`${at}: no two texts of a chart overprint, rule captions included`, async () => {
      const p = await openFixture(SPEC, viewport)
      await p.settle()
      const probe = await p.raw.evaluate((ids) => {
        const out: Record<string, { texts: string[]; overlaps: string[] }> = {}
        for (const id of ids) {
          const host = document.querySelector(`[data-testid="k2-chart-${id}"]`)
          const boxes = [...(host?.querySelectorAll('svg text') ?? [])]
            .map((t) => ({ text: t.textContent ?? '', r: t.getBoundingClientRect() }))
            .filter((b) => b.text.trim() !== '' && b.r.width > 0)
          const overlaps: string[] = []
          for (let i = 0; i < boxes.length; i++)
            for (let j = i + 1; j < boxes.length; j++) {
              const a = boxes[i]!.r
              const b = boxes[j]!.r
              const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
              const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
              if (w > 0.5 && h > 0.5) overlaps.push(`${boxes[i]!.text} / ${boxes[j]!.text}`)
            }
          out[id] = { texts: boxes.map((b) => b.text), overlaps }
        }
        return out
      }, CHARTS)
      for (const id of CHARTS)
        expect({ id, overlaps: probe[id]!.overlaps }).toEqual({ id, overlaps: [] })
    })

    test(`${at}: a reference caption clears its line and the data under it`, async () => {
      const p = await openFixture(SPEC, viewport)
      await p.settle()
      const probe = await p.raw.evaluate(() => {
        const host = document.querySelector('[data-testid="k2-chart-pinned"]')
        const label = host
          ?.querySelector('g[data-ts-key="ref-0-label"] text')
          ?.getBoundingClientRect()
        const rule = host?.querySelector('g[data-ts-key="ref-0"] line')?.getBoundingClientRect()
        if (!host || !label || !rule) throw new Error('LAYOUT: no reference label or rule')
        // Every drawn series path, walked every 2 px: how many points fall inside the label's box.
        let inside = 0
        for (const path of host.querySelectorAll('path')) {
          const geometry = path as SVGGeometryElement
          const total = geometry.getTotalLength()
          const ctm = geometry.getScreenCTM()
          if (!ctm || total === 0 || geometry.getAttribute('fill') !== 'none') continue
          for (let at = 0; at <= total; at += 2) {
            const pt = geometry.getPointAtLength(at).matrixTransform(ctm)
            if (
              pt.x >= label.left &&
              pt.x <= label.right &&
              pt.y >= label.top &&
              pt.y <= label.bottom
            )
              inside++
          }
        }
        return {
          struck: rule.top >= label.top && rule.top <= label.bottom,
          inside,
          label: label.toJSON(),
        }
      })
      expect(probe.struck).toBe(false)
      expect(probe.inside).toBe(0)
    })

    test(`${at}: the lowest y tick keeps clear of the first x tick`, async () => {
      const p = await openFixture(SPEC, viewport)
      await p.settle()
      const gap = await p.raw.evaluate(() => {
        const host = document.querySelector('[data-testid="k2-chart-zero"]')
        const texts = [...(host?.querySelectorAll('svg text') ?? [])]
        const zero = texts.find((t) => t.textContent === '0')?.getBoundingClientRect()
        const first = texts
          .filter((t) => /[A-Z][a-z]{2}/.test(t.textContent ?? ''))
          .map((t) => t.getBoundingClientRect())
          .toSorted((a, b) => a.left - b.left)[0]
        if (!zero || !first) throw new Error('LAYOUT: no 0 tick or first x tick')
        const dx = Math.max(0, first.left - zero.right, zero.left - first.right)
        const dy = Math.max(0, first.top - zero.bottom, zero.top - first.bottom)
        return Math.hypot(dx, dy)
      })
      expect(gap).toBeGreaterThanOrEqual(2)
    })

    test(`${at}: a multi-day time axis keeps at least three ticks`, async () => {
      const p = await openFixture(SPEC, viewport)
      await p.settle()
      const ticks = await p.raw.evaluate(() => {
        const host = document.querySelector('[data-testid="k2-chart-ticks"]')
        const plot = host?.querySelector('svg clipPath rect')
        const svg = host?.querySelector('svg')
        if (!host || !plot || !svg) throw new Error('LAYOUT: no ticks chart')
        const bottom =
          svg.getBoundingClientRect().top +
          Number(plot.getAttribute('y')) +
          Number(plot.getAttribute('height'))
        return [...svg.querySelectorAll('text')]
          .filter(
            (t) => t.getBoundingClientRect().top >= bottom - 1 && (t.textContent ?? '') !== '',
          )
          .map((t) => t.textContent)
      })
      expect(ticks.length).toBeGreaterThanOrEqual(3)
    })
  }
})
