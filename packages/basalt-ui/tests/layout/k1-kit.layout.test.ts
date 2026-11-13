/**
 * Expression cycle 1's kit fixes in real Chrome, at 1800 and 390 px (docs/v3/cycles/expression-1.md
 * rows .8, .10, .22, .27, .28, .45, .47): a pending, empty and errored ChartCard is as tall as the one
 * at rest (facts and basis rows included), a pending Heatmap draws a grid, a fact period never opens a
 * wrapped line with `·`, a strip verdict is a dot and a word, a Meter draws a reading past max as
 * over-limit, takes its track height from the size scale and names a part on its own fill.
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
  k1Kit: true,
}

/** Rounding slack for subpixel text metrics. */
const SLACK = 2

layout('expression cycle 1 kit fixes', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const viewport of [WIDE, PHONE]) {
    const at = `${viewport.width}px`

    for (const kind of ['chart', 'heat'] as const) {
      test(`${at}: a pending, empty and errored ${kind} card is as tall as the one at rest`, async () => {
        const p = await openFixture(SPEC, viewport)
        await p.settle()
        const heights = await p.raw.evaluate((k) => {
          const h = (mode: string): number => {
            const card = document.querySelector(`[data-testid="k1-${k}-${mode}"] > *`)
            if (!card) throw new Error(`LAYOUT: no k1-${k}-${mode}`)
            return card.getBoundingClientRect().height
          }
          return { rest: h('rest'), pending: h('pending'), empty: h('empty'), error: h('error') }
        }, kind)
        expect(Math.abs(heights.pending - heights.rest)).toBeLessThanOrEqual(SLACK)
        expect(Math.abs(heights.empty - heights.rest)).toBeLessThanOrEqual(SLACK)
        expect(Math.abs(heights.error - heights.rest)).toBeLessThanOrEqual(SLACK)
      })
    }

    test(`${at}: the pending skeleton rows stand on the loaded rows, the figure never shows`, async () => {
      const p = await openFixture(SPEC, viewport)
      await p.settle()
      const probe = await p.raw.evaluate(() => {
        const rest = document.querySelector('[data-testid="k1-chart-rest"]')
        const pending = document.querySelector('[data-testid="k1-chart-pending"]')
        const facts = rest?.querySelector('[data-basalt-facts]')?.getBoundingClientRect()
        const reserve = pending?.querySelector('[data-basalt-facts-reserve]')
        const skeleton = pending
          ?.querySelector('[data-basalt-facts-skeleton]')
          ?.getBoundingClientRect()
        const hidden = reserve ? getComputedStyle(reserve).visibility : null
        return {
          facts: facts?.height ?? -1,
          skeleton: skeleton?.height ?? -1,
          hidden,
          figure: pending?.querySelector('[data-basalt-fact-value]') !== null,
        }
      })
      expect(Math.abs(probe.skeleton - probe.facts)).toBeLessThanOrEqual(SLACK)
      expect(probe.hidden).toBe('hidden')
      expect(probe.figure).toBe(false)
    })

    test(`${at}: a pending Heatmap draws a grid at the loaded box`, async () => {
      const p = await openFixture(SPEC, viewport)
      await p.settle()
      const probe = await p.raw.evaluate(() => {
        const ghost = document.querySelector(
          '[data-testid="k1-heat-pending"] [data-basalt-plot-ghost]',
        )
        const box = (mode: string): number =>
          document
            .querySelector(`[data-testid="k1-heat-${mode}"] [data-basalt-box]`)
            ?.getBoundingClientRect().height ?? -1
        return {
          kind: ghost?.getAttribute('data-basalt-plot-ghost') ?? null,
          rest: box('rest'),
          pending: box('pending'),
        }
      })
      expect(probe.kind).toBe('grid')
      expect(Math.abs(probe.pending - probe.rest)).toBeLessThanOrEqual(SLACK)
    })

    test(`${at}: no line of a fact period starts with a separator`, async () => {
      const p = await openFixture(SPEC, viewport)
      await p.settle()
      const probe = await p.raw.evaluate(() => {
        const fact = document.querySelector('[data-testid="k1-chart-rest"] [data-basalt-fact]')
        if (!fact) throw new Error('LAYOUT: no fact')
        const chars: { ch: string; top: number }[] = []
        const walker = document.createTreeWalker(fact, NodeFilter.SHOW_TEXT)
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const text = n.textContent ?? ''
          for (let i = 0; i < text.length; i++) {
            const range = document.createRange()
            range.setStart(n, i)
            range.setEnd(n, i + 1)
            const rect = range.getClientRects()[0]
            if (rect) chars.push({ ch: text[i] ?? '', top: rect.top })
          }
        }
        const lines = new Set(chars.map((c) => Math.round(c.top / 4)))
        const orphans = chars.flatMap((c, i) => {
          if (c.ch !== '·') return []
          const prev = chars[i - 1]
          return prev === undefined || Math.abs(prev.top - c.top) > 4 ? [i] : []
        })
        return { lines: lines.size, orphans }
      })
      expect(probe.orphans).toEqual([])
      // At 390 the period does wrap, so the test says something; at 1800 it fits one line.
      if (viewport === PHONE) expect(probe.lines).toBeGreaterThan(1)
    })

    test(`${at}: a strip verdict is a dot and a word inside its cell`, async () => {
      const p = await openFixture(SPEC, viewport)
      await p.settle()
      const probe = await p.raw.evaluate(() => {
        const cell = document.querySelector('[data-testid="k1-strip"] [data-strip-cell="fail"]')
        if (!cell) throw new Error('LAYOUT: no strip cell')
        const dot = cell.querySelector('[data-basalt-status-dot]')?.getBoundingClientRect()
        const word = cell.querySelector('[data-verdict-word]')?.getBoundingClientRect()
        const box = cell.getBoundingClientRect()
        const caption = cell.querySelector('[data-strip-caption]')?.getBoundingClientRect()
        return {
          dot: dot ? { w: dot.width, right: dot.right } : null,
          word: word ? { w: word.width, right: word.right } : null,
          cellRight: box.right,
          captionRight: caption?.right ?? -1,
          wordLeft: word?.left ?? -1,
        }
      })
      expect(probe.dot?.w).toBeGreaterThan(0)
      expect(probe.word?.w).toBeGreaterThan(0)
      expect(probe.word?.right ?? Infinity).toBeLessThanOrEqual(probe.cellRight + 0.5)
      // The verdict follows the caption, never on top of it.
      expect(probe.wordLeft).toBeGreaterThanOrEqual(probe.captionRight - 0.5)
    })

    test(`${at}: a Meter past max ends its fill at the track end under a cap, and says so`, async () => {
      const p = await openFixture(SPEC, viewport)
      await p.settle()
      const probe = await p.raw.evaluate(() => {
        const root = document.querySelector('[data-testid="k1-meter-over"]')
        const track = root?.querySelector('[data-meter-track]')?.getBoundingClientRect()
        const fill = root?.querySelector('[data-meter-fill]')?.getBoundingClientRect()
        const cap = root?.querySelector('[data-meter-tick="over"]')
        const capBox = cap?.getBoundingClientRect()
        return {
          track: track ? { left: track.left, right: track.right } : null,
          fillRight: fill?.right ?? -1,
          capRight: capBox?.right ?? -1,
          capWidth: capBox?.width ?? 0,
          capColor: cap ? getComputedStyle(cap).backgroundColor : '',
          text: root?.textContent?.replaceAll(' ', ' ') ?? '',
          rest:
            document.querySelector('[data-testid="k1-meter-in"] [data-meter-tick="over"]') !== null,
        }
      })
      expect(Math.abs(probe.fillRight - (probe.track?.right ?? 0))).toBeLessThanOrEqual(1)
      expect(probe.capWidth).toBeGreaterThanOrEqual(3)
      // The cap stands inside the track end, not past it.
      expect(probe.capRight).toBeLessThanOrEqual((probe.track?.right ?? 0) + 2.5)
      expect(probe.capColor).not.toBe('rgba(0, 0, 0, 0)')
      expect(probe.text).toContain('30 over 100')
      expect(probe.rest).toBe(false)
    })

    test(`${at}: the Meter track takes its height from the size scale; lg names a part that fits`, async () => {
      const p = await openFixture(SPEC, viewport)
      await p.settle()
      const probe = await p.raw.evaluate(() => {
        const trackH = (size: string): number =>
          document
            .querySelector(`[data-testid="k1-meter-${size}"] [data-meter-track]`)
            ?.getBoundingClientRect().height ?? -1
        const lg = document.querySelector('[data-testid="k1-meter-lg"]')
        const labels = [...(lg?.querySelectorAll('[data-meter-fill-label]') ?? [])].map((l) => {
          const fill = l.parentElement?.getBoundingClientRect()
          const box = l.getBoundingClientRect()
          return {
            text: l.textContent,
            hidden: getComputedStyle(l).visibility === 'hidden',
            inside: fill ? box.left >= fill.left - 0.5 && box.right <= fill.right + 0.5 : false,
            fits: (l as HTMLElement).scrollWidth <= (l as HTMLElement).clientWidth,
          }
        })
        return { sm: trackH('sm'), md: trackH('md'), lg: trackH('lg'), labels }
      })
      expect(probe.sm).toBeLessThan(probe.md)
      expect(probe.md).toBeLessThan(probe.lg)
      expect(probe.lg).toBeGreaterThanOrEqual(20)
      const files = probe.labels.find((l) => l.text === 'Files')
      expect(files?.hidden).toBe(false)
      expect(files?.fits).toBe(true)
      expect(files?.inside).toBe(true)
      // A label that does not fit its part is hidden, never clipped mid-word.
      for (const l of probe.labels) expect(l.hidden || l.fits).toBe(true)
    })
  }
})
