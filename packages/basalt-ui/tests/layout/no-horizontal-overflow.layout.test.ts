/**
 * NOTHING SCROLLS SIDEWAYS ON A PHONE — the guard, not a component test.
 *
 * THE DEFECT THAT BOUGHT THIS FILE: `/dashboard` at 390x844 measured
 * `document.documentElement.scrollWidth = 461` against `innerWidth = 390`. The culprit was a bare
 * five-column `BasaltDataTable` — no `minWidth`, so `scrolls` was false and the component rendered
 * the `<table>` with nothing around it. A `<table>` sizes to its own min-content (448px measured),
 * so it widened the page and every fixed/sticky thing on it, and the whole app could be dragged
 * sideways. Neither `bun test` file for that component could see it: a `<table>`'s intrinsic width
 * is a layout outcome and happy-dom has no layout.
 *
 * WHY IT STAYS. The fix is one component's, the failure mode is the library's — `min-width: 0` is
 * missing by default in every flex and grid chain, and a nowrap control row, a measured chart, a
 * KPI card and a wide table are four independent ways back into it. So this file mounts all four AT
 * ONCE at the two narrowest supported viewports and asserts the property, not the remedy: whichever
 * of them regresses, the harness prints the widest boxes and the failure names the element.
 *
 * The two readings in `expectNoHorizontalOverflow` are both load-bearing. `AppShell.Main` carries
 * `overflow-x: auto` (never `hidden`/`clip` — hiding the overflow would make this guard vacuous),
 * so a too-wide child now widens MAIN and leaves the document honest. Asserting only the document
 * would have gone green on the very defect above, one shell rework later.
 */
import { afterAll, describe, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { Viewport } from './harness'
import {
  CLOSE_BUDGET_MS,
  PHONE,
  PHONE_SMALL,
  closeLayoutSuite,
  expectNoHorizontalOverflow,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

/**
 * One page carrying every shape that can widen it, at once — a shell, a page bar with four pills
 * and three actions, a two-card KPI row with bled sparklines, a six-column table with NO `minWidth`
 * (the defect's exact shape), and a real cartesian chart with three series.
 *
 * `stickyHeader: false` is deliberate and is the one knob a reader might question: it exercises the
 * DEFAULT containment path, the static `Table.ScrollContainer` every non-sticky table takes. A
 * page-scrolled sticky header reaches the same guarantee down a different road — a wrapper whose
 * overflow is MEASURED (`useMeasuredContainment` in `data/data-table.tsx`) — and gets its own test
 * below rather than being folded in here, because one fixture can only mount one table and the two
 * roads are worth failing separately.
 */
const CROWDED: FixtureSpec = {
  sections: [
    {
      label: 'Main',
      items: [
        { key: 'home', label: 'Home', mobile: 'tab', active: true },
        { key: 'reports', label: 'Reports', mobile: 'tab' },
        { key: 'settings', label: 'Settings', mobile: 'more' },
      ],
    },
  ],
  bar: { pills: 4, actions: 3 },
  stats: 2,
  table: { rows: 12, columns: 6, stickyHeader: false, search: true, facets: 2 },
  charts: { kind: 'multiLine', legendEntries: 3, height: 200 },
}

/**
 * The Android-class width the two production pages were both caught at. 390 and 320 were already
 * covered; 360 is where `/dashboard` measured 362 against 360 — a two-pixel breach, which is the
 * size a guard misses when it only samples the extremes.
 */
const PHONE_360: Viewport = { name: 'Android 360', width: 360, height: 780 }

/**
 * The `/data` page's shape: a table carrying the full toolbar and nothing else to blame. The
 * crowded page above proves the property under everything at once; this one names the component
 * when it is the table's own header row that breaks, instead of printing a chart and a KPI card
 * beside it.
 */
const DATA: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'home', label: 'Home', mobile: 'tab', active: true }] },
  ],
  table: { rows: 12, columns: 6, stickyHeader: false, search: true, facets: 2 },
}

layout('no horizontal overflow on a phone', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const viewport of [PHONE, PHONE_360, PHONE_SMALL]) {
    test(`a crowded page fits its width (${viewport.name})`, async () => {
      const p = await openFixture(CROWDED, viewport)
      await p.settle()
      expectNoHorizontalOverflow(
        await p.horizontalOverflow(),
        'a phone page must never scroll sideways — a box that outgrows its column drags the whole ' +
          'app with it, and every sticky and fixed element on the page detaches from the content',
        viewport,
      )
    })
  }

  /**
   * THE TABLE TOOLBAR — the second offender this file caught, and it was never the `<table>`.
   *
   * MEASURED at 390x844 on `/data`: `main.scrollWidth` 505 against a `clientWidth` of 390. The
   * culprit was the toolbar `Group` — a 220px search field beside a 230px facet pill row, gap 11,
   * so a 461px max-content box in a 302px column. It could not shrink: the toolbar carried
   * `flex: 0 0 auto` and `min-width: auto`, and `CtlSlot` between it and the header row is
   * `display: contents`, so the toolbar IS the header row's flex item and its refusal to shrink was
   * the page's width. `/dashboard` at 360 read 362 against 360 for the same reason with one pill.
   *
   * Both pages' shapes are asserted at both widths, because the two breaches were different sizes —
   * 115px and 2px — and a guard that only samples the extreme misses the one that reads as a
   * rounding error.
   */
  for (const viewport of [PHONE, PHONE_360]) {
    test(`the table toolbar shrinks instead of widening the page (${viewport.name})`, async () => {
      const p = await openFixture(DATA, viewport)
      await p.settle()
      expectNoHorizontalOverflow(
        await p.horizontalOverflow(),
        'the toolbar is a flex ITEM of the table header row (CtlSlot between them is ' +
          '`display: contents`) — it must shrink and wrap its search and pills, never state a ' +
          'width the column cannot pay',
        viewport,
      )
    })
  }

  /**
   * The sticky, UNCAPPED table — the shape that used to be exempt from this guard entirely, and the
   * reason it is not any more. It cannot take the static scroll container (an `overflow-x` box
   * computes `overflow-y` to `auto`, and with no height cap it has no scroll range, so the header
   * goes inert), so its wrapper measures instead: bare while the table fits, `overflow-x: auto`
   * once it does not. Six unbreakable columns at 390px is firmly the second case, and the page must
   * come out exactly as honest as the non-sticky one above.
   *
   * The header IS inert at this width — that trade is asserted where it belongs, in
   * `data-table.layout.test.ts`. What belongs here is only the property this file guards.
   */
  test('a sticky, uncapped table contains itself too — the exemption is gone', async () => {
    const p = await openFixture(
      { ...CROWDED, table: { rows: 12, columns: 6, stickyHeader: true } },
      PHONE,
    )
    await p.settle()
    expectNoHorizontalOverflow(
      await p.horizontalOverflow(),
      'a page-scrolled sticky header buys no exemption from containment — a table wider than its ' +
        'column must scroll inside its own wrapper, whatever that costs the header',
      PHONE,
    )
  })

  /**
   * The same page with the table's `minWidth` FLOOR set. The floor is what a consumer reaches for
   * to keep eight columns readable, and it must contain the table just as well as the default does
   * — the container is the same node either way, and only the `--table-min-width` differs.
   */
  test('a minWidth floor contains the table too, it does not exempt it', async () => {
    const p = await openFixture(
      { ...CROWDED, table: { rows: 12, columns: 6, minWidth: 900, stickyHeader: false } },
      PHONE,
    )
    await p.settle()
    expectNoHorizontalOverflow(
      await p.horizontalOverflow(),
      'a `minWidth` table scrolls INSIDE its own card; the floor is a minimum width for the table, ' +
        'never a licence for the page to grow to it',
      PHONE,
    )
  })
})
