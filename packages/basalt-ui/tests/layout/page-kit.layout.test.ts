/**
 * The page kit in a real browser, on the v3 fixture (`fixture/v3/scenarios/page-kit.tsx`):
 * - `PageSummary`: at 390 the facts wrap, no wrapped line opens with the dot, and the dot of each
 *   line's first fact sits outside the list's clip; at 1440 the facts keep one line.
 * - `CardGrid`: the tracks follow the closed `min` at 1440, 900 and 390, a track never goes under
 *   the tier unless the container is narrower than it, and nothing overflows horizontally.
 *
 * - `Facts`: one label-and-value column in a container under the `regular` tier, two from it, and
 *   nothing overflows, whatever the viewport is.
 *
 * v3 only: the 2.x oracle has no `CardGrid`, and its `PageSummary` case is `shell-page-kit`'s.
 */
import { acquireShellTarget } from './shell-target'
import { afterAll, describe, expect, test } from 'bun:test'
import { providedSlots } from './fixture/v3/registry'
import type { PageKitSpec } from './fixture/v3/scenarios/page-kit'
import { LAYOUT_TARGET } from './shell-slots'
import {
  DESKTOP_1440,
  LAPTOP_900,
  PHONE,
  closeLayoutSuite,
  expectNoHorizontalOverflow,
  initLayoutSuite,
  openFixture,
} from './harness'
import type { Viewport } from './harness'
import { slot } from './harness/slots'

acquireShellTarget()
const ready = await initLayoutSuite()

afterAll(closeLayoutSuite)

const runnable =
  ready &&
  LAYOUT_TARGET === 'v3' &&
  ['card-grid', 'page-summary-fact', 'facts'].every((s) => providedSlots().has(s))
const layout = runnable ? describe : describe.skip

const base = { sections: [] }
const summarySpec = (): PageKitSpec => ({ ...base, w37: { summary: true } })
const gridSpec = (grid: 'narrow' | 'regular' | 'wide', cards = 12): PageKitSpec => ({
  ...base,
  pageKit: { grid, cards },
})

/** The container tiers as px: `--container-narrow|regular|wide` in `src/css/tailwind.css`. */
const MIN_PX = { narrow: 240, regular: 480, wide: 800 } as const
const PAD = 16
const GAP = 12

layout('PageSummary facts', () => {
  const read = (viewport: Viewport) =>
    openFixture(summarySpec(), viewport).then((page) =>
      page.raw.evaluate(
        ({ factsSel, factSel }) => {
          const list = document.querySelector<HTMLElement>(factsSel)
          if (list === null) throw new Error('LAYOUT: no facts list')
          const listLeft = list.getBoundingClientRect().left
          const gap = parseFloat(getComputedStyle(list).columnGap)
          const facts = [...list.querySelectorAll<HTMLElement>(factSel)]
          return {
            overflowX: getComputedStyle(list).overflowX,
            gap,
            content: getComputedStyle(facts[0] as HTMLElement, '::before').content,
            rows: facts.map((f) => {
              const r = f.getBoundingClientRect()
              const dot = getComputedStyle(f, '::before')
              return {
                top: Math.round(r.top),
                left: r.left - listLeft,
                dotLeft: r.left - listLeft + parseFloat(dot.insetInlineStart),
                dotWidth: parseFloat(dot.width),
              }
            }),
          }
        },
        { factsSel: slot('page-summary-facts'), factSel: slot('page-summary-fact') },
      ),
    )

  test('390: the facts wrap and a line-leading fact has its dot outside the clip', async () => {
    const m = await read(PHONE)
    const tops = new Set(m.rows.map((r) => r.top))
    expect(tops.size, 'the facts wrap onto at least two lines at 390').toBeGreaterThan(1)
    expect(m.overflowX).toBe('clip')
    expect(m.content).toContain('·')
    for (const r of m.rows) {
      expect(r.dotWidth).toBeCloseTo(m.gap, 1)
      const leading = r.left < 1
      if (leading)
        expect(r.dotLeft + r.dotWidth, 'a line-leading dot is clipped').toBeLessThanOrEqual(0.5)
      else
        expect(r.dotLeft, 'a mid-line dot sits in the gap before its fact').toBeGreaterThanOrEqual(
          -0.5,
        )
    }
    for (const top of tops) {
      const lead = m.rows.filter((r) => r.top === top && r.left < 1)
      expect(lead, `line at ${top} opens with exactly one fact at the edge`).toHaveLength(1)
    }
  })

  test('1440: the facts keep one line and only the first dot is clipped', async () => {
    const m = await read(DESKTOP_1440)
    expect(new Set(m.rows.map((r) => r.top)).size).toBe(1)
    expect(m.rows.filter((r) => r.dotLeft + r.dotWidth <= 0.5)).toHaveLength(1)
  })
})

layout('CardGrid tracks follow the closed min', () => {
  const read = async (grid: 'narrow' | 'regular' | 'wide', viewport: Viewport) => {
    const page = await openFixture(gridSpec(grid), viewport)
    const m = await page.raw.evaluate((gridSel) => {
      const el = document.querySelector<HTMLElement>(gridSel)
      if (el === null) throw new Error('LAYOUT: no card grid')
      const style = getComputedStyle(el)
      const tracks = style.gridTemplateColumns.split(' ').map(parseFloat)
      return { width: el.clientWidth, scrollWidth: el.scrollWidth, tracks }
    }, slot('card-grid'))
    return { ...m, overflow: await page.horizontalOverflow() }
  }

  const cases: [Viewport, 'narrow' | 'regular' | 'wide'][] = []
  for (const viewport of [DESKTOP_1440, LAPTOP_900, PHONE])
    for (const min of ['narrow', 'regular', 'wide'] as const) cases.push([viewport, min])

  for (const [viewport, min] of cases) {
    test(`${viewport.width}px, min ${min}`, async () => {
      const m = await read(min, viewport)
      const inner = viewport.width - 2 * PAD
      const expected = Math.max(1, Math.floor((inner + GAP) / (MIN_PX[min] + GAP)))
      expect(m.tracks, 'one track per column the tier allows').toHaveLength(expected)
      for (const track of m.tracks)
        expect(
          track,
          'a track is never under the tier unless the container is narrower',
        ).toBeGreaterThanOrEqual(Math.min(MIN_PX[min], inner) - 0.5)
      expect(m.scrollWidth).toBeLessThanOrEqual(m.width + 0.5)
      expectNoHorizontalOverflow(m.overflow, `CardGrid ${min} at ${viewport.width}`, viewport)
    })
  }
})

layout('CardGrid shares the row among its cards', () => {
  const WIDE_1510: Viewport = { name: 'wide 1510', width: 1510, height: 900 }
  const read = async (cards: number, viewport: Viewport) => {
    const page = await openFixture(gridSpec('narrow', cards), viewport)
    return page.raw.evaluate(() => {
      const boxes = [...document.querySelectorAll<HTMLElement>('[data-testid="grid-card"]')].map(
        (card) => {
          const r = card.getBoundingClientRect()
          return { left: r.left, right: r.right, top: r.top, width: r.width }
        },
      )
      return boxes
    })
  }

  test('1510px: four cards take a quarter of the row each, no empty track', async () => {
    const boxes = await read(4, WIDE_1510)
    const inner = WIDE_1510.width - 2 * PAD
    const quarter = (inner - 3 * GAP) / 4
    expect(new Set(boxes.map((b) => b.top)).size, 'one row').toBe(1)
    for (const b of boxes) expect(b.width).toBeCloseTo(quarter, 0)
    expect(boxes[3]!.right, 'the last card reaches the content edge').toBeCloseTo(
      WIDE_1510.width - PAD,
      0,
    )
  })

  test('390px: six cards stack one per row', async () => {
    const boxes = await read(6, PHONE)
    expect(new Set(boxes.map((b) => b.top)).size).toBe(6)
    for (const b of boxes) expect(b.width).toBeCloseTo(PHONE.width - 2 * PAD, 0)
  })
})

layout('Facts columns follow the container', () => {
  const read = async (width: number) => {
    const page = await openFixture(
      { ...base, pageKitFacts: { width, rows: 6 } } as PageKitSpec,
      DESKTOP_1440,
    )
    return page.raw.evaluate((sel) => {
      const list = document.querySelector<HTMLElement>(`${sel} dl`)
      if (list === null) throw new Error('LAYOUT: no facts list')
      const tracks = getComputedStyle(list).gridTemplateColumns.split(' ').map(parseFloat)
      const rows = [...list.querySelectorAll<HTMLElement>('dt')].map(
        (dt) => dt.getBoundingClientRect().top,
      )
      return { tracks, rows, width: list.clientWidth, scrollWidth: list.scrollWidth }
    }, slot('facts'))
  }

  test('one row per entry: six dt and one pair per line under the regular tier', async () => {
    const m = await read(360)
    expect(m.tracks, 'label and value').toHaveLength(2)
    expect(new Set(m.rows).size, 'six lines').toBe(6)
    expect(m.scrollWidth).toBeLessThanOrEqual(m.width + 0.5)
  })

  test('just under the regular tier (479px) is still one column', async () => {
    const m = await read(479)
    expect(m.tracks).toHaveLength(2)
  })

  test('from the regular tier (480px) two pairs share a line', async () => {
    const m = await read(480)
    expect(m.tracks, 'label, value, label, value').toHaveLength(4)
    expect(new Set(m.rows).size, 'three lines for six rows').toBe(3)
    expect(m.scrollWidth).toBeLessThanOrEqual(m.width + 0.5)
  })

  test('the viewport does not decide: a 360px host at 1440 stays one column', async () => {
    expect((await read(360)).tracks).toHaveLength(2)
  })
})
