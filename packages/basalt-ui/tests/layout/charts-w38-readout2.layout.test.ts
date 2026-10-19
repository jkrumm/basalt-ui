/**
 * Wave 38, hosted readouts and tooltips: a Sparkline readout keeps its " · " separator at every
 * width and never covers the plotted line; a slotted `Bars` tooltip and the readout chip are opaque
 * in both schemes; a chart tooltip at the first and last point stays inside its card, and no figure
 * in a row ends in an ellipsis.
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

const SECTIONS: FixtureSpec['sections'] = [
  { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
]
const spec: FixtureSpec = { sections: SECTIONS, w38Readout2: true }
const dark: FixtureSpec = { ...spec, colorScheme: 'dark' }

layout('Wave 38 hosted readouts and tooltips', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each(['strip', 'card'] as const)(
    '%s: the readout keeps " · " and clears the plotted line at every pointer position',
    async (host) => {
      const p = await openFixture(spec, DESKTOP_1440)
      await p.settle()
      const box = await p.raw.evaluate((id) => {
        const r = document
          .querySelector(`[data-testid="${id}"] [data-basalt-sparkline]`)
          ?.getBoundingClientRect()
        if (!r) throw new Error('LAYOUT: no sparkline')
        return { x: r.x, y: r.y, w: r.width, h: r.height }
      }, `w38r2-${host}`)
      let stacked = false
      for (const f of [0.02, 0.25, 0.5, 0.75, 0.98]) {
        await p.raw.mouse.move(box.x + box.w * 0.5, box.y + box.h / 2)
        await p.raw.mouse.move(box.x + box.w * f, box.y + box.h / 2)
        const m = await p.raw.evaluate((id) => {
          const root = document.querySelector(`[data-testid="${id}"] [data-basalt-sparkline]`)
          const chip = root?.querySelector('[data-basalt-sparkline-readout]')
          if (!root || !chip) throw new Error('LAYOUT: no readout')
          const r = chip.getBoundingClientRect()
          const pad = 2
          let hits = 0
          for (const path of root.querySelectorAll<SVGPathElement>('svg path')) {
            const stroke = getComputedStyle(path).stroke
            const matrix = path.getScreenCTM()
            if (stroke === 'none' || !matrix || path.getAttribute('d') === null) continue
            const len = path.getTotalLength()
            for (let at = 0; at <= len; at += 1) {
              const pt = path.getPointAtLength(at).matrixTransform(matrix)
              if (
                pt.x > r.left - pad &&
                pt.x < r.right + pad &&
                pt.y > r.top - pad &&
                pt.y < r.bottom + pad
              )
                hits += 1
            }
          }
          const sep = chip.querySelector<HTMLElement>('span span')
          const sepStyle = sep ? getComputedStyle(sep) : null
          return {
            text: chip.textContent ?? '',
            hits,
            stacked: chip.hasAttribute('data-stacked'),
            // The separator keeps its air: no negative letter or word spacing, and a real width.
            sepWidth: sep?.getBoundingClientRect().width ?? 0,
            sepSpacing: [sepStyle?.letterSpacing, sepStyle?.wordSpacing],
          }
        }, `w38r2-${host}`)
        expect(m.text).toContain(' · ')
        expect(m.hits).toBe(0)
        if (!m.stacked) {
          expect(
            m.sepSpacing.every((v) => v === 'normal' || Number.parseFloat(v ?? '0') >= 0),
          ).toBe(true)
          expect(m.sepWidth).toBeGreaterThan(5)
        }
        stacked ||= m.stacked
      }
      // The card's long date forces the stacked chip: the path under test ran.
      if (host === 'card') expect(stacked).toBe(true)
    },
  )

  test.each([
    ['light', spec],
    ['dark', dark],
  ] as const)('%s: the readout chip and the slotted Bars tooltip are opaque', async (_, s) => {
    const p = await openFixture(s, DESKTOP_1440)
    await p.settle()
    const hover = async (sel: string): Promise<void> => {
      const r = await p.raw.evaluate((q) => {
        const b = document.querySelector(q)?.getBoundingClientRect()
        if (!b) throw new Error(`LAYOUT: no ${q}`)
        return { x: b.x, y: b.y, w: b.width, h: b.height }
      }, sel)
      await p.raw.mouse.move(r.x + r.w * 0.4, r.y + r.h / 2)
      await p.raw.mouse.move(r.x + r.w * 0.45, r.y + r.h / 2)
    }
    const alpha = (sel: string): Promise<number> =>
      p.raw.evaluate((q) => {
        const el = document.querySelector(q)
        if (!el) throw new Error(`LAYOUT: no ${q}`)
        const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(el).backgroundColor)
        const parts = m?.[1]?.split(/[ ,/]+/).filter(Boolean) ?? []
        return parts.length > 3 ? Number(parts[3]) : 1
      }, sel)
    await hover('[data-testid="w38r2-card"] [data-basalt-sparkline]')
    expect(await alpha('[data-basalt-sparkline-readout]')).toBe(1)
    await hover('[data-testid="w38r2-bars"] svg')
    await p.raw.waitForSelector('.ts-chart-tooltip:not([hidden])')
    expect(await alpha('.ts-chart-tooltip:not([hidden])')).toBe(1)
  })

  test.each([
    ['390', PHONE, 'w38r2-lines-narrow'],
    ['1440', DESKTOP_1440, 'w38r2-lines-narrow'],
    ['1440 wide', DESKTOP_1440, 'w38r2-lines-wide'],
  ] as const)(
    '%s %s: the tooltip at the first and last point stays in its card and no figure is cut',
    async (_, viewport, id) => {
      const p = await openFixture(spec, viewport)
      await p.settle()
      for (const end of ['first', 'last'] as const) {
        const svg = await p.raw.evaluate((q) => {
          const b = document.querySelector(`[data-testid="${q}"] [data-basalt-box] svg`)
          const r = b?.getBoundingClientRect()
          if (!r) throw new Error('LAYOUT: no chart svg')
          return { x: r.x, y: r.y, w: r.width, h: r.height }
        }, id)
        await p.raw.mouse.move(svg.x + svg.w / 2, svg.y + svg.h / 2)
        await p.raw.mouse.move(end === 'first' ? svg.x + 2 : svg.x + svg.w - 2, svg.y + svg.h / 2)
        await p.raw.waitForSelector('.ts-chart-tooltip:not([hidden])')
        const m = await p.raw.evaluate((q) => {
          const tip = document.querySelector('.ts-chart-tooltip:not([hidden])')
          const card = document.querySelector(`[data-testid="${q}"] [data-basalt-chart-card]`)
          if (!tip || !card) throw new Error('LAYOUT: no tooltip or card')
          const t = tip.getBoundingClientRect()
          const c = card.getBoundingClientRect()
          const cells = [...tip.querySelectorAll<HTMLElement>('.ts-chart-tooltip__row > span')]
          return {
            left: t.left - c.left,
            right: c.right - t.right,
            cut: cells.some((s) => s.scrollWidth > s.clientWidth + 0.5),
            ellipsis: (tip.textContent ?? '').includes('…'),
            rows: cells.length,
          }
        }, id)
        expect(m.rows).toBeGreaterThan(0)
        expect(m.left).toBeGreaterThanOrEqual(-0.5)
        expect(m.right).toBeGreaterThanOrEqual(-0.5)
        expect(m.cut).toBe(false)
        expect(m.ellipsis).toBe(false)
      }
    },
  )
})
