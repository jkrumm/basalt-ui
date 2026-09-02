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
import type { LayoutPage, Named, Viewport } from './harness'
import {
  MAIN,
  PHONE,
  CLOSE_BUDGET_MS,
  closeLayoutSuite,
  expectFullyInside,
  expectGapAtMost,
  expectNoHorizontalOverflow,
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

/**
 * The measured-containment wrapper — `useMeasuredContainment` in `data/data-table.tsx`. Its own
 * class name is hashed by the CSS-module build, so the ATTRIBUTE is the selector: it is the state
 * the hook publishes and the one a test has any business reading.
 */
const WRAPPER = '[data-contained]'

/**
 * The toolbar `Group` and the search field inside it. `CtlSlot` is `display: contents`, so the
 * Group directly under the tier marker IS the header row's flex item — which is exactly the box
 * whose refusal to shrink widened the page, so it is the box the selector names.
 */
const TOOLBAR = '[data-basalt-tier="ctl"] > .mantine-Group-root'
const SEARCH = '.mantine-TextInput-root'
/** `SEARCH_WIDTH` in `data/data-table.tsx` — the flex BASIS the field must still resolve to. */
const SEARCH_BASIS = 220

/**
 * A synthetic offset. It exists to prove the PROP reaches the `<thead>` in one shape and is dropped
 * in the other — not to model a real consumer value, because there no longer is one inside a shell.
 *
 * It used to be 94, `calc(var(--app-shell-header-height) + var(--basalt-page-bar-h))`, back when the
 * document scrolled under both. Both terms are gone: `AppShell.Main` is the scrollport
 * (`shell/app-main.module.css`) and BOTH the app header and `PageBar` row 2's band are shell regions
 * rendered outside it, so a sticky table header inside the scrollport wants `top: 0` and a consumer
 * passes nothing at all. A number kept here that LOOKED like a real offset would keep teaching the
 * wrong value to whoever reads this file next, so it is deliberately one that resembles neither.
 */
const PAGE_OFFSET = 37

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

/**
 * The wrapper's published state, read as the attribute rather than inferred from a computed
 * `overflow-x`: `useMeasuredContainment` writes the attribute and the stylesheet reads it, so the
 * attribute is the decision and the overflow is its consequence. A failure prints both.
 */
async function expectContained(p: LayoutPage, expected: boolean, why: string): Promise<void> {
  const actual = await p.raw.evaluate(
    (sel) => document.querySelector(sel)?.getAttribute('data-contained') ?? null,
    WRAPPER,
  )
  if (actual !== String(expected)) {
    const overflow = await p.computed(WRAPPER, 'overflow-x')
    throw new Error(
      `LAYOUT INVARIANT VIOLATED — ${why}.\n  expected: data-contained = ${String(expected)}\n` +
        `  actual:   data-contained = ${actual} (computed overflow-x: ${overflow})`,
    )
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
   * INVARIANT 3 — the PAGE-scroll case honours the offset, and its wrapper is BARE while the table
   * fits.
   *
   * Two claims in one test, because they are one decision. Every other table renders inside a
   * `Table.ScrollContainer` — that is what stops a wide table widening the page
   * (`no-horizontal-overflow.layout.test.ts`) — but a `stickyHeader` table with neither `maxHeight`
   * nor `minWidth` cannot take that container unconditionally: an `overflow-x: auto` box computes
   * `overflow-y` to `auto`, becomes the header's scrollport, and having no height cap has no scroll
   * range for the header to stick against. It takes the MEASURED wrapper instead, which is bare at
   * a width the table fits — so no scroller exists and the offset still reaches the `<thead>`.
   */
  test('a page-scrolled sticky header keeps its offset, and its wrapper stays bare', async () => {
    const p = await openFixture(
      { ...tableSpec(), table: { rows: 40, stickyHeaderOffset: PAGE_OFFSET } },
      PHONE,
    )
    if ((await p.count(SCROLLER)) !== 0) {
      throw new Error(
        'LAYOUT INVARIANT VIOLATED — a page-scrolled sticky header must not be wrapped in a ' +
          'scroll container: an uncapped `overflow-x` box has no scroll range, so the header ' +
          'stops sticking entirely.',
      )
    }
    await expectContained(p, false, 'a two-column table fits a 390px phone with room to spare')
    const top = await p.computed(THEAD, 'top')
    if (top !== `${PAGE_OFFSET}px`) {
      throw new Error(
        `LAYOUT INVARIANT VIOLATED — a page-scrolled sticky header must still clear the chrome ` +
          `inside its scrollport.\n  expected: thead top = ${PAGE_OFFSET}px\n  actual:   thead ` +
          `top = ${top}`,
      )
    }
  })

  /**
   * INVARIANT 4 — a FITTING table's header really does stick, and the wrapper is what lets it.
   *
   * The whole justification for measuring instead of always containing: while the table fits, its
   * wrapper declares no overflow at all, so the `<thead>`'s scrollport is `AppShell.Main` and it
   * pins to Main's own content top through a real scroll. Asserting the bare state without
   * asserting the STICK it buys would leave the trade unproven in the direction that matters.
   */
  test('a fitting table stays bare and its header pins to Main through a 400px scroll', async () => {
    // `stats` is not decoration: the table has to start BELOW Main's content top, or the `<thead>`
    // is already sitting on the sticky constraint at rest and the scroll below proves nothing.
    const p = await openFixture(
      { ...tableSpec(), table: { rows: 40 }, stats: 2, bodyHeight: 400 },
      DESKTOP,
    )
    await expectContained(p, false, 'a two-column table fits a 1440px viewport many times over')

    const before = await p.box('thead', THEAD)
    await p.raw.evaluate((sel) => {
      const element = document.querySelector(sel)
      if (element === null) throw new Error(`LAYOUT: no scrollport matched \`${sel}\``)
      element.scrollTo({ top: 400, behavior: 'instant' })
    }, MAIN)
    await p.settle()

    const main = await p.box('main', MAIN)
    const after = await p.box('thead', THEAD)
    if (!(after.box.top < before.box.top)) {
      throw new Error(
        'LAYOUT: the scroll was a no-op — the header never moved, so the stick below asserts ' +
          `nothing.\n  thead top before = ${before.box.top}, after = ${after.box.top}`,
      )
    }

    // Main's CONTENT top, not its border box: the sticky constraint resolves against the scrollport
    // minus its own padding, and Main carries `--app-shell-padding`.
    const contentTop = main.box.top + Number.parseFloat(await p.computed(MAIN, 'padding-top'))
    const scrollport = band("Main's content box", contentTop, main.box.bottom, after)
    expectGapAtMost(
      scrollport,
      after,
      'top',
      0.5,
      "a bare wrapper leaves `AppShell.Main` as the sticky header's scrollport — the `<thead>` " +
        "must pin to Main's content top, not ride away with the rows",
      DESKTOP,
    )
    expectFullyInside(
      after,
      scrollport,
      'a pinned header never leaves the scrollport it is pinned to',
      DESKTOP,
    )
  })

  /**
   * INVARIANT 5 — the same shape, too wide, contains ITSELF rather than the page.
   *
   * This is the half the old exemption did not have. An eight-column sticky table at 390px is wider
   * than Main; measured, its wrapper flips to `overflow-x: auto`, so the columns stay reachable by
   * horizontal scroll inside the card while the document and Main both stay honest. The sticky
   * header is inert at this width by construction — that is the trade, and it is why the flip is
   * measured rather than declared.
   */
  test('the same shape, too wide for a phone, contains itself instead of the page', async () => {
    // EIGHT columns, not the six the overflow guard's crowded page uses: six measured 372 against
    // a 364px wrapper, and an 8px margin is one font-metric change away from flipping the very
    // state this test names. The shape is identical; the reading is decisive.
    const p = await openFixture({ ...tableSpec(), table: { rows: 20, columns: 8 } }, PHONE)
    await expectContained(p, true, 'eight unbreakable columns cannot fit a 390px phone')
    expectNoHorizontalOverflow(
      await p.horizontalOverflow(),
      'a sticky, uncapped table must contain itself once it outgrows its column — the page may ' +
        'never be draggable sideways, whatever the header does',
      PHONE,
    )

    const scroll = await p.raw.evaluate((sel) => {
      const element = document.querySelector(sel)
      if (!element) throw new Error(`LAYOUT: no element matched \`${sel}\``)
      return { scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }
    }, WRAPPER)
    if (!(scroll.scrollWidth > scroll.clientWidth)) {
      throw new Error(
        'LAYOUT INVARIANT VIOLATED — a contained wrapper must actually scroll horizontally, or ' +
          'the columns past its right edge are unreachable rather than merely off-screen.\n' +
          `  wrapper scrollWidth = ${scroll.scrollWidth}, clientWidth = ${scroll.clientWidth}`,
      )
    }
  })
  /**
   * INVARIANT 6 — the toolbar SHRINKS, and shrinking did not cost the search its stated width.
   *
   * The fix for the toolbar overflow (`no-horizontal-overflow.layout.test.ts` guards the property)
   * was to make the toolbar a shrinkable flex item and turn the search's `w={220}` into a flex
   * BASIS. Both halves need pinning from this side: `flex: 0 1 220px` must still resolve to 220
   * wherever 220 is available — a `1 1` would have made the field grow with the table again, which
   * is the 600px search `SEARCH_WIDTH` was introduced to stop — and the whole toolbar must sit
   * inside Main on a phone rather than merely being narrower than it used to be.
   */
  const toolbarSpec: FixtureSpec = {
    sections: [
      { label: 'Main', items: [{ key: 'home', label: 'Home', mobile: 'tab', active: true }] },
    ],
    table: { rows: 8, columns: 6, stickyHeader: false, search: true, facets: 2 },
  }

  test('the search keeps its stated width where the width exists (desktop)', async () => {
    const p = await openFixture(toolbarSpec, DESKTOP)
    const search = await p.box('search', SEARCH)
    if (Math.abs(search.box.width - SEARCH_BASIS) > 0.5) {
      throw new Error(
        'LAYOUT INVARIANT VIOLATED — the toolbar search states a width so it does not grow with ' +
          `the table; the flex basis must resolve to it wherever it fits.\n  expected: ` +
          `${SEARCH_BASIS}px\n  actual:   ${search.box.width}px`,
      )
    }
  })

  test('the toolbar sits fully inside Main on a phone', async () => {
    const p = await openFixture(toolbarSpec, PHONE)
    const main = await p.box('main', MAIN)
    const toolbar = await p.box('toolbar', TOOLBAR)
    expectFullyInside(
      toolbar,
      main,
      "the toolbar is the header row's flex item — a 220px search beside a facet pill row must " +
        'wrap and shrink inside the column, never state 461px in a 302px one',
      PHONE,
    )
  })
})
