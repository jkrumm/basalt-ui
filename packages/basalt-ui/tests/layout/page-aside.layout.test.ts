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
/** `FilterPill` names itself with the aside's `title` (`page-bar.tsx`'s `ariaLabel`). */
const PANEL_PILL = `button[aria-label="${'Composition'}"]`

const ASIDE_SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'home', label: 'Home', mobile: 'tab', active: true }] },
  ],
  aside: { title: 'Composition' },
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
    expect(await p.raw.textContent(`${ROW_2} ${PANEL_PILL}`)).toContain('Panel')
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
})
