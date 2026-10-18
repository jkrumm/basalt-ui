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

const SNAP = 1
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
        const void_ = c.parts[next]!.top - c.parts[name]!.bottom
        const slack = Math.max(
          0,
          ...band(m, c).map((s) => height(s.parts[name]) - height(c.parts[name])),
        )
        expect(void_).toBeLessThanOrEqual(m.gap + slack + SNAP)
      }
    }
  })

  test('captions share one top and values one baseline within a row of cells', () => {
    for (const c of m.cells) {
      for (const s of band(m, c)) {
        expect(Math.abs(s.parts.caption!.top - c.parts.caption!.top)).toBeLessThanOrEqual(SNAP)
        expect(Math.abs(s.parts.value!.top - c.parts.value!.top)).toBeLessThanOrEqual(SNAP)
      }
    }
  })

  test('footers of cells with a visual or rows share one top', () => {
    const a = cell('tall')
    const b = cell('rows')
    expect(Math.abs(a.parts.footer!.top - b.parts.footer!.top)).toBeLessThanOrEqual(SNAP)
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
