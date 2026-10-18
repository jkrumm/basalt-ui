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
  qualifierLines: number
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
        qualifierLines: q
          ? q.getBoundingClientRect().height / parseFloat(getComputedStyle(q).lineHeight)
          : 0,
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
    test('a card keeps its caption whole and values share a baseline (the qualifier sits beside it or under it, Wave 38)', async () => {
      const cards = await measureCaptions(p)
      expect(cards.length).toBe(4)
      for (const c of cards) {
        expect(c.truncated).toBe(false)
      }
      // Values share a baseline while every qualifier of the row is one line; a qualifier that wraps
      // (it never truncates) pushes its own value down by the extra lines only.
      for (const a of cards)
        for (const b of cards.filter((o) => o.row === a.row)) {
          const extra = Math.abs(Math.round(a.qualifierLines) - Math.round(b.qualifierLines))
          expect(Math.abs(a.valueBottom - b.valueBottom)).toBeLessThanOrEqual(SNAP + extra * 16)
        }
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

  test('a footer entry with `under` rides inside its cell at every width (Wave 38)', async () => {
    const r = await p.raw.evaluate(() => {
      const host = document.querySelector<HTMLElement>('[data-testid="dash-strip-under"]')!
      const f = host.querySelector<HTMLElement>('[data-strip-footer-cell="week"]')!
      const slot = f.closest<HTMLElement>('[data-strip-slot]')!
      const article = slot.querySelector<HTMLElement>('[data-strip-cell]')!
      return {
        slot: slot.getBoundingClientRect(),
        article: article.getBoundingClientRect(),
        foot: f.getBoundingClientRect(),
      }
    })
    expect(r.foot.left).toBeGreaterThanOrEqual(r.slot.left - SNAP)
    expect(r.foot.right).toBeLessThanOrEqual(r.slot.right + SNAP)
    expect(r.foot.top).toBeGreaterThanOrEqual(r.article.bottom - SNAP)
    expect(r.foot.bottom).toBeLessThanOrEqual(r.slot.bottom + SNAP)
  })
  if (vp.width < 480) {
    test('an odd count folds to a full-width last cell, never an orphan (Wave 38)', async () => {
      const r = await p.raw.evaluate(() => {
        const last = (id: string, sel: string) => {
          const host = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
          const kids = [...host.querySelectorAll<HTMLElement>(sel)]
          return {
            last: kids.at(-1)!.getBoundingClientRect(),
            host: host.getBoundingClientRect(),
            top: kids[0]!.getBoundingClientRect().top,
          }
        }
        return {
          strip: last('dash-odd-strip', '[data-strip-slot]'),
          group: last('dash-odd-group', ':scope > div > div > *'),
        }
      })
      for (const k of [r.strip, r.group]) {
        expect(k.last.top).toBeGreaterThan(k.top + SNAP)
        expect(k.last.width).toBeGreaterThan(k.host.width * 0.9)
      }
    })
  }

  test('a delta column keeps glyph and figure one unit (Wave 38)', async () => {
    const r = await p.raw.evaluate(() => {
      const host = document.querySelector<HTMLElement>('[data-testid="dash-delta-col"]')!
      return [...host.querySelectorAll<HTMLElement>('[data-delta]')].map((d) => {
        const g = d.querySelector('[data-delta-glyph]')!.getBoundingClientRect()
        const b = d.getBoundingClientRect()
        return { gap: b.right - g.right, right: b.right, glyphLeft: g.left, left: b.left }
      })
    })
    expect(r.length).toBe(2)
    // The glyph leads its badge (no empty slot before it) and the right edges are shared.
    for (const d of r) expect(d.glyphLeft - d.left).toBeLessThanOrEqual(SNAP)
    // The column is end-aligned from the wide layout; the compact one stacks start-aligned.
    if (vp.width >= 480) expect(Math.abs(r[0]!.right - r[1]!.right)).toBeLessThanOrEqual(SNAP)
  })
  test('a qualifier never truncates: a long one wraps under the caption; a short one stays beside it in a strip cell and goes under it in a narrow card, so card siblings agree (Wave 38)', async () => {
    const r = await p.raw.evaluate(() => {
      const one = (host: string, rootSel: string, i: number) => {
        const root = document.querySelectorAll<HTMLElement>(`[data-testid="${host}"] ${rootSel}`)[
          i
        ]!
        const q = root.querySelector<HTMLElement>('[class*="qualifier_"]')!
        const cap = root.querySelector<HTMLElement>('[data-widget-title], [data-strip-caption]')!
        const qb = q.getBoundingClientRect()
        const cb = cap.getBoundingClientRect()
        const lh = parseFloat(getComputedStyle(q).lineHeight)
        return {
          clipped: q.scrollWidth > q.clientWidth + 1,
          ellipsis: getComputedStyle(q).textOverflow === 'ellipsis',
          lines: qb.height / lh,
          under: qb.top >= cb.bottom - 1,
          width: root.getBoundingClientRect().width,
        }
      }
      return {
        cardLong: one('dash-qual-card', '.mantine-Card-root', 0),
        cardShort: one('dash-qual-card', '.mantine-Card-root', 1),
        stripLong: one('dash-qual-strip', '[data-strip-cell]', 0),
        stripShort: one('dash-qual-strip', '[data-strip-cell]', 1),
      }
    })
    for (const k of [r.cardLong, r.stripLong]) {
      expect(k.clipped).toBe(false)
      expect(k.ellipsis).toBe(false)
      expect(k.under).toBe(true)
      expect(k.lines).toBeGreaterThan(1.5)
    }
    expect(r.cardShort.under).toBe(true)
    expect(r.stripShort.under).toBe(false)
  })
  test('a ~300px strip cell wraps a long qualifier whole and only its own value moves (Wave 38)', async () => {
    const r = await p.raw.evaluate(() => {
      const cells = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="dash-qual-strip-300"] [data-strip-cell]',
        ),
      ]
      const q = cells[0]!.querySelector<HTMLElement>('[class*="qualifier_"]')!
      const cap = cells[0]!.querySelector<HTMLElement>('[data-strip-caption]')!
      const top = (c: HTMLElement) =>
        c.querySelector<HTMLElement>('[data-strip-value]')!.getBoundingClientRect().top
      return {
        width: cells[0]!.getBoundingClientRect().width,
        clipped: q.scrollWidth > q.clientWidth + 1,
        ellipsis: getComputedStyle(q).textOverflow === 'ellipsis',
        lines: q.getBoundingClientRect().height / parseFloat(getComputedStyle(q).lineHeight),
        under: q.getBoundingClientRect().top >= cap.getBoundingClientRect().bottom - 1,
        dy: top(cells[0]!) - top(cells[1]!),
      }
    })
    expect(r.width).toBeGreaterThan(240)
    expect(r.clipped).toBe(false)
    expect(r.ellipsis).toBe(false)
    expect(r.under).toBe(true)
    expect(r.lines).toBeGreaterThan(1.5)
    // The wrapped cell's value sits lower by the extra lines; the short qualifier's cell does not move.
    expect(r.dy).toBeGreaterThan(SNAP)
  })
}

layout('Wave 37 r2 stat card and strip', () => {
  for (const vp of [DESKTOP_1440, PHONE]) describe(`at ${vp.width}px`, () => suite(vp))
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)
})
