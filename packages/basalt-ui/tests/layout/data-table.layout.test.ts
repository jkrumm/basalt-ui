/**
 * Layout invariants for `BasaltDataTable`'s sticky header — the ones happy-dom cannot observe,
 * because `position: sticky` has no meaning without a layout engine.
 *
 * THE DEFECT THAT BOUGHT THIS FILE: `stickyHeader` + `minWidth` (or `maxHeight`) renders the table
 * inside `Table.ScrollContainer type="native"`, and that box — `overflow-x: auto` computes
 * `overflow-y` to `auto` as well — is the header's own scrollport. A `stickyHeaderOffset` sized for
 * WINDOW scroll (the AppShell header plus `PageBar` row 2, `calc(48px + 46px)` on `/data-stress`)
 * therefore parked the `<thead>` 94px DOWN INSIDE the body: measured at y=339 with row 1 at y=284
 * and row 2 at y=327, so the header painted over row 2 at initial scroll, at 1440x900 and 390x844
 * alike. Two `bun test` files exercise this component and neither could see it.
 *
 * ASSERTIONS ARE RELATIONS, NEVER EXACT PIXELS — the invariant is "the header's top edge IS the
 * scroller's top edge", which holds at any font metric, density level or viewport.
 */
import { afterAll, describe, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { Named, Viewport } from './harness'
import {
  PHONE,
  CLOSE_BUDGET_MS,
  closeLayoutSuite,
  expectFullyInside,
  expectGapAtMost,
  expectScrolls,
  initLayoutSuite,
  openFixture,
} from './harness'

// Booted at MODULE TOP LEVEL, the same shape as the other two layout files — Bun caps a hook at an
// undeclared 5000 ms that the cold boot does not reliably fit inside.
const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const DESKTOP: Viewport = { name: 'desktop', width: 1440, height: 900 }

/**
 * Mantine's static class names. The OUTER container is the scrollport (`overflow: auto`); the inner
 * one is a static wrapper and measuring it would prove nothing. A Mantine rename fails as an
 * explicit `LAYOUT: no element matched …` rather than as a silent pass.
 */
const SCROLLER = '.mantine-TableScrollContainer-scrollContainer'
const THEAD = 'table thead'
const ROW_1 = 'table tbody tr:nth-child(1)'

/** The measured `calc(var(--app-shell-header-height) + var(--basalt-page-bar-h))` of `/data-stress`. */
const PAGE_OFFSET = 94

/** The `/data-stress` shape: a capped, horizontally-floored body under a page-level offset. */
const tableSpec = (extra: Partial<FixtureSpec['table']> = {}): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'home', label: 'Home', mobile: 'tab', active: true }] },
  ],
  table: {
    rows: 40,
    maxHeight: 240,
    minWidth: 720,
    stickyHeaderOffset: PAGE_OFFSET,
    ...extra,
  },
})

/**
 * A VERTICAL band around `target`, horizontally unbounded. A `minWidth` table is wider than its
 * scrollport by design — that is what the horizontal scroll is for — so a horizontal edge is never
 * the invariant here, and `expectFullyInside` checks all four.
 */
function band(name: string, top: number, bottom: number, target: Named): Named {
  const { left, right } = target.box
  return {
    name,
    box: { x: left, y: top, width: right - left, height: bottom - top, top, left, right, bottom },
  }
}

layout('BasaltDataTable sticky header — real layout', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  /**
   * INVARIANT 1 — inside the scroll container the header's anchor is the SCROLLER's top edge.
   *
   * The two assertions pin equality from both sides: `expectGapAtMost` catches the header pushed
   * DOWN into the body (the shipped defect, +94px) and `expectFullyInside` catches it floating
   * above the box. Row 1 sitting entirely under the header is the corollary the screenshot showed.
   */
  for (const viewport of [PHONE, DESKTOP]) {
    test(`header sticks to the scroller's top edge at initial scroll (${viewport.name})`, async () => {
      const p = await openFixture(tableSpec(), viewport)
      const scroller = await p.box('scroller', SCROLLER)
      const thead = await p.box('thead', THEAD)
      const row1 = await p.box('row 1', ROW_1)

      expectGapAtMost(
        scroller,
        thead,
        'top',
        0.5,
        'a page-level stickyHeaderOffset must not reach a table that owns its own scrollport — it ' +
          'parks the header that many pixels inside the body, over the first rows',
        viewport,
      )
      expectFullyInside(
        thead,
        band('scrollport', scroller.box.top, scroller.box.bottom, thead),
        'the sticky header never leaves its scroll container vertically',
        viewport,
      )
      expectFullyInside(
        row1,
        band('under the header', thead.box.bottom, scroller.box.bottom, row1),
        'the first row starts below the header, not under it',
        viewport,
      )
    })
  }

  /**
   * INVARIANT 2 — it STAYS there once the body scrolls. Sticky at 0 and sticky at the wrong offset
   * are indistinguishable at rest on a body short enough not to scroll, which is exactly how the
   * defect read as "a styling nit" rather than as a broken anchor.
   */
  test('header holds the scroller top after the body scrolls 200px', async () => {
    const p = await openFixture(tableSpec(), PHONE)
    expectScrolls(
      'scroller',
      await p.scroll(SCROLLER),
      'the capped body must overflow, or the ' +
        'scroll below is a no-op and this test asserts nothing',
    )

    await p.raw.evaluate((sel) => {
      const element = document.querySelector(sel)
      if (element) element.scrollTop = 200
    }, SCROLLER)
    await p.settle()

    const scroller = await p.box('scroller', SCROLLER)
    const thead = await p.box('thead', THEAD)
    expectGapAtMost(
      scroller,
      thead,
      'top',
      0.5,
      'the header must remain pinned to the scroller top through the scroll, not ride away with ' +
        'the rows',
    )
    expectFullyInside(
      thead,
      band('scrollport', scroller.box.top, scroller.box.bottom, thead),
      'the sticky header never leaves its scroll container vertically',
    )
  })

  /**
   * INVARIANT 3 — the WINDOW-scroll case still honours the offset. The fix drops the prop only
   * where the table owns a scrollport; a table with neither `maxHeight` nor `minWidth` scrolls with
   * the page and genuinely has fixed chrome to clear.
   */
  test('without a scroll container the page offset still reaches the header', async () => {
    const p = await openFixture(
      { ...tableSpec(), table: { rows: 40, stickyHeaderOffset: PAGE_OFFSET } },
      PHONE,
    )
    const top = await p.computed(THEAD, 'top')
    if (top !== `${PAGE_OFFSET}px`) {
      throw new Error(
        `LAYOUT INVARIANT VIOLATED — a page-scrolled sticky header must still clear the app ` +
          `header.\n  expected: thead top = ${PAGE_OFFSET}px\n  actual:   thead top = ${top}`,
      )
    }
  })
})
