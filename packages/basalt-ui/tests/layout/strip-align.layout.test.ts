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

type Oldest = { key: string; top: number; bottom: number; contentBottom: number; padTop: number }[]

/** The S3 queue strip: a Meter cell beside a taller legend Meter and sparkline siblings (one with a footer), at 5 columns and in 2. */
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
        key: c.getAttribute('data-strip-cell') ?? '',
        top: b.top,
        bottom: b.bottom,
        contentBottom: Math.max(...content.map((e) => e.getBoundingClientRect().bottom)),
        padTop: parseFloat(getComputedStyle(c).paddingTop),
      }
    })
  })

type Compact = {
  strip: { background: string }
  cells: {
    key: string
    top: number
    bottom: number
    left: number
    right: number
    padBottom: number
    contentBottom: number
    below: string
    slot: { top: number; bottom: number; left: number }
    footerRow: string | null
    footerTop: number | null
    valueBottom: number
  }[]
}

/** The compact law, measured on the align strip: where each cell's own box ends and what shows under it. */
const measureCompact = (p: LayoutPage): Promise<Compact> =>
  p.raw.evaluate(() => {
    const host = document.querySelector<HTMLElement>('[data-testid="dash-strip-align"]')
    if (!host) throw new Error('LAYOUT: no dash-strip-align')
    const clear = (c: string) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent'
    const paintBehind = (from: Element | null) => {
      let el = from
      while (el && clear(getComputedStyle(el).backgroundColor)) el = el.parentElement
      return el ? getComputedStyle(el).backgroundColor : 'none'
    }
    const card = host
      .querySelector<HTMLElement>('section')!
      .closest<HTMLElement>('.mantine-Card-root')
    const cells = [...host.querySelectorAll<HTMLElement>('[data-strip-cell]')].map((c) => {
      const b = c.getBoundingClientRect()
      const leaves = [...c.querySelectorAll<HTMLElement>('*')].filter(
        (e) => e.children.length === 0 && e.getBoundingClientRect().height > 0,
      )
      const slot = c.closest<HTMLElement>('[data-strip-slot]') ?? c
      const sb = slot.getBoundingClientRect()
      const footer = c.querySelector<HTMLElement>('[data-strip-footer]')
      return {
        key: c.getAttribute('data-strip-cell') ?? '',
        top: b.top,
        bottom: b.bottom,
        left: b.left,
        right: b.right,
        padBottom: parseFloat(getComputedStyle(c).paddingBottom),
        contentBottom: Math.max(...leaves.map((e) => e.getBoundingClientRect().bottom)),
        below: paintBehind(c.parentElement),
        slot: { top: sb.top, bottom: sb.bottom, left: sb.left },
        footerRow: footer
          ? footer.parentElement === c
            ? getComputedStyle(footer).gridRowStart
            : 'stack'
          : null,
        footerTop: footer ? footer.getBoundingClientRect().top : null,
        valueBottom: c.querySelector<HTMLElement>('[data-strip-value]')!.getBoundingClientRect()
          .bottom,
      }
    })
    return { strip: { background: card ? getComputedStyle(card).backgroundColor : 'none' }, cells }
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
        // A sibling's own-track footer (under its hero) opens one footer line under every value in
        // the row; that is "a taller sibling part" too.
        const heroFooter =
          name === 'value'
            ? Math.max(
                0,
                ...band(m, c).map((s) =>
                  s.parts.footer &&
                  s.parts.value &&
                  s.parts.footer.top - s.parts.value.bottom <= m.gap + SNAP
                    ? height(s.parts.footer) + m.gap
                    : 0,
                ),
              )
            : 0
        const slack =
          heroFooter +
          Math.max(0, ...band(m, c).map((s) => height(s.parts[name]) - height(c.parts[name])))
        if (gapBelow > m.gap + slack + SNAP)
          throw new Error(`LAYOUT: ${c.key} ${name}→${next} gap ${gapBelow} slack ${slack}`)
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
    const c = cells.find((x) => x.key === 'oldest')!
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

  test('forced colors: dividers become borders and the cells stay level', async () => {
    await p.raw.emulateMedia({ forcedColors: 'active' })
    try {
      const r = await p.raw.evaluate(() => {
        const cs = [
          ...document.querySelectorAll<HTMLElement>(
            '[data-testid="dash-strip-oldest"] [data-strip-slot]',
          ),
        ].map((c) => getComputedStyle(c))
        return cs.map((x) => ({
          line: x.borderInlineStartWidth + x.borderBlockStartWidth,
          top: x.paddingTop,
        }))
      })
      for (const c of r) expect(c).toEqual(r[0]!)
      expect(r[0]!.line).toBe('1px1px')
    } finally {
      await p.raw.emulateMedia({ forcedColors: 'none' })
    }
  })

  test('compact: no cell box has a void of 0.25 of its own height at its foot', async () => {
    const c = await measureCompact(p)
    for (const x of c.cells) {
      const void_ = (x.bottom - x.padBottom - x.contentBottom) / (x.bottom - x.top)
      if (void_ >= 0.25)
        throw new Error(`LAYOUT: cell ${x.key} ends ${(void_ * 100).toFixed(0)} % void`)
    }
  })

  test('compact: captions share one top, values one baseline, per-footer-track tops are equal', async () => {
    const c = await measureCompact(p)
    for (const x of c.cells) {
      for (const y of c.cells.filter((o) => Math.abs(o.top - x.top) <= SNAP)) {
        const cx = cell(x.key)
        const cy = cell(y.key)
        expect(Math.abs(cx.parts.caption!.top - cy.parts.caption!.top)).toBeLessThanOrEqual(1)
        expect(Math.abs(cx.parts.value!.bottom - cy.parts.value!.bottom)).toBeLessThanOrEqual(1)
        if (x.footerTop !== null && y.footerTop !== null && x.footerRow === y.footerRow) {
          expect(Math.abs(x.footerTop - y.footerTop)).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  test('compact: one surface — the area under a short cell is the strip surface, dividers run the row', async () => {
    const c = await measureCompact(p)
    for (const x of c.cells) {
      expect(x.below).toBe(c.strip.background)
      const row = c.cells.filter((o) => Math.abs(o.slot.top - x.slot.top) <= SNAP)
      const rowBottom = Math.max(...row.map((o) => o.slot.bottom))
      expect(Math.abs(x.slot.bottom - rowBottom)).toBeLessThanOrEqual(1)
    }
  })

  test('a value-only cell’s footer sits directly under its value', () => {
    const c = cell('short')
    expect(c.parts.footer!.top - c.parts.value!.bottom).toBeLessThanOrEqual(m.gap + SNAP)
  })
}

layout('StatStrip part alignment', () => {
  for (const vp of [DESKTOP_1440, PHONE]) describe(`at ${vp.width}px`, () => suite(vp))
})

type Pair = { gap: number; width: number }[]

const measureFooter = (p: LayoutPage): Promise<Pair> =>
  p.raw.evaluate(() => {
    const host = document.querySelector<HTMLElement>('[data-testid="dash-strip-footer"]')
    if (!host) throw new Error('LAYOUT: no dash-strip-footer')
    return [...host.querySelectorAll<HTMLElement>('[data-strip-footer-cell]')].map((f) => {
      const caps = f.querySelector<HTMLElement>('[data-meter-captions]')
      if (!caps || caps.children.length < 2) throw new Error('LAYOUT: no footer captions')
      const a = caps.children[0]!.getBoundingClientRect()
      const b = caps.children[1]!.getBoundingClientRect()
      return { gap: b.left - a.right, width: f.getBoundingClientRect().width }
    })
  })

type CardStates = {
  valueTops: number[]
  qualifier: { title: string | null; clipped: boolean } | null
  errorHeads: number[]
  footers: number
}

const measureCardStates = (p: LayoutPage): Promise<CardStates> =>
  p.raw.evaluate(() => {
    const host = document.querySelector<HTMLElement>('[data-testid="dash-stat-states"]')
    if (!host) throw new Error('LAYOUT: no dash-stat-states')
    const cards = [...host.querySelectorAll<HTMLElement>('.mantine-Card-root')]
    const long = cards[1]!.querySelector<HTMLElement>('[class*="qualifier_"]')
    return {
      valueTops: cards
        .slice(0, 2)
        .map((c) => c.querySelector<HTMLElement>('[class*="value_"]')!.getBoundingClientRect().top),
      qualifier: long
        ? { title: long.getAttribute('title'), clipped: long.scrollWidth > long.clientWidth }
        : null,
      errorHeads: [
        ...host.querySelectorAll<HTMLElement>(
          '[role="alert"] p, [role="alert"] [class*="Text-root"]',
        ),
      ]
        .slice(0, 1)
        .map((e) => e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)),
      footers: host.querySelectorAll('[class*="footer_"]').length,
    }
  })

layout('StatStrip footer row and StatCard states', () => {
  test(
    'a footer meter keeps its caption beside its value at 1440',
    async () => {
      const p = await openFixture(SPEC, DESKTOP_1440)
      await p.settle()
      for (const f of await measureFooter(p)) expect(f.gap).toBeLessThanOrEqual(160)
    },
    CLOSE_BUDGET_MS,
  )

  test(
    'at 390 a long qualifier leaves the value row level and truncates with a title',
    async () => {
      const p = await openFixture(SPEC, PHONE)
      await p.settle()
      const s = await measureCardStates(p)
      expect(Math.abs(s.valueTops[0]! - s.valueTops[1]!)).toBeLessThanOrEqual(1)
      expect(s.qualifier?.title).not.toBeNull()
    },
    CLOSE_BUDGET_MS,
  )

  test(
    'at 390 the error title is one line and empty/error cards drop the captioning footer',
    async () => {
      const p = await openFixture(SPEC, PHONE)
      await p.settle()
      const s = await measureCardStates(p)
      for (const lines of s.errorHeads) expect(lines).toBeLessThanOrEqual(1.1)
      expect(s.footers).toBe(0)
    },
    CLOSE_BUDGET_MS,
  )

  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)
})
