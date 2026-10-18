/**
 * StatStrip cells align by PART, not by stretching: caption, value, visual, rows and footer line up
 * across the cells of one row, a short cell's footer follows its content, and a void opens only
 * where a sibling's same part is really taller. Real geometry; happy-dom cannot see it.
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

const SNAP = 0.5
const PARTS = ['caption', 'value', 'visual', 'rows', 'footer'] as const
type Part = (typeof PARTS)[number]

type Box = { top: number; bottom: number }
type MeasuredCell = { key: string; top: number; parts: Partial<Record<Part, Box>> }
type Measured = { gap: number; cells: MeasuredCell[] }

const measure = (p: LayoutPage): Promise<Measured> =>
  p.raw.evaluate(() => {
    const host = document.querySelector<HTMLElement>('[data-testid="dash-strip-align"]')
    if (!host) throw new Error('LAYOUT: no dash-strip-align')
    const probe = document.createElement('div')
    probe.style.height = 'var(--vx-space-stack-sm)'
    host.append(probe)
    const gap = probe.getBoundingClientRect().height
    probe.remove()
    const sel: Record<string, string> = {
      caption: '[data-strip-caption]',
      value: '[data-strip-value]',
      visual: '[data-strip-visual]',
      rows: '[data-strip-rows]',
      footer: '[data-strip-footer]',
    }
    const cells = [...host.querySelectorAll<HTMLElement>('[data-strip-cell]')].map((c) => {
      const parts: Record<string, { top: number; bottom: number }> = {}
      for (const [name, q] of Object.entries(sel)) {
        const el = c.querySelector<HTMLElement>(q)
        if (!el) continue
        const b = el.getBoundingClientRect()
        parts[name] = { top: b.top, bottom: b.bottom }
      }
      return {
        key: c.getAttribute('data-strip-cell') ?? '',
        top: c.getBoundingClientRect().top,
        parts,
      }
    })
    return { gap, cells }
  })

const band = (m: Measured, cell: MeasuredCell) =>
  m.cells.filter((c) => Math.abs(c.top - cell.top) <= SNAP)

const height = (b: Box | undefined) => (b ? b.bottom - b.top : 0)

type States = {
  strip: Box & { left: number; right: number }
  cells: { key: string; left: number; right: number; top: number; bottom: number }[]
  footer: Box
}

const measureStates = (p: LayoutPage): Promise<States> =>
  p.raw.evaluate(() => {
    const host = document.querySelector<HTMLElement>('[data-testid="dash-strip-states"]')
    if (!host) throw new Error('LAYOUT: no dash-strip-states')
    const rect = (el: Element) => el.getBoundingClientRect()
    const section = host.querySelector<HTMLElement>('section')
    const foot = host.querySelector<HTMLElement>('[data-strip-footer-cell]')
    if (!section || !foot) throw new Error('LAYOUT: strip states incomplete')
    const s = rect(section)
    const f = rect(foot)
    return {
      strip: { left: s.left, right: s.right, top: s.top, bottom: s.bottom },
      cells: [...host.querySelectorAll<HTMLElement>('[data-strip-cell]')].map((c) => {
        const b = rect(c)
        return {
          key: c.getAttribute('data-strip-cell') ?? '',
          left: b.left,
          right: b.right,
          top: b.top,
          bottom: b.bottom,
        }
      }),
      footer: { top: f.top, bottom: f.bottom },
    }
  })

type Oldest = { top: number; bottom: number; contentBottom: number; padTop: number }[]

/** The S3 queue strip: a Meter cell next to sparkline siblings, one of which carries a footer. */
const measureOldest = (p: LayoutPage): Promise<Oldest> =>
  p.raw.evaluate(() => {
    const host = document.querySelector<HTMLElement>('[data-testid="dash-strip-oldest"]')
    if (!host) throw new Error('LAYOUT: no dash-strip-oldest')
    return [...host.querySelectorAll<HTMLElement>('[data-strip-cell]')].map((c) => {
      const b = c.getBoundingClientRect()
      // The last painted leaf: a part's own box stretches to its track, its content does not.
      const content = [
        ...c.querySelectorAll<HTMLElement>('[data-strip-visual] *, [data-strip-footer]'),
      ]
      return {
        top: b.top,
        bottom: b.bottom,
        contentBottom: Math.max(...content.map((e) => e.getBoundingClientRect().bottom)),
        padTop: parseFloat(getComputedStyle(c).paddingTop),
      }
    })
  })

function suite(vp: Viewport) {
  let p: LayoutPage
  let m: Measured
  beforeAll(async () => {
    p = await openFixture(SPEC, vp)
    await p.settle()
    m = await measure(p)
  }, CLOSE_BUDGET_MS)

  const cell = (key: string) => {
    const c = m.cells.find((x) => x.key === key)
    if (!c) throw new Error(`LAYOUT: no strip cell ${key}`)
    return c
  }

  test('no cell has a void beyond one row-gap, except under a taller sibling part', () => {
    for (const c of m.cells) {
      const present = PARTS.filter((n) => c.parts[n])
      for (const [i, name] of present.entries()) {
        const next = present[i + 1]
        if (!next) continue
        const gapBelow = c.parts[next]!.top - c.parts[name]!.bottom
        const slack = Math.max(
          0,
          ...band(m, c).map((s) => height(s.parts[name]) - height(c.parts[name])),
        )
        expect(gapBelow).toBeLessThanOrEqual(m.gap + slack + SNAP)
      }
    }
  })

  test('captions share one top and values one top within a row of cells', () => {
    for (const c of m.cells) {
      for (const s of band(m, c)) {
        expect(Math.abs(s.parts.caption!.top - c.parts.caption!.top)).toBeLessThanOrEqual(SNAP)
        expect(Math.abs(s.parts.value!.top - c.parts.value!.top)).toBeLessThanOrEqual(SNAP)
      }
    }
  })

  test('a footer hugs its own visual; a rows cell keeps the shared footer track', () => {
    const a = cell('tall')
    expect(a.parts.footer!.top - a.parts.visual!.bottom).toBeLessThanOrEqual(m.gap + SNAP)
    const r = cell('rows')
    expect(r.parts.footer!.top - r.parts.rows!.bottom).toBeLessThanOrEqual(m.gap + SNAP)
  })

  test('state cells and the footer row keep their bands: no overlap, footer last', async () => {
    const st = await measureStates(p)
    const last = st.cells.at(-1)!
    if (vp.width < 480) {
      // Two columns: the odd fifth cell spans the full strip width.
      expect(Math.abs(last.left - st.strip.left)).toBeLessThanOrEqual(SNAP + 1)
      expect(Math.abs(last.right - st.strip.right)).toBeLessThanOrEqual(SNAP)
    }
    const bands = [...new Set(st.cells.map((c) => Math.round(c.top)))].toSorted((a, b) => a - b)
    for (const [i, top] of bands.entries()) {
      const next = bands[i + 1]
      if (next === undefined) continue
      const bottom = Math.max(
        ...st.cells.filter((c) => Math.round(c.top) === top).map((c) => c.bottom),
      )
      expect(bottom).toBeLessThanOrEqual(next + SNAP)
    }
    expect(st.footer.top).toBeGreaterThanOrEqual(Math.max(...st.cells.map((c) => c.bottom)) - SNAP)
  })

  test('the oldest-wait Meter cell is under 40 % void next to sparkline siblings', async () => {
    const cells = await measureOldest(p)
    const c = cells[2]!
    const void_ = (c.bottom - c.contentBottom) / (c.bottom - c.top)
    expect(void_).toBeLessThan(0.4)
  })

  test('every strip cell has the same on-scale top inset', async () => {
    const cells = await measureOldest(p)
    const step = await p.raw.evaluate(() => {
      const probe = document.createElement('div')
      probe.style.height = 'var(--vx-space-stack-md)'
      document.body.append(probe)
      const h = probe.getBoundingClientRect().height
      probe.remove()
      return h
    })
    for (const c of cells) expect(Math.abs(c.padTop - step)).toBeLessThanOrEqual(0.01)
  })

  test('a value-only cell’s footer sits directly under its value', () => {
    const c = cell('short')
    expect(c.parts.footer!.top - c.parts.value!.bottom).toBeLessThanOrEqual(m.gap + SNAP)
  })
}

layout('StatStrip part alignment', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)
  for (const vp of [DESKTOP_1440, PHONE]) describe(`at ${vp.width}px`, () => suite(vp))
})
