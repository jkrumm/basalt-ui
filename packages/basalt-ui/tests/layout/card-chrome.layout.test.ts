/**
 * Layout invariants for card chrome by CONTAINER width (`docs/DESIGN-CORE.md` § Layout, elevation, shapes): the
 * KPI value never truncates at any card width, the subtitle is visible only from 480px (below it,
 * it folds into the info glyph — exactly one shows), and a `ChartCard` stretched by a grid row hands
 * the spare height to its body. `@container` outcomes are a layout fact happy-dom cannot see.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage } from './harness'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  closeLayoutSuite,
  initLayoutSuite,
  moduleClass,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

// A wide scan around `CARD_SHORT_HEIGHT` (280px) — the exact bistable band depends on the header's
// own folded/unfolded height (not reproduced here), so the scan spans a generous range around it
// rather than one guessed value.
const OSCILLATION_SCAN_HEIGHTS = Array.from({ length: 21 }, (_, i) => 150 + i * 10)

const SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  cards: {
    widths: [200, 320, 900],
    stretchedRow: 400,
    groupWidth: 240,
    gridProbes: [799, 800, 1199, 1200],
    shortHeader: { width: 600, bodyHeight: 140 },
    oscillationScan: { width: 600, bodyHeights: OSCILLATION_SCAN_HEIGHTS },
    footprint: true,
  },
}

layout('card chrome by container', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  let p: LayoutPage
  beforeAll(async () => {
    p = await openFixture(SPEC, DESKTOP_1440)
    await p.settle()
  }, CLOSE_BUDGET_MS)

  test.each([200, 320, 900])('the KPI value never truncates in a %ipx card', async (width) => {
    const { scrollWidth, clientWidth, ellipsis, text } = await p.raw.evaluate(
      ([root, cls]) => {
        const el = document.querySelector<HTMLElement>(`${root} ${cls}`)
        if (!el) throw new Error(`no value element under ${root}`)
        return {
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          ellipsis: getComputedStyle(el).textOverflow,
          text: el.textContent,
        }
      },
      [`[data-testid="card-${width}"]`, moduleClass('value')] as const,
    )
    expect(text).toBe('$12,847,301.55')
    expect(ellipsis).toBe('clip')
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  // SPEC § 6.1: the subtitle is the FOOTER — one muted line under the visual, at every card width. It
  // no longer folds into the info glyph below 480px.
  test.each([200, 320, 900])('in a %ipx card the footer shows and nothing folds', async (width) => {
    const root = `[data-testid="card-${width}"]`
    const footer = (await p.boxes(`${root} ${moduleClass('footer')}`))[0]
    expect(footer !== undefined && footer.height > 0).toBe(true)
    expect(await p.boxes(`${root} button[aria-label^="More information"]`)).toHaveLength(0)
  })

  // The even-pixel grid (SPEC § 5, Wave 32): a card insets 12 vertical / 16 horizontal and rounds at
  // 10. Read off the resolved box, so a retuned token and a stale CSS fallback both fail here.
  test('a StatCard insets 12 vertical, 16 horizontal and rounds at 10 (desktop)', async () => {
    const card = '[data-testid="card-900"] > div'
    expect(await p.computed(card, 'padding-top')).toBe('12px')
    expect(await p.computed(card, 'padding-left')).toBe('16px')
    expect(await p.computed(card, 'border-top-left-radius')).toBe('10px')
  })

  test('a ChartCard stretched by a 400px grid row gives the spare height to its body', async () => {
    const row = await p.box('row', '[data-testid="stretch-row"]')
    const card = await p.box('card', '[data-testid="stretch-row"] > div')
    const body = await p.box('body', '[data-testid="stretch-row"] > div > div:last-child')
    expect(Math.round(card.box.height)).toBe(Math.round(row.box.height))
    // The body's own content is 60px + padding, so anything near the row height is the fill.
    expect(body.box.height).toBeGreaterThan(200)
    expect(card.box.bottom - body.box.bottom).toBeLessThan(1)
  })

  // The caption row, then the value row, at every width: the actions pin to the card's right end of
  // the caption row and the value row sits wholly under it.
  test.each([200, 320, 900])(
    'in a %ipx card the value row sits under the caption row',
    async (width) => {
      const root = `[data-testid="card-${width}"]`
      const caption = await p.box('caption', `${root} ${moduleClass('captionRow')}`)
      const value = await p.box('value', `${root} ${moduleClass('valueRow')}`)
      const actions = await p.box('actions', `${root} ${moduleClass('actions')}`)
      expect(value.box.top).toBeGreaterThanOrEqual(caption.box.bottom - 0.5)
      expect(actions.box.top).toBeGreaterThanOrEqual(caption.box.top - 0.5)
      expect(actions.box.bottom).toBeLessThanOrEqual(caption.box.bottom + 0.5)
      const card = await p.box('card', `${root} > div`)
      // 16px inset at the expanded size class, 12px below it: the actions end at the inset edge.
      expect(card.box.right - actions.box.right).toBeLessThanOrEqual(16.5)
    },
  )

  // SPEC § 6.1 footprint: the foot reserves a visual AND a footer line, so cards with and without
  // either are the same height, and a grid row stretches the rest to it.
  test('cards with a visual, a footer, or both (in the foot) hold the same height', async () => {
    const heights: Record<'both' | 'visual' | 'footer', number> = { both: 0, visual: 0, footer: 0 }
    for (const id of ['both', 'visual', 'footer'] as const) {
      heights[id] = Math.round((await p.box(id, `[data-testid="foot-${id}"] > div`)).box.height)
    }
    expect(heights.visual).toBe(heights.both)
    expect(heights.footer).toBe(heights.both)
  })

  test('a `right` card with a footer and no sparkline adds one footer line, not a visual band', async () => {
    const bare = await p.box('b', '[data-testid="foot-right-bare"] > div')
    const footer = await p.box('f', '[data-testid="foot-right-footer"] > div')
    // gap (8) + one 20px footer line; reserving the 22px band as well would add 26 more.
    expect(Math.round(footer.box.height - bare.box.height)).toBeLessThanOrEqual(28)
  })

  test('a `right` placement card holds its height pending and ready', async () => {
    const pending = await p.box('p', '[data-testid="foot-right-pending"] > div')
    const ready = await p.box('r', '[data-testid="foot-right-ready"] > div')
    expect(Math.round(pending.box.height)).toBe(Math.round(ready.box.height))
  })

  test('a card with no foot stretches to its grid row siblings', async () => {
    const cards = await p.boxes('[data-testid="foot-grid"] .mantine-Card-root')
    expect(cards).toHaveLength(3)
    const heights = new Set(cards.map((c) => Math.round(c.height)))
    expect(heights.size).toBe(1)
  })

  test('the sparkline slot is 22px tall and bled to both side edges', async () => {
    const root = '[data-testid="foot-both"]'
    const slot = await p.box('slot', `${root} ${moduleClass('sparklineBleed')}`)
    const card = await p.box('card', `${root} > div`)
    expect(Math.round(slot.box.height)).toBe(22)
    expect(Math.round(slot.box.left)).toBe(Math.round(card.box.left))
    expect(Math.round(slot.box.right)).toBe(Math.round(card.box.right))
  })

  // Wave 8's header-economy law: a short-but-wide ChartCard (the `/charts` Primitives
  // "Availability"/"Negotiated link speed" shape) folds its subtitle by height, not width, and its
  // merged title row keeps the header to a fifth of the card. Measured before wave 8: 0.335 at this
  // fixture's width/body (subtitle visible, full-size KPI numeral, full header inset).
  test('a short ChartCard header stays at or under 20% of the card height (wave 8)', async () => {
    const card = await p.box('card', '[data-testid="card-short"] > div')
    const header = await p.box('header', '[data-testid="card-short"] > div > div:first-child')
    expect(header.box.height / card.box.height).toBeLessThanOrEqual(0.2)
  })

  // P0-1: `data-basalt-card-short` used to oscillate forever on any card whose unfolded height fell
  // in a narrow band around 280px — the flag folds the header, which changes the card's OWN
  // measured height, which could flip the flag back on the next ResizeObserver reading. Hysteresis
  // (enter below 280, leave only at/above 280 + the exit slack) should make it hold still.
  test('data-basalt-card-short holds still over time at every scanned body height', async () => {
    const testids = OSCILLATION_SCAN_HEIGHTS.map((h) => `card-osc-${h}`)
    const readFlags = () =>
      p.raw.evaluate(
        (ids) =>
          ids.map((id) =>
            document
              .querySelector(`[data-testid="${id}"] > div`)
              ?.hasAttribute('data-basalt-card-short'),
          ),
        testids,
      )
    await p.settle()
    const first = await readFlags()
    for (let i = 0; i < 4; i += 1) {
      await p.raw.waitForTimeout(120)
      const next = await readFlags()
      expect(next).toEqual(first)
    }
  })

  test('a divided StatGroup at 240px is one column with no rail border or indent on any cell', async () => {
    const cells = await p.raw.evaluate(() =>
      [...(document.querySelector('[data-testid="group"] [data-divided]')?.children ?? [])].map(
        (el) => {
          const cs = getComputedStyle(el)
          return {
            border: cs.borderInlineStartWidth,
            indent: cs.paddingInlineStart,
            left: el.getBoundingClientRect().left,
          }
        },
      ),
    )
    expect(cells).toHaveLength(4)
    for (const c of cells) {
      expect(c.border).toBe('0px')
      expect(c.indent).toBe('0px')
      expect(c.left).toBe(cells[0]!.left)
    }
  })

  /**
   * `StatGroup` keys on `@container basalt-grid`: the `sm` count opens at the `wide`
   * container class (800px, the viewport-era 768 before 1.32.0) and the full count at the grids'
   * own 1200. `cols={5}` → 2 / 3 / 5 (sm = min(cols, 3)). Tracks are read from the RESOLVED template — the only way to
   * see which tier won.
   */
  test.each([
    [799, 2],
    [800, 3],
    [1199, 3],
    [1200, 5],
  ])('a %ipx container: StatGroup %i tracks', async (width, stat) => {
    const tracks = await p.raw.evaluate((w) => {
      const count = (sel: string) => {
        const el = document.querySelector(`[data-testid="grid-probe-${w}"] ${sel}`)
        if (!el) throw new Error(`no ${sel} in the ${w}px probe`)
        return getComputedStyle(el).gridTemplateColumns.split(/\s+/).filter(Boolean).length
      }
      return count('[data-sm-cols]')
    }, width)
    expect(tracks).toBe(stat)
  })
})
