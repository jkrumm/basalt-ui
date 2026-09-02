/**
 * Layout invariants for the mobile bottom bar — the ones happy-dom is structurally incapable of
 * observing.
 *
 * THE DEFECT THAT BOUGHT THIS FILE: `<Drawer size="auto">` is a no-op on a bottom Drawer in Mantine
 * 9.3 — `getSize('auto')` emits `var(--drawer-size-auto)`, a custom property `@mantine/core`
 * defines nowhere, so the height fell through to `100%` and the sheet covered the whole viewport.
 * It survived a design pass, an adversarial multi-agent review and 1889 green tests, because not
 * one of those tests can see a pixel.
 *
 * ASSERTIONS ARE RELATIONS AND BOUNDS, NEVER EXACT PIXELS. A font-metric change must not turn this
 * suite red; a sheet that stops hugging its content must. Every number in a comment below is a
 * MEASURED value at 390x844 — read them as the audit trail for the bound above them.
 */
import { afterAll, describe, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  ACTIVE_PILL,
  ACTIVE_PILL_ICON,
  BAR,
  BAR_SLOTS,
  CONTENT_END,
  MENU,
  PHONE,
  PHONE_SMALL,
  SHEET,
  SHEET_BODY,
  SHEET_ROWS,
  above,
  CLOSE_BUDGET_MS,
  closeLayoutSuite,
  expectDoesNotScroll,
  expectFullyInside,
  expectGapAtMost,
  expectHeightAtLeast,
  expectHeightAtMost,
  expectNoNewOverlay,
  expectSameSize,
  expectScrolls,
  expectStrictlyIncreasing,
  initLayoutSuite,
  openFixture,
  tab,
} from './harness'

// Booted at MODULE TOP LEVEL, the same shape as `boot-color-scheme.layout.test.ts`. Not a
// `beforeAll`: Bun caps a hook at an undeclared 5000 ms and the cold boot measures ~4.4 s on a
// GitHub runner. `initLayoutSuite()` carries its own budget instead.
const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const pages = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => ({
    key: `${prefix}${i}`,
    label: `${prefix} page ${i + 1}`,
    short: `P${i + 1}`,
  }))

/** One link slot + one section slot holding `rows` destinations. Above `menuMax` ⇒ a SHEET. */
const sheetSpec = (rows: number, extra: Partial<FixtureSpec> = {}): FixtureSpec => ({
  nav: { maxTabs: 5, menuMax: 6 },
  sections: [
    { label: 'Home', items: [{ key: 'home', label: 'Home', mobile: 'tab', active: true }] },
    { label: 'Library', tab: true, items: pages(rows, 'lib') },
  ],
  ...extra,
})

/**
 * Three plain link slots, the first ACTIVE — the shape the active-pill invariants measure. No
 * surface slot: the pill is a property of a link slot, and a menu/sheet would only add mount cost.
 */
const pillSpec = (extra: Partial<FixtureSpec> = {}): FixtureSpec => ({
  nav: { maxTabs: 5 },
  sections: [
    {
      label: 'Main',
      items: [
        { key: 'home', label: 'Home', mobile: 'tab', active: true },
        { key: 'reports', label: 'Reports', mobile: 'tab' },
        { key: 'alerts', label: 'Alerts', mobile: 'tab' },
      ],
    },
  ],
  ...extra,
})

layout('mobile nav — real layout', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  /**
   * INVARIANT 1 — a short sheet hugs its content.
   *
   * THE regression. Measured at 390x844 with 7 rows (re-measured after the M4 row-height change —
   * rows are now 40px, not 46.25): sheet top 500, height 344, bottom 844 (flush), and still **18px**
   * of padding under the last row (unchanged — that gap comes from the Drawer's own `padding="md"` +
   * safe-area, not row height). Under the bug that gap was ~446 and the top was 0. The gap is the
   * sharp assertion; the height bound is the blunt backstop.
   */
  test('a 7-row sheet hugs its content instead of filling the viewport', async () => {
    const p = await openFixture(sheetSpec(7))
    await p.tap(tab('Library'))
    await p.waitFor(SHEET)

    const sheet = await p.box('sheet', SHEET)
    const rows = await p.boxes(SHEET_ROWS)
    const last = rows.at(-1)
    if (!last)
      throw new Error('LAYOUT: the sheet rendered no rows — fixture or projection is wrong')
    const lastRow = { name: 'last row', box: last }

    expectGapAtMost(
      sheet,
      lastRow,
      'bottom',
      40, // measured 18
      'the sheet must hug its content: only padding + safe-area may sit under the last row',
      p.viewport,
    )
    expectHeightAtMost(
      sheet,
      p.viewport.height * 0.6, // 506.4; measured 344
      'a 7-row sheet must not occupy most of the viewport — `height: auto` is what lets it hug',
      [lastRow],
      p.viewport,
    )
    expectFullyInside(
      sheet,
      p.bounds(),
      'the sheet must fit the viewport it rises into',
      p.viewport,
    )
    // It is still a BOTTOM sheet, flush to the bottom edge (measured: bottom === 844).
    expectGapAtMost(p.bounds(), sheet, 'bottom', 1, 'a bottom sheet sits on the viewport floor')
    // And it does not scroll: measured scrollHeight 286 === clientHeight 286.
    expectDoesNotScroll(
      'sheet body',
      await p.scroll(SHEET_BODY),
      'a sheet that fits its content must not present a scroller',
    )
  })

  /**
   * INVARIANT 1B (small phone) — the same 7-row sheet, but at 320x568 against the 70dvh cap
   * (397.6). Before the M4 row-height change this was the viewport where the cap and the sheet's
   * natural content height met almost exactly (397.8 vs 397.6, no headroom to spare); at the new
   * 40px row height the natural content height is 344, comfortably under the cap, so this invariant
   * is no longer the tight case — kept anyway as the smallest supported viewport. INVARIANT 1's
   * `40`/`0.6×height` bounds assume the headroom PHONE has and do not transfer — what must hold
   * here instead is the pair that always holds regardless of which law is binding: never past the
   * cap, never spilling the viewport, still flush to the bottom edge.
   */
  test('a 7-row sheet still respects the cap at the small-phone viewport', async () => {
    const p = await openFixture(sheetSpec(7), PHONE_SMALL)
    await p.tap(tab('Library'))
    await p.waitFor(SHEET)

    const sheet = await p.box('sheet', SHEET)
    expectHeightAtMost(
      sheet,
      p.viewport.height * 0.7 + 1, // 397.6
      'the 70dvh cap must hold even where it sits right on top of the natural content height',
      [],
      p.viewport,
    )
    expectFullyInside(
      sheet,
      p.bounds(),
      'the sheet fits the smallest supported viewport',
      p.viewport,
    )
    expectGapAtMost(p.bounds(), sheet, 'bottom', 1, 'a bottom sheet sits on the viewport floor')
  })

  /**
   * INVARIANT 2 — a long sheet caps and scrolls INTERNALLY rather than growing.
   *
   * Two independent laws: `.sheet { max-height: min(70dvh, 100%) }` (unlayered CSS module) caps the
   * whole sheet, and `ScrollArea.Autosize mah="62dvh"` inside decides when scrolling starts.
   * Measured at 390x844 with 30 rows (re-measured after the M4 row-height change): sheet height
   * 581.27 against a 590.8 cap; body scrollHeight 1229 vs clientHeight 523; page scrollHeight 844
   * === clientHeight 844. Every bound below is a
   * formula over `p.viewport`, so parameterizing over a smaller viewport is free — PHONE_SMALL is
   * where the cap is tightest and the scroller has the least room to prove itself.
   *
   * A sheet that grows past the cap and a sheet that caps but clips its overflow are DIFFERENT
   * bugs. Both halves are asserted.
   */
  for (const viewport of [PHONE, PHONE_SMALL] as const) {
    test(`a 30-row sheet caps at 70dvh and scrolls inside itself (${viewport.name})`, async () => {
      const p = await openFixture(sheetSpec(30), viewport)
      await p.tap(tab('Library'))
      await p.waitFor(SHEET)

      const sheet = await p.box('sheet', SHEET)
      const body = await p.box('sheet body', SHEET_BODY)

      expectHeightAtMost(
        sheet,
        p.viewport.height * 0.7 + 1, // 591.8 @ PHONE; measured 585.27
        'the sheet caps at 70dvh instead of growing with its row count',
        [body],
        p.viewport,
      )
      expectFullyInside(sheet, p.bounds(), 'a capped sheet still fits the viewport', p.viewport)
      expectScrolls(
        'sheet body',
        await p.scroll(SHEET_BODY),
        'a long sheet scrolls INSIDE its ScrollArea.Autosize (mah="62dvh"), never by growing',
      )
      expectDoesNotScroll(
        'page',
        await p.scroll('page'),
        'the page behind an open sheet must not become the scroller',
      )
      const firstRow = (await p.boxes(SHEET_ROWS))[0]
      if (!firstRow) throw new Error('LAYOUT: the sheet rendered no rows')
      expectFullyInside(
        { name: 'first row', box: firstRow },
        sheet,
        'every row is clipped by the sheet, not spilling past its edge',
        p.viewport,
      )
    })
  }

  /**
   * INVARIANT 3 — tapping a `link` slot mounts NO overlay. The core promise of the redesign: a
   * destination navigates; it does not raise chrome.
   *
   * A census DIFF, not an absolute count — Mantine mounts portal hosts for its own reasons, so an
   * absolute assertion is either brittle or vacuously true. And the navigation is asserted too: a
   * tap that raised nothing because it did nothing is not the invariant. Measured: census
   * unchanged, `basaltNavigations` === ['/reports'].
   */
  test('tapping a link slot navigates and raises neither a Drawer nor a Menu', async () => {
    const p = await openFixture({
      nav: { maxTabs: 5 },
      sections: [
        {
          label: 'Main',
          items: [
            { key: 'home', label: 'Home', mobile: 'tab', active: true },
            { key: 'reports', label: 'Reports', mobile: 'tab' },
            { key: 'alerts', label: 'Alerts', mobile: 'tab', count: 3 },
          ],
        },
      ],
    })

    const before = await p.census()
    await p.tap(tab('Reports'))
    // Give any overlay a real chance to mount: a tap's own settle() only covers its call-stack
    // frames, but Floating UI positions on its own effect, off that call stack. `quiesce()` waits
    // for the DOM to actually go quiet instead of guessing a fixed duration.
    await p.quiesce()
    const after = await p.census()

    expectNoNewOverlay(
      before,
      after,
      'a link slot IS the destination — reaching a page costs one tap and mounts nothing to dismiss',
    )
    const navigated = await p.navigations()
    if (navigated.at(-1) !== '/reports') {
      throw new Error(
        `LAYOUT: tapping the "Reports" slot must navigate to /reports; the anchor recorded ` +
          `${JSON.stringify(navigated)}. An empty string means the router seam stopped forwarding.`,
      )
    }
    for (const selector of [SHEET, MENU]) {
      const n = await p.count(selector)
      if (n !== 0) throw new Error(`LAYOUT: ${n} \`${selector}\` node(s) exist after a link tap`)
    }
    // The bar itself is untouched — no surface pushed it, no layout shift.
    expectGapAtMost(
      p.bounds(),
      await p.box('bar', BAR),
      'bottom',
      1,
      'a link tap must not move the bar',
    )
  })

  /**
   * INVARIANT 4 — a tab menu never renders below the fold, on the first slot or the last. The menu
   * runs `flip: false` (flipping a bottom-anchored menu puts it UNDER the footer), so `menuMax` is
   * the only thing guaranteeing it fits. Measured, 4 rows: last slot → x 150, right 382, bottom
   * 781; first slot → x 8, right 240; bar top 788 in both. Every bound is relative to `p.viewport`,
   * so PHONE_SMALL is the sharper proof: the least headroom above the bar of any supported phone.
   */
  for (const viewport of [PHONE, PHONE_SMALL] as const) {
    for (const slot of ['first', 'last'] as const) {
      test(`a 4-row menu on the ${slot} slot stays inside the viewport, above the bar (${viewport.name})`, async () => {
        const group = { label: 'Library', tab: true as const, items: pages(4, 'lib') }
        const home = {
          label: 'Home',
          items: [{ key: 'home', label: 'Home', mobile: 'tab' as const, active: true }],
        }
        const p = await openFixture(
          {
            nav: { maxTabs: 5, menuMax: 6 },
            sections: slot === 'first' ? [group, home] : [home, group],
          },
          viewport,
        )
        await p.tap(tab('Library'))
        await p.waitFor(MENU)

        const menu = await p.box('menu', MENU)
        const bar = await p.box('bar', BAR)
        expectFullyInside(
          menu,
          above(bar, p.viewport),
          '`flip: false` means a menu that does not fit is simply off-screen — menuMax must keep it ' +
            'above the bar and inside the viewport',
          p.viewport,
        )
      })
    }
  }

  /**
   * INVARIANT 5 — no content is trapped under the bar. Mantine sets `--app-shell-footer-offset` to
   * the RAW footer height, so `AppShell.Main`'s padding-bottom is short by exactly one safe-area
   * inset; `.main`'s own `margin-bottom` calc (`app-main.module.css`) adds it back. Measured: main
   * padding-bottom 69px, content-end bottom 775.25, bar top 788 — clears by 12.75px.
   */
  test('scrolled to the end, the last content pixel sits above the bar', async () => {
    const p = await openFixture(sheetSpec(3, { bodyHeight: 4000 }))
    await p.scrollToEnd()

    const bar = await p.box('bar', BAR)
    expectFullyInside(
      await p.box('content end', CONTENT_END),
      above(bar, p.viewport),
      'AppShell.Main padding-bottom + .main margin-bottom must clear the footer — no content may ' +
        'hide under the bar',
      p.viewport,
    )
  })

  /**
   * INVARIANT 6 — touch targets hold their floors at every density level. `deriveSpacing` clamps
   * `mobileNavBarHeight` with `Math.max(49, …)` and `mobileNavRowHeight` with `Math.max(40, …)`
   * (tokens/palette.ts — the row floor moved from 44 to 40, the WCAG 2.5.5 AA figure, once the
   * sheet's rows switched to the sidebar's own row-inset vocabulary; the AAA-figure floor stays on
   * `mobileNavBarHeight`, unchanged). This is the end-to-end proof that the floor survives
   * derive → CSS var → Mantine inline styles → cascade — the row now clears it purely via
   * `min-height`, since the sidebar's own padding + line-height no longer produce a taller row on
   * their own the way the old bespoke touch padding did.
   *
   * The region seam (docs/DESIGN-SPEC.md §5) is drawn by Mantine's `[data-with-border]` rule
   * directly on the `AppShell.Footer` box that `mobileNavBarHeight` sizes, not by `.bar` itself —
   * under the global `box-sizing: border-box` the 1px `border-top` is carved out of THAT box, so
   * `.bar` (height: 100% of the footer's content box) renders 1px short of the raw floor. The
   * `Math.max(49, …)` buys the pixel the seam claims back; a slot no longer loses a further pixel
   * of its own, since the border moved off `.bar`.
   *
   * Measured (bar / min slot / min sheet row), re-measured after the M4 row-height change: d=−3 →
   * 48 / 48 / 40; d=0 → 55 / 55 / 40; d=+3 → 72 / 72 / 52. The row is floor-bound (exactly 40) at
   * d=−3 and d=0 — the sidebar's own row-inset padding no longer produces a taller row on its own —
   * and content-bound (52, past the floor) at d=+3, where the density-scaled padding + line-height
   * exceed it. Bar and slot are unchanged from before this minor.
   *
   * One page, three remounts: remounting is ~5x cheaper than a new browser context.
   */
  test('touch targets hold the 40/44/48px floors at density −3, 0 and +3', async () => {
    const p = await openFixture(sheetSpec(7))
    for (const density of [-3, 0, 3]) {
      await p.remount(sheetSpec(7, { density }))

      expectHeightAtLeast(
        await p.box(`bar @density ${density}`, BAR),
        48,
        'the bar keeps its 48px floor at every density level',
      )
      // The BAR (`nav[aria-label="Primary"]`) sits INSIDE the `AppShell.Footer` box that
      // `mobileNavBarHeight` actually sizes — Mantine draws the region-seam `border-top` on the
      // footer, not on `.bar`, so `.bar` (height: 100% of the footer's content box) renders 1px
      // short of the raw floor under `box-sizing: border-box`. A bare `>= 48` on the bar alone
      // cannot tell the fixed `Math.max(49, …)` floor apart from the old `Math.max(48, …)` bug —
      // both leave `.bar` at 48 (from 47+1 pre-fix, exactly 48 post-fix). The FOOTER box itself is
      // the sharp assertion: it was 48 under the bug and must be 49 now.
      expectHeightAtLeast(
        await p.box(`footer @density ${density}`, '.mantine-AppShell-footer'),
        49,
        'the AppShell.Footer box mobileNavBarHeight sizes keeps its OWN 49px floor — the pixel ' +
          'the border-top seam claims back from .bar',
      )
      const slots = await p.boxes(BAR_SLOTS)
      for (const [i, box] of slots.entries()) {
        expectHeightAtLeast(
          { name: `slot ${i} @density ${density}`, box },
          44,
          'every bar slot keeps the 44px touch-target floor at every density level',
        )
      }

      await p.tap(tab('Library'))
      await p.waitFor(SHEET)
      const rows = await p.boxes(SHEET_ROWS)
      if (rows.length !== 7) {
        throw new Error(
          `LAYOUT: expected 7 sheet rows, saw ${rows.length}. If this is 15, the row selector ` +
            'lost its drawer scope and is measuring the hidden desktop sidebar.',
        )
      }
      for (const [i, box] of rows.entries()) {
        expectHeightAtLeast(
          { name: `row ${i} @density ${density}`, box },
          40,
          'every sheet row keeps the 40px touch-target floor at every density level',
        )
      }
      await p.dismiss()
    }
  })

  /**
   * INVARIANT 7 — the active indicator survives an icon-less consumer.
   *
   * basalt ships no icon dependency and supports a consumer that ships none either (image-share
   * does). The pill is the icon span's OWN background, so with nothing inside it the span
   * collapsed: measured at 390x844, **24x4px** — a dash, at every density level, against the
   * 48x28 pill an icon-carrying app gets. The fix floors the icon slot at the icon box plus its
   * inset, so the pill's box no longer depends on its contents.
   *
   * The sharp assertion is the EQUALITY: an icon-less bar must render the same indicator as an
   * icon-carrying one. The proportional floor underneath it is the blunt backstop that a
   * re-collapse (4/56 = 0.07 of the bar) fails on its own.
   */
  test('the active pill is identical with and without an icon, at every density', async () => {
    const p = await openFixture(pillSpec())

    for (const density of [-3, 0, 3]) {
      await p.remount(pillSpec({ density }))
      const withIcon = await p.box(`pill with icon @density ${density}`, ACTIVE_PILL)

      await p.remount(pillSpec({ icons: false, density }))
      const withoutIcon = await p.box(`pill icon-less @density ${density}`, ACTIVE_PILL)
      const bar = await p.box(`bar @density ${density}`, BAR)

      expectSameSize(
        withoutIcon,
        withIcon,
        'an icon-less consumer must get the same active indicator — the pill is the icon slot ' +
          "background, so it may not depend on the slot's contents",
      )
      // Measured: 28 of 56 (d=0), 19 of 48 (d=−3), 37 of 73 (d=+3) — never below 0.39. The
      // collapsed dash was 4 of 56 = 0.07.
      expectHeightAtLeast(
        withoutIcon,
        bar.box.height * 0.3,
        'a pill that is a thin dash against the bar it sits in is not an indicator',
      )
    }
  })

  /**
   * INVARIANT 8 — the pill's INSET tracks density, not just its total size.
   *
   * `padding: 2px 12px` was untokenized, so at any non-zero density the glyph scaled and its
   * inset did not. That is invisible to a "did the pill get bigger?" assertion, because the pill
   * did get bigger — measured pre-fix, the horizontal inset was 12px at density −3, 0 AND +3
   * while the glyph went 17 → 24 → 31. So the assertion is on the inset itself, derived as
   * (pill − glyph) / 2 in each axis.
   *
   * Measured post-fix at 390x844 — horizontal 8 / 12 / 16, vertical 1 / 2 / 3 at density −3 / 0 /
   * +3, against a glyph of 17 / 24 / 31.
   */
  test('the active pill inset scales with density instead of staying frozen', async () => {
    const p = await openFixture(pillSpec())
    const horizontal: [string, number][] = []
    const vertical: [string, number][] = []

    for (const density of [-3, 0, 3]) {
      await p.remount(pillSpec({ density }))
      const pill = await p.box(`pill @density ${density}`, ACTIVE_PILL)
      const glyph = await p.box(`glyph @density ${density}`, ACTIVE_PILL_ICON)
      horizontal.push([`density ${density}`, (pill.box.width - glyph.box.width) / 2])
      vertical.push([`density ${density}`, (pill.box.height - glyph.box.height) / 2])
    }

    expectStrictlyIncreasing(
      'pill horizontal inset',
      horizontal,
      'the 12px pill inset must ride `--vx-space-mobile-nav-tab-inset-x` — frozen, the whole bar ' +
        'scales around a pill that does not',
    )
    expectStrictlyIncreasing(
      'pill vertical inset',
      vertical,
      'the 2px pill inset must ride `--vx-space-mobile-nav-tab-inset-y` for the same reason',
    )
  })

  /**
   * INVARIANT 9 (M5) — symmetric row insets, without reopening the M4 overlap invariant.
   *
   * `offsetScrollbars="present"` reserves its gutter INSIDE the Drawer body, on top of the body's
   * own symmetric `padding="md"` (18px) — before this fix that measured 18px left / 30px right (18
   * body padding + the then-12px default gutter). `scrollbarSize={8}` plus trimming the body's own
   * right inset by that same 8px (`.sheet :global(.mantine-Drawer-body)` in the CSS module) puts
   * both sides back at 18px: 10 trimmed body padding + 8 gutter = 18, matching the untouched left
   * side. The gutter still reserves real space past the row's own right edge — only its WIDTH
   * moved, not whether it reserves one — so the thumb must never intersect a row while scrolling.
   */
  test("the sheet's row insets are symmetric, and the scrollbar gutter never overlaps a row", async () => {
    const p = await openFixture(sheetSpec(30))
    await p.tap(tab('Library'))
    await p.waitFor(SHEET)

    const sheet = await p.box('sheet', SHEET)
    const rows = await p.boxes(SHEET_ROWS)
    if (rows.length === 0) throw new Error('LAYOUT: the sheet rendered no rows')

    for (const [i, row] of rows.entries()) {
      const leftInset = row.left - sheet.box.left
      const rightInset = sheet.box.right - row.right
      if (Math.abs(leftInset - rightInset) > 1) {
        throw new Error(
          `LAYOUT: row ${i} insets are not symmetric — left ${leftInset.toFixed(2)}px vs right ` +
            `${rightInset.toFixed(2)}px (must match within 1px).`,
        )
      }
    }

    // Force the thumb to actually paint (`type="scroll"` shows it on interaction, not at rest),
    // then read every row's box again — the invariant is that it never overlaps one WHILE SCROLLING,
    // not merely at the moment the sheet opens.
    await p.raw.evaluate(() => {
      const viewport = document.querySelector(
        '.mantine-Drawer-content .mantine-ScrollArea-viewport',
      )
      if (viewport) viewport.scrollTop = 200
    })
    await p.raw.mouse.move(sheet.box.right - 4, sheet.box.top + 200)
    await p.raw.waitForTimeout(150)

    const track = await p.box('vertical scrollbar track', `${SHEET} [data-orientation="vertical"]`)
    const scrolledRows = await p.boxes(SHEET_ROWS)
    const overlapping = scrolledRows.filter(
      (row) => row.right > track.box.left + 0.5 && row.left < track.box.right - 0.5,
    )
    if (overlapping.length > 0) {
      throw new Error(
        `LAYOUT: ${overlapping.length} row(s) overlap the scrollbar track ` +
          `[${track.box.left.toFixed(2)}, ${track.box.right.toFixed(2)}] while scrolling.`,
      )
    }
  })
})
