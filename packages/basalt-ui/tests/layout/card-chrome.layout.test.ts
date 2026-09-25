/**
 * Layout invariants for card chrome by CONTAINER width (`docs/waves/RESPONSIVE-SPEC.md` §1/§3): the
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

const SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  cards: { widths: [200, 320, 900], stretchedRow: 400, groupWidth: 240 },
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

  test.each([
    [200, false],
    [320, false],
    [900, true],
  ])('in a %ipx card the visible subtitle shows: %s', async (width, shown) => {
    const root = `[data-testid="card-${width}"]`
    const subtitle = (await p.boxes(`${root} ${moduleClass('subtitle')}`))[0]
    expect(subtitle !== undefined && subtitle.height > 0).toBe(shown)
    // Below 480px the folded glyph carries the subtitle instead; from 480px it is not rendered.
    const glyphs = await p.boxes(`${root} button[aria-label="More information"]`)
    expect(glyphs.some((g) => g.height > 0)).toBe(!shown)
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

  test('at 900px value + delta share the heading row and the actions sit right of them', async () => {
    const root = '[data-testid="card-900"]'
    const heading = await p.box('heading', `${root} h3`)
    const value = await p.box('value', `${root} ${moduleClass('value')}`)
    const actions = await p.box('actions', `${root} ${moduleClass('actions')}`)
    // The numeral is taller than the heading's 28px row, so compare centres, not edges.
    const centre = value.box.top + value.box.height / 2
    expect(centre).toBeGreaterThanOrEqual(heading.box.top)
    expect(centre).toBeLessThanOrEqual(heading.box.bottom)
    expect(actions.box.left).toBeGreaterThanOrEqual(value.box.right)
    // and below 480px the value is on its own row under the heading
    const narrowValue = await p.box('nv', `[data-testid="card-320"] ${moduleClass('value')}`)
    const narrowHeading = await p.box('nh', `[data-testid="card-320"] ${moduleClass('titleRow')}`)
    expect(narrowValue.box.top).toBeGreaterThanOrEqual(narrowHeading.box.bottom)
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
})
