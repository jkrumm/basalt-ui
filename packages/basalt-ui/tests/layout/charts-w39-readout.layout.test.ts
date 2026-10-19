/**
 * Wave 39, tooltips and readouts stay inside their card: a tooltip taller than the room above its
 * anchor flips or slides and stays inside the card on both axes (only one taller than the card
 * itself overflows, aligned to its top); labels wrap between words, never inside `(…)` or `x/y`; a
 * slotted `Bars` readout never crosses its strip cell; a short bare `Sparkline` keeps the one-line
 * readout and never draws it over the plotted line.
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
  w39Readout: true,
}

const AIR = 3.5

/** The page is taller than the viewport: bring the case into view before hovering it. */
const scrollTo = (p: Awaited<ReturnType<typeof openFixture>>, sel: string): Promise<void> =>
  p.raw.evaluate((q) => document.querySelector(q)?.scrollIntoView({ block: 'center' }), sel)

layout('Wave 39 tooltips and readouts inside the card', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each([
    ['1440 card', DESKTOP_1440, 'w39-tip', false],
    ['390 card', PHONE, 'w39-tip', false],
    ['1440 taller than the card', DESKTOP_1440, 'w39-tip-tall', true],
    ['390 taller than the card', PHONE, 'w39-tip-tall', true],
  ] as const)(
    '%s: the tooltip stays inside the card on both axes (taller than it: aligned to its top)',
    async (_, viewport, id, tallerThanCard) => {
      const p = await openFixture(spec, viewport)
      await p.settle()
      await scrollTo(p, `[data-testid="${id}"]`)
      for (const f of [0.08, 0.35, 0.65, 0.92]) {
        const svg = await p.raw.evaluate((q) => {
          const r = document
            .querySelector(`[data-testid="${q}"] [data-basalt-box] svg`)
            ?.getBoundingClientRect()
          if (!r) throw new Error('LAYOUT: no chart svg')
          return { x: r.x, y: r.y, w: r.width, h: r.height }
        }, id)
        await p.raw.mouse.move(svg.x + svg.w / 2, svg.y + svg.h / 2)
        await p.raw.mouse.move(svg.x + svg.w * f, svg.y + svg.h - 2)
        await p.raw.waitForSelector('.ts-chart-tooltip:not([hidden])')
        const m = await p.raw.evaluate((q) => {
          const tip = document.querySelector('.ts-chart-tooltip:not([hidden])')
          const card = document.querySelector(`[data-testid="${q}"] [data-basalt-chart-card]`)
          const heading = document.querySelector(`[data-testid="${q}-heading"]`)
          if (!tip || !card || !heading) throw new Error('LAYOUT: no tooltip, card or heading')
          const t = tip.getBoundingClientRect()
          const c = card.getBoundingClientRect()
          const h = heading.getBoundingClientRect()
          // A label breaks only between words: every whitespace-free token sits on one line.
          const split: string[] = []
          for (const span of tip.querySelectorAll<HTMLElement>(
            '.ts-chart-tooltip__row > span:nth-child(2)',
          )) {
            const node = span.firstChild
            if (!node || node.nodeType !== Node.TEXT_NODE) continue
            const text = node.textContent ?? ''
            for (const token of text.matchAll(/\S+/g)) {
              const tops = new Set<number>()
              for (let i = token.index; i < token.index + token[0].length; i += 1) {
                const range = document.createRange()
                range.setStart(node, i)
                range.setEnd(node, i + 1)
                tops.add(Math.round(range.getBoundingClientRect().top))
              }
              if (tops.size > 1) split.push(token[0])
            }
          }
          return {
            top: t.top - c.top,
            bottom: c.bottom - t.bottom,
            left: t.left - c.left,
            right: c.right - t.right,
            tall: t.height + 8 > c.height,
            overHeading: t.top < h.bottom && t.bottom > h.top,
            split,
          }
        }, id)
        expect(m.split).toEqual([])
        expect(m.overHeading).toBe(false)
        expect(m.left).toBeGreaterThanOrEqual(AIR - 1)
        expect(m.right).toBeGreaterThanOrEqual(AIR - 1)
        expect(m.tall).toBe(tallerThanCard)
        if (m.tall) expect(Math.abs(m.top - 4)).toBeLessThanOrEqual(1)
        else {
          expect(m.top).toBeGreaterThanOrEqual(AIR - 1)
          expect(m.bottom).toBeGreaterThanOrEqual(AIR - 1)
        }
      }
    },
  )

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)(
    "%s: the slotted Bars tooltip is the one-line chip in the cell's reserved line, clear of the caption, value and plot",
    async (_, viewport) => {
      const p = await openFixture(spec, viewport)
      await p.settle()
      await scrollTo(p, '[data-testid="w39-strip"]')
      // Six bins: 0 Mon, 1 Tue (empty), 2 the long label, 5 Sat.
      for (const bin of [0, 1, 2, 5]) {
        const svg = await p.raw.evaluate(() => {
          const r = document
            .querySelector('[data-testid="w39-strip"] [data-strip-cell] svg')
            ?.getBoundingClientRect()
          if (!r) throw new Error('LAYOUT: no strip bars')
          return { x: r.x, y: r.y, w: r.width, h: r.height }
        })
        await p.raw.mouse.move(svg.x + svg.w / 2, svg.y + svg.h / 2)
        await p.raw.mouse.move(svg.x + (svg.w * (bin + 0.5)) / 6, svg.y + svg.h / 2)
        await p.raw.waitForSelector('.ts-chart-tooltip[data-basalt-slot]:not([hidden])')
        const m = await p.raw.evaluate(() => {
          const cell = document.querySelector('[data-testid="w39-strip"] [data-strip-cell]')
          const chip = document.querySelector('.ts-chart-tooltip[data-basalt-slot]:not([hidden])')
          const plot = cell?.querySelector('svg')
          if (!cell || !chip || !plot) throw new Error('LAYOUT: no cell, readout or plot')
          const [c, t, v] = [cell, chip, plot].map((el) => el.getBoundingClientRect()) as [
            DOMRect,
            DOMRect,
            DOMRect,
          ]
          const hits = (sel: string): boolean => {
            const el = cell.querySelector(sel)?.getBoundingClientRect()
            if (!el) throw new Error(`LAYOUT: no ${sel}`)
            return t.left < el.right && t.right > el.left && t.top < el.bottom && t.bottom > el.top
          }
          const title = chip.querySelector<HTMLElement>('.ts-chart-tooltip__title')
          const lit = [...plot.querySelectorAll('circle')].filter(
            (el) => Number.parseFloat(getComputedStyle(el).fillOpacity) === 1,
          ).length
          return {
            separator: title ? getComputedStyle(title, '::before').content : '',
            inCell:
              t.top >= c.top - 0.5 &&
              t.bottom <= c.bottom + 0.5 &&
              t.left >= c.left - 0.5 &&
              t.right <= c.right + 0.5,
            overPlot:
              t.bottom > v.top + 0.5 && t.top < v.bottom && t.right > v.left && t.left < v.right,
            overCaption: hits('[data-strip-caption]'),
            overValue: hits('[data-strip-value]'),
            oneLine: t.height < 24,
            rowsShown: [...chip.querySelectorAll<HTMLElement>('.ts-chart-tooltip__row')].filter(
              (r) => getComputedStyle(r).display !== 'none',
            ).length,
            clipped: !!title && title.scrollWidth > title.clientWidth,
            lit,
          }
        })
        expect(m.separator).toContain('·')
        expect(m.oneLine).toBe(true)
        expect(m.rowsShown).toBe(1)
        expect(m.inCell).toBe(true)
        expect(m.overPlot).toBe(false)
        expect(m.overCaption).toBe(false)
        expect(m.overValue).toBe(false)
        // The empty bin has no bar to light: the baseline marker says where the readout points.
        expect(m.lit).toBe(bin === 1 ? 1 : 0)
        if (bin === 2 && viewport === PHONE) expect(m.clipped).toBe(true)
        if (bin !== 2) expect(m.clipped).toBe(false)
      }
    },
  )

  test('the slotted Bars chip is not displayed once the pointer leaves', async () => {
    const p = await openFixture(spec, DESKTOP_1440)
    await p.settle()
    await scrollTo(p, '[data-testid="w39-strip"]')
    const svg = await p.raw.evaluate(() => {
      const r = document
        .querySelector('[data-testid="w39-strip"] [data-strip-cell] svg')
        ?.getBoundingClientRect()
      if (!r) throw new Error('LAYOUT: no strip bars')
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    })
    const shown = (): Promise<string[]> =>
      p.raw.evaluate(() =>
        [...document.querySelectorAll('.ts-chart-tooltip[data-basalt-slot]')].map(
          (el) => getComputedStyle(el).display,
        ),
      )
    await p.raw.mouse.move(svg.x + svg.w / 2, svg.y + svg.h / 2)
    await p.raw.mouse.move(svg.x + svg.w * 0.3, svg.y + svg.h / 2)
    await p.raw.waitForSelector('.ts-chart-tooltip[data-basalt-slot]:not([hidden])')
    expect(await shown()).toContain('flex')
    await p.raw.mouse.move(5, 5)
    await p.raw.waitForFunction(() =>
      [...document.querySelectorAll('.ts-chart-tooltip[data-basalt-slot]')].every(
        (el) => getComputedStyle(el).display === 'none',
      ),
    )
    expect(await shown()).not.toContain('flex')
  })

  test('1440: a tooltip whose first side has no room flips, and one that fits stays', async () => {
    const p = await openFixture(spec, DESKTOP_1440)
    await p.settle()
    const placed = async (id: string, f: number): Promise<string | undefined> => {
      await scrollTo(p, `[data-testid="${id}"]`)
      const svg = await p.raw.evaluate((q) => {
        const r = document
          .querySelector(`[data-testid="${q}"] [data-basalt-box] svg`)
          ?.getBoundingClientRect()
        if (!r) throw new Error('LAYOUT: no chart svg')
        return { x: r.x, y: r.y, w: r.width, h: r.height }
      }, id)
      await p.raw.mouse.move(svg.x + svg.w / 2, svg.y + svg.h / 2)
      await p.raw.mouse.move(svg.x + svg.w * f, svg.y + svg.h - 2)
      await p.raw.waitForSelector('.ts-chart-tooltip:not([hidden])')
      return p.raw.evaluate(
        () =>
          document.querySelector<HTMLElement>('.ts-chart-tooltip:not([hidden])')?.dataset[
            'placement'
          ],
      )
    }
    // Wed, a short bar in a tall chart: the room above its anchor fits the tooltip, it stays on top.
    expect(await placed('w39-tip-room', 2.5 / 7)).toBe('top')
    // Sat, the tallest bar: its anchor sits under the card's header, nothing above fits (the tooltip
    // rows are all hidden from the bar anchor's estimate), the room below does: it flips.
    expect(await placed('w39-tip-room', 5.5 / 7)).toBe('bottom')
  })

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)(
    '%s: a 28px bare Sparkline keeps the one-line readout inside its box, in the band away from the line',
    async (_, viewport) => {
      const p = await openFixture(spec, viewport)
      await p.settle()
      await scrollTo(p, '[data-testid="w39-spark"]')
      const box = await p.raw.evaluate(() => {
        const r = document
          .querySelector('[data-testid="w39-spark"] [data-basalt-sparkline]')
          ?.getBoundingClientRect()
        if (!r) throw new Error('LAYOUT: no sparkline')
        return { x: r.x, y: r.y, w: r.width, h: r.height }
      })
      // The last point drops to the box floor; hovers before it keep the chip clear of that drop.
      for (const f of [0.05, 0.1, 0.15]) {
        await p.raw.mouse.move(box.x + box.w * 0.5, box.y + box.h / 2)
        await p.raw.mouse.move(box.x + box.w * f, box.y + box.h / 2)
        const m = await p.raw.evaluate(() => {
          const root = document.querySelector('[data-testid="w39-spark"] [data-basalt-sparkline]')
          const chip = root?.querySelector('[data-basalt-sparkline-readout]')
          if (!root || !chip) throw new Error('LAYOUT: no readout')
          const r = chip.getBoundingClientRect()
          const box = root.getBoundingClientRect()
          const hitsText = ['w39-above', 'w39-below'].some((id) => {
            const t = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect()
            return (
              !!t && r.top < t.bottom && r.bottom > t.top && r.left < t.right && r.right > t.left
            )
          })
          return {
            text: chip.textContent ?? '',
            stacked: chip.hasAttribute('data-stacked'),
            inBox:
              r.left >= box.left - 0.5 &&
              r.right <= box.right + 0.5 &&
              r.top >= box.top - 0.5 &&
              r.bottom <= box.bottom + 0.5,
            onText: hitsText,
            // The line rides the box's top: the farthest in-box band is the bottom one.
            bottomBand: Math.abs(r.bottom - (box.bottom - 3)) <= 1,
            coversDot: (() => {
              const d = root.querySelector('[data-basalt-sparkline-dot]')?.getBoundingClientRect()
              return (
                !!d && r.left < d.right && r.right > d.left && r.top < d.bottom && r.bottom > d.top
              )
            })(),
          }
        })
        expect(m.text).toContain(' bpm · ')
        expect(m.stacked).toBe(false)
        expect(m.inBox).toBe(true)
        expect(m.onText).toBe(false)
        expect(m.bottomBand).toBe(true)
        expect(m.coversDot).toBe(false)
      }
    },
  )
})
