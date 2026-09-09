/**
 * Layout invariants for `PageAside`'s two projections — law C9's ONE declared exception
 * (`docs/CONTROLS-SPEC.md` §1, `docs/ASIDE-SPEC.md` §0).
 *
 * WHY A BROWSER. The aside is the only component in the package that picks its projection from a
 * JS viewport read instead of `visibleFrom`/`hiddenFrom`, and the exception is granted on ONE
 * promise: whichever projection is live, the panel's children are mounted exactly once. happy-dom
 * cannot test that promise — its `matchMedia` answers for a single hard-coded width, so
 * `page-aside.test.tsx` has to STUB the phone and can never observe the two widths against the
 * same tree, let alone the `AppShell.Aside` column the desktop half lands in (which has no width
 * at all without a layout engine).
 *
 * The mount count is the load-bearing assertion. A CSS twin — the shape C9 mandates everywhere
 * else — would render the children in both halves and the page would carry two `[data-mounts]`
 * nodes, each bound control subscribing to its field twice. One node reading `1` is what says the
 * exception is being paid for.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { Viewport } from './harness'
import {
  CLOSE_BUDGET_MS,
  PHONE,
  closeLayoutSuite,
  expectFullyInside,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const DESKTOP: Viewport = { name: 'desktop', width: 1440, height: 900 }

/** Mantine's static class name for the aside region — the same coupling `harness.ts` documents. */
const ASIDE = 'aside.mantine-AppShell-aside'
/** `PageBar` row 2 inside a shell: the sticky wrapper, which is where the `Panel` pill lives. */
const ROW_2 = '[data-basalt-page-bar="shell"]'
/** The aside's own node, in either of the two forms it paints. */
const PANEL = '[data-basalt-page-aside]'
const PROBE = '[data-testid="aside-probe"]'
/**
 * The aside's phone trigger, matched STRUCTURALLY: the pills line's only direct-child `button`.
 *
 * It used to be `button[aria-label="Composition"]`, and that selector is gone for a good reason
 * rather than a convenient one. The pill now renders as `<FilterPill label={panel.title}>` — it
 * NAMES ITS CONTENT instead of the region, which is `docs/ASIDE-SPEC.md` §0's own rule and the
 * point of the change. `FilterPill` only writes the `aria-label` ATTRIBUTE when an `ariaLabel` prop
 * is passed, so the accessible name is now computed from the button's text: correct for a screen
 * reader, and invisible to an attribute selector.
 *
 * Matching it by text is not available here: `LayoutPage.count`/`.box` run
 * `document.querySelector` inside the page (see `harness.ts`), so the selector must be real CSS and
 * CSS cannot read text. Playwright's `:has-text()` engine would only work in `tap`/`waitFor`, and a
 * constant that means two different things in two methods is worse than either. The structure is
 * exact instead: `page-bar.tsx` puts filters in `.filters`, the trailing actions in `.filtersEnd`
 * and this pill bare — so `> button` is the panel pill and nothing else. The TEXT is asserted
 * separately, in INVARIANT 2, which is where it belongs.
 */
const PANEL_PILL = '[data-basalt-page-bar-line="pills"] > button'

/** The aside's title, and therefore the phone pill's visible label — asserted in INVARIANT 2. */
const ASIDE_TITLE = 'Composition'

const ASIDE_SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'home', label: 'Home', mobile: 'tab', active: true }] },
  ],
  aside: { title: ASIDE_TITLE },
}

layout('PageAside projections — real layout', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  /**
   * INVARIANT 1 — at 1440 the panel IS the aside region's content, and the page bar holds none of
   * it. Both directions are asserted: a descendant count inside each region (which projection is
   * live) and a geometric containment (the panel really occupies the column, rather than merely
   * being parented into a zero-width one).
   */
  test('desktop 1440: the panel is inside AppShell.Aside and nothing of it is in the page bar', async () => {
    const p = await openFixture(ASIDE_SPEC, DESKTOP)

    expect(await p.count(`${ASIDE} ${PROBE}`)).toBe(1)
    expect(await p.count(`${ROW_2} ${PROBE}`)).toBe(0)
    // The pill is the PHONE trigger. Its absence here is what makes "one node at a time" true from
    // the bar's side — row 2 itself is mounted (the fixture gives it filters), so this is not a
    // vacuous query against a bar that does not exist.
    expect(await p.count(ROW_2)).toBe(1)
    expect(await p.count(`${ROW_2} ${PANEL_PILL}`)).toBe(0)

    const aside = await p.box('aside region', ASIDE)
    const panel = await p.box('panel', `${ASIDE} ${PANEL}`)
    expectFullyInside(
      panel,
      aside,
      'the portalled panel fills the aside region — a panel wider than its column is the G13 ' +
        'overflow the region exists to remove',
      DESKTOP,
    )
    expect(aside.box.width).toBeGreaterThan(0)
  })

  /**
   * INVARIANT 2 — at 390 the aside region is gone and the panel is a pill in row 2. The region's
   * node still EXISTS (Mantine collapses it, it does not unmount it), which is exactly why the
   * assertion counts the panel inside it rather than the region itself.
   */
  test('phone 390: nothing is in the aside — row 2 carries the Panel pill instead', async () => {
    const p = await openFixture(ASIDE_SPEC, PHONE)

    expect(await p.count(`${ASIDE} ${PANEL}`)).toBe(0)
    // Projected, so there is no panel node ANYWHERE until the sheet opens — not the portalled form
    // and not the in-flow one (law C9: one node at a time).
    expect(await p.count(PANEL)).toBe(0)
    expect(await p.count(PROBE)).toBe(0)

    expect(await p.count(`${ROW_2} ${PANEL_PILL}`)).toBe(1)
    const pill = await p.box('Panel pill', `${ROW_2} ${PANEL_PILL}`)
    // The pill carries the ASIDE'S TITLE, and specifically not the word "Panel" — both halves are
    // the assertion. `docs/ASIDE-SPEC.md` §0: a label names the CONTENT, never the region. A phone
    // user reading "Panel" for an aside called "Composition" is being told which BOX it is, which
    // they can see, instead of what is in it, which they cannot. The negative is pinned because
    // that is the regression with a name: the pill shipped as `label="Panel"` for a whole wave.
    const pillText = await p.raw.textContent(`${ROW_2} ${PANEL_PILL}`)
    expect(pillText).toContain(ASIDE_TITLE)
    expect(pillText).not.toContain('Panel')
    expectFullyInside(
      pill,
      p.bounds(),
      'the aside trigger is reachable on the narrowest supported phone, not pushed off row 2',
      PHONE,
    )
  })

  /**
   * INVARIANT 3 — the promise C9's exception is granted on: ONE live instance of the aside's
   * children at each width, mounted ONCE.
   *
   * `live` is what a CSS twin would break (both halves rendered, every bound control subscribed
   * twice); `total` is what a churning projection would break, and it did — the phone read 2
   * before `PageAside` learned to wait one commit for `PageBar`'s row-2 claim, because the
   * pre-claim pass rendered the wave-1 in-flow form, mounted these children and dropped them again
   * before paint. Assert both, or the two failure shapes are indistinguishable.
   */
  test('the panel children mount exactly once at each width', async () => {
    const desktop = await openFixture(ASIDE_SPEC, DESKTOP)
    expect(await desktop.count(PROBE)).toBe(1)
    expect(await desktop.count('[data-mounts="1"]')).toBe(1)
    expect(await desktop.raw.evaluate(() => window.basaltAsideMounts)).toEqual({
      total: 1,
      live: 1,
    })

    const phone = await openFixture(ASIDE_SPEC, PHONE)
    // Projected and closed: the children are not merely hidden, they were never mounted.
    expect(await phone.raw.evaluate(() => window.basaltAsideMounts)).toEqual({ total: 0, live: 0 })

    await phone.tap(`${ROW_2} ${PANEL_PILL}`)
    await phone.waitFor(PROBE)
    await phone.quiesce()

    expect(await phone.count(PROBE)).toBe(1)
    expect(await phone.count('[data-mounts="1"]')).toBe(1)
    expect(await phone.raw.evaluate(() => window.basaltAsideMounts)).toEqual({ total: 1, live: 1 })
    // …and opening the sheet did not also revive the in-flow form the wave-1 branch renders.
    expect(await phone.count(`${ASIDE} ${PROBE}`)).toBe(0)
  })

  /**
   * INVARIANT 4 — the aside header's own bottom seam meets the shell's page-bar band seam, so the
   * two 1px `--vx-divider` hairlines read as ONE line rather than two 9px apart (MEASURED on
   * `/cbbi` 1440x900 before the fix: band bottom y87, aside header bottom y96).
   *
   * The band's PAINTED bottom edge is `ROW_2`'s outer wrapper (`app-main.module.css`'s `.band`,
   * the `PageBarBandOutlet` `ROW_2` portals into) — one px below `ROW_2`'s own box, because that
   * wrapper draws the band's `border-bottom` OUTSIDE an otherwise unconstrained `height: auto` box.
   * There is no stable selector for it (a plain CSS-module class with no `data-*` hook), so it is
   * read as `ROW_2`'s parent, the same escape hatch `LayoutPage.raw` documents itself for.
   *
   * IT WENT RED AT 0.75px, AND IT WAS NOT ROUNDING. Every number below is a MEASURED read at
   * 1440x900, and they close exactly — 0.75 is arithmetic, not a sub-pixel residue, and it does not
   * move with `devicePixelRatio` (2 on this machine):
   *
   *   `--basalt-page-bar-h`  31.25px  ← row 2's CONTENT box, what the ResizeObserver publishes
   *   band painted bottom    y76.25   ← 31.25 + its own 1px `border-bottom`, drawn outside the box
   *   header `min-height`    32.25px  ← `calc(31.25px + 1px)`, the CSS's documented compensation
   *   header PAINTED height  33px     ← 32px of content + 1px border, so the min-height lost
   *   header painted bottom  y77      ← 0.75 past the band. Exactly 32 − 31.25.
   *
   * The 32 is `.fold`, sized `calc(var(--vx-space-control-height-ctl) * var(--mantine-scale))`, and
   * `controlHeightCtl` grew 30 → 32 in the desktop-shell pass. Under `box-sizing: border-box` a
   * 32.25px `min-height` leaves a 31.25px content box, the 32px toggle does not fit, and content
   * beats `min-height`. At 30 it fit, and the seam met BY COINCIDENCE.
   *
   * The band was the wrong number, not the header. Row 2 has no `min-height`
   * (`page-bar.module.css` `.row2` is `padding-block: --vx-space-stack-xs` around its content), and
   * the fixture used to hand it a bare `<span>Filters</span>` — 23.25px, where every real row-2
   * slot goes through `CtlSlot` and holds a 32px control, for a 40 → 41px band. `AsideBar` now
   * carries a real `ctl` control (see its docblock) and the two seams meet with the header's own
   * toggle fitting inside the band, which is the `/cbbi` shape this invariant was measured against
   * in the first place. The tolerance is UNCHANGED at 0.5px.
   *
   * The latent CSS fragility is real but is NOT what this test measures: a consumer who puts plain
   * text in `PageBar.filters` gets a band shorter than the aside header's own toggle, and no
   * `page-aside.module.css` `min-height` can make the seams meet then — a header cannot be shorter
   * than the control it contains. The second assertion below pins that floor explicitly so the
   * coincidence cannot silently return.
   */
  test('the aside header seam meets the page-bar band seam, not 9px above it', async () => {
    const p = await openFixture(ASIDE_SPEC, DESKTOP)
    const header = await p.box('aside header', `${ASIDE} [data-basalt-page-aside-header]`)
    const band = await p.raw.evaluate((sel) => {
      const row2 = document.querySelector(sel)
      const outlet = row2?.parentElement
      if (outlet === null || outlet === undefined) return null
      const rect = outlet.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom }
    }, ROW_2)
    expect(band).not.toBeNull()
    const { top: bandTop, bottom: bandBottom } = band as { top: number; bottom: number }
    expect(Math.abs(header.box.bottom - bandBottom)).toBeLessThanOrEqual(0.5)

    // THE PRECONDITION, asserted rather than assumed — see the docblock. The header's `min-height`
    // is `calc(--basalt-page-bar-h + 1px)` under `box-sizing: border-box`, so the band's PAINTED
    // height also has to cover the header's own tallest child (the `.fold` toggle at
    // `--vx-space-control-height-ctl`) plus its 1px `border-bottom`. Below that floor the content
    // wins, the header grows past the band, and the seam misses by however much it overflowed.
    // Failing HERE says which of the two numbers moved; failing only above says 0.75 and nothing.
    const fold = await p.box('aside fold toggle', `${ASIDE} [data-basalt-page-aside-header] button`)
    expect(bandBottom - bandTop).toBeGreaterThanOrEqual(fold.box.height + 1)
  })

  /**
   * INVARIANT 5 — with no `PageBar` on the route there is no band seam to align to, so the aside
   * header keeps closing the ordinary `appShellHeaderHeight` top belt (`docs/DESIGN-SPEC.md` §5)
   * instead of collapsing to the band's absent height. `noBar` drops the fixture's `AsideBar` so
   * `--basalt-page-bar-h` is never published — the CSS fallback chain is what this pins.
   */
  test('with no PageBar, the aside header stays the ordinary 44px band', async () => {
    const p = await openFixture(
      { ...ASIDE_SPEC, aside: { title: ASIDE_TITLE, noBar: true } },
      DESKTOP,
    )
    const header = await p.box('aside header', `${ASIDE} [data-basalt-page-aside-header]`)
    // 44, not the 48 this asserted before the desktop-shell spacing pass — the band IS
    // `appShellHeaderHeight` (see its entry in `tokens/palette.ts`), so this bound moves with it.
    expect(header.box.height).toBeGreaterThanOrEqual(43.5)
    expect(header.box.height).toBeLessThanOrEqual(44.5)
  })

  /**
   * INVARIANT 6 — a CLAIMED aside narrows the content column, and the KPI row has to answer to that
   * width rather than to the viewport's.
   *
   * This is the failure mode no viewport sweep can see, and it is why `StatGroup`/`WidgetGrid` moved
   * onto `@container` (`dashboard/stat-group.module.css`'s docblock states the measured defect: a
   * `PageAside` on a 1512px desktop left the row ~956px wide, `@media` still resolved `lg`, and four
   * cells of 239px truncated their own values mid-word). Every existing sweep in this suite holds
   * the viewport still and moves nothing else, so all of them would have stayed green through it.
   *
   * MEASURED here at 1440x900 with the aside claimed: viewport 1440 (≥ the 1200px `lg` boundary, so
   * the viewport law says FOUR), sidebar 256 + aside 300 + the shell's own insets leave the group
   * 844px — squarely the `sm` tier, so the container law says TWO for `cols={4}` (the deliberate
   * exception to `min(cols, 3)`: three columns would leave a four-KPI row as 3 + 1, one orphan
   * against two thirds of empty track — `dashboard/stat-group.tsx` states the reasoning), at ~415px
   * a cell. Both halves are asserted because they fail differently: the track count is the law, and
   * the clamp is what a reader would actually see. `statsWide` is the precondition for the second
   * one — `.value` ellipsizes (`dashboard/widget-header.module.css`), so a column one tier too
   * narrow is invisible against the four-digit stand-in and only shows against a number a real
   * dashboard would print (~195px, which fits 415 and does not fit the ~174 the base tier gives).
   *
   * THE HARNESS HAD TO LEARN TO SEE THIS FIRST. `Bun.build` scopes a CSS-modules container name in
   * the `@container` prelude and not in the declaration, so every one of these queries was dead in
   * the fixture and the group silently rendered its BASE two columns — a wrong number that looks
   * like a plausible one. `harness.ts`'s `unscopeContainerNames` states the evidence and the fix.
   */
  test('desktop 1440 with the aside claimed: the KPI row follows its CONTAINER, not the viewport', async () => {
    const p = await openFixture({ ...ASIDE_SPEC, stats: 4, statsWide: true }, DESKTOP)

    const group = await p.raw.evaluate(() => {
      // `[data-sm-cols]` is what tells a `StatGroup` from a `WidgetGrid` — both write `data-cols`,
      // and only `StatGroup` writes the `sm` half (`dashboard/stat-group.tsx`).
      const root = document.querySelector('[data-cols][data-sm-cols]')
      if (root === null) return null
      // The RESOLVED tracks, not the declaration — `repeat(var(--…), …)` computes to a used-value
      // list, so counting entries is the only way to read which tier actually won.
      const tracks = getComputedStyle(root).gridTemplateColumns.split(/\s+/).filter(Boolean).length
      // Only the nodes that DECLARE they clamp — `ellipsis` + `nowrap` is what `.value` and
      // `.titleText` carry (`dashboard/widget-header.module.css`), and it is the whole population
      // whose overflow is user-visible as truncated TEXT. A bare `scrollWidth > clientWidth` sweep
      // over every descendant is not the same question and answers it wrongly: it reports the card's
      // own body, whose 13px overhang is the sparkline's deliberate `.sparklineBleed` negative
      // margin (MEASURED 260 > 247), i.e. a design feature indicted as a defect.
      const clamped = [...root.querySelectorAll('*')]
        .filter((node) => {
          const style = getComputedStyle(node)
          if (style.textOverflow !== 'ellipsis' || style.whiteSpace !== 'nowrap') return false
          return node.scrollWidth > node.clientWidth + 0.5
        })
        .map(
          (node) =>
            `${node.tagName.toLowerCase()} "${node.textContent ?? ''}" ` +
            `${node.scrollWidth}>${node.clientWidth}`,
        )
      return { width: root.getBoundingClientRect().width, tracks, clamped }
    })
    expect(group).not.toBeNull()
    const { width, tracks, clamped } = group as {
      width: number
      tracks: number
      clamped: string[]
    }

    // The aside really is claimed and really did cost the column its width — without this the two
    // assertions below could both pass on a page where no aside ever mounted.
    expect(width).toBeLessThan(DESKTOP.width - 300)
    expect(tracks).toBe(2)
    expect(clamped, `clamped KPI text in a ${width}px row: ${clamped.join(' | ')}`).toEqual([])
  })
})
