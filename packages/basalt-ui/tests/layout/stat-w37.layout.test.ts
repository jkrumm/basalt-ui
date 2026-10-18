/**
 * Wave 37 r2: StatCard keeps its caption at 390, strip cells end at their content, strip state copy
 * keeps the cell inset, a strip footer entry sits under the cell it qualifies. Real geometry.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage, Viewport } from './harness'
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

const SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  dash: true,
}

const SNAP = 1
const EMPTY_LIMIT = 0.15

type Caption = {
  title: string
  truncated: boolean
  qualifierTop: number | null
  captionBottom: number
  valueBottom: number
  row: number
}

const measureCaptions = (p: LayoutPage): Promise<Caption[]> =>
  p.raw.evaluate(() => {
    const host = document.querySelector<HTMLElement>('[data-testid="dash-stat-caption"]')
    if (!host) throw new Error('LAYOUT: no dash-stat-caption')
    return [...host.querySelectorAll<HTMLElement>('.mantine-Card-root')].map((c) => {
      const text = c.querySelector<HTMLElement>('[data-widget-title]')!
      const q = c.querySelector<HTMLElement>('[class*="qualifier_"]')
      const v = c.querySelector<HTMLElement>('[class*="value_"]')!
      return {
        title: text.textContent ?? '',
        truncated: text.scrollWidth > text.clientWidth,
        qualifierTop: q ? q.getBoundingClientRect().top : null,
        captionBottom: text.getBoundingClientRect().bottom,
        valueBottom: v.getBoundingClientRect().bottom,
        row: Math.round(c.getBoundingClientRect().top),
      }
    })
  })

type Strip = {
  key: string
  top: number
  bottom: number
  /** The shot reviewer's emptyRatio: the largest vertical run with nothing painted in the box. */
  emptyRatio: number
  /** Space between the last painted leaf and the box's bottom edge. */
  bottomInset: number
  padTop: number
  left: number
}

const measureStrips = (p: LayoutPage, testId: string): Promise<Strip[]> =>
  p.raw.evaluate((id) => {
    const host = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    if (!host) throw new Error(`LAYOUT: no ${id}`)
    const range = document.createRange()
    return [...host.querySelectorAll<HTMLElement>('[data-strip-cell]')].map((c) => {
      const rect = c.getBoundingClientRect()
      const painted: [number, number][] = []
      for (const el of c.querySelectorAll<HTMLElement>('*')) {
        const s = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        if (r.height === 0) continue
        if (/^(svg|img|canvas)$/i.test(el.tagName)) painted.push([r.top, r.bottom])
        const hasBg =
          s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent'
        if (hasBg && r.height < rect.height * 0.9 && !(el.parentElement instanceof SVGElement))
          painted.push([r.top, r.bottom])
        for (const n of el.childNodes) {
          if (n.nodeType !== Node.TEXT_NODE || !n.textContent?.trim()) continue
          range.selectNodeContents(n)
          const tr = range.getBoundingClientRect()
          painted.push([tr.top, tr.bottom])
        }
      }
      let cursor = rect.top
      let longest = 0
      for (const [a, b] of painted.toSorted((x, y) => x[0] - y[0])) {
        longest = Math.max(longest, Math.min(a, rect.bottom) - cursor)
        cursor = Math.max(cursor, Math.min(b, rect.bottom))
      }
      longest = Math.max(longest, rect.bottom - cursor)
      return {
        key: c.getAttribute('data-strip-cell') ?? '',
        top: rect.top,
        bottom: rect.bottom,
        emptyRatio: longest / rect.height,
        bottomInset: rect.bottom - cursor,
        padTop: parseFloat(getComputedStyle(c).paddingTop),
        left: rect.left,
      }
    })
  }, testId)

function suite(vp: Viewport) {
  let p: LayoutPage
  beforeAll(async () => {
    p = await openFixture(SPEC, vp)
    await p.settle()
  }, CLOSE_BUDGET_MS)

  if (vp.width < 480) {
    test('a card keeps its caption whole: the qualifier drops to its own line and values share a baseline', async () => {
      const cards = await measureCaptions(p)
      expect(cards.length).toBe(4)
      for (const c of cards) {
        expect(c.truncated).toBe(false)
        if (c.qualifierTop !== null)
          expect(c.qualifierTop).toBeGreaterThanOrEqual(c.captionBottom - SNAP)
      }
      for (const a of cards)
        for (const b of cards.filter((o) => o.row === a.row))
          expect(Math.abs(a.valueBottom - b.valueBottom)).toBeLessThanOrEqual(SNAP)
    })
  }

  test('a value-only cell and a visual cell beside an equal one end at their content: emptyRatio < 0.15', async () => {
    const cells = await measureStrips(p, 'dash-strip-compact')
    for (const c of cells.filter((x) => x.key !== 'tallrows')) {
      if (c.emptyRatio >= EMPTY_LIMIT)
        throw new Error(`LAYOUT: ${c.key} emptyRatio ${c.emptyRatio.toFixed(3)}`)
    }
  })

  test('a short-visual cell ends at its content beside a taller visual sibling', async () => {
    const cells = await measureStrips(p, 'dash-strip-stretch')
    expect(cells.length).toBe(4)
    for (const c of cells)
      if (c.emptyRatio >= EMPTY_LIMIT)
        throw new Error(`LAYOUT: ${c.key} emptyRatio ${c.emptyRatio.toFixed(3)}`)
  })

  test('values share one baseline within a row of strip cells', async () => {
    const r = await p.raw.evaluate(() => {
      const host = document.querySelector<HTMLElement>('[data-testid="dash-strip-stretch"]')!
      return [...host.querySelectorAll<HTMLElement>('[data-strip-cell]')].map((c) => ({
        row: Math.round(c.closest<HTMLElement>('[data-strip-slot]')!.getBoundingClientRect().top),
        caption: c.querySelector<HTMLElement>('[data-strip-caption]')!.getBoundingClientRect().top,
        value: c.querySelector<HTMLElement>('[data-strip-value]')!.getBoundingClientRect().bottom,
      }))
    })
    for (const a of r)
      for (const b of r.filter((o) => o.row === a.row)) {
        expect(Math.abs(a.caption - b.caption)).toBeLessThanOrEqual(1)
        expect(Math.abs(a.value - b.value)).toBeLessThanOrEqual(1)
      }
  })

  test('empty and error copy keep the cell inset below', async () => {
    const cells = await measureStrips(p, 'dash-strip-empty')
    expect(cells.length).toBe(4)
    for (const c of cells) expect(c.bottomInset).toBeGreaterThanOrEqual(c.padTop - 0.5)
  })

  if (vp.width >= 800) {
    test('a footer entry with `under` starts at its cell’s left edge', async () => {
      const r = await p.raw.evaluate(() => {
        const host = document.querySelector<HTMLElement>('[data-testid="dash-strip-under"]')!
        const cell = host.querySelector<HTMLElement>('[data-strip-slot]:nth-child(4)')!
        const f = host.querySelector<HTMLElement>('[data-strip-footer-cell="week"]')!
        return { cell: cell.getBoundingClientRect(), foot: f.getBoundingClientRect() }
      })
      expect(Math.abs(r.foot.left - r.cell.left)).toBeLessThanOrEqual(SNAP)
      expect(r.foot.right).toBeLessThanOrEqual(r.cell.right + SNAP)
    })
  } else {
    test('a footer entry with `under` stays full width under the grid at 390', async () => {
      const r = await p.raw.evaluate(() => {
        const host = document.querySelector<HTMLElement>('[data-testid="dash-strip-under"]')!
        const sec = host.querySelector<HTMLElement>('section')!.getBoundingClientRect()
        const f = host.querySelector<HTMLElement>('[data-strip-footer-cell="week"]')!
        return { sec, foot: f.getBoundingClientRect() }
      })
      expect(Math.abs(r.foot.left - r.sec.left)).toBeLessThanOrEqual(SNAP)
      expect(Math.abs(r.foot.right - r.sec.right)).toBeLessThanOrEqual(SNAP)
    })
  }
}

layout('Wave 37 r2 stat card and strip', () => {
  for (const vp of [DESKTOP_1440, PHONE]) describe(`at ${vp.width}px`, () => suite(vp))
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)
})
