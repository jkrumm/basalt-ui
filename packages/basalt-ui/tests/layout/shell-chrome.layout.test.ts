/**
 * The SHELL'S OWN CHROME, measured across the width range — the header row, the page gutter and the
 * sidebar's footer rhythm.
 *
 * WHY THIS FILE EXISTS, and why it is not more cases in `no-horizontal-overflow`. That guard owns
 * ONE property ("the page does not scroll sideways") and owns it well; what it cannot say is WHERE
 * the width went. Three of the current chrome round's changes are exactly that kind of claim:
 *
 *  - the header row has no width-driven fold between `sm` (768) and `md` (992), so the whole band
 *    was carried by `.lead`'s new 96px floor and `BarEntry`'s new `md` icon-only tier — a pair that
 *    is only correct TOGETHER (`shell/app-header.module.css` states the arithmetic for both), and
 *    was measured on a real page but never pinned;
 *  - the page gutter became RESPONSIVE (`{ base: appShellInsetMobile, sm: appShellInset }` on both
 *    `AppShell` and `AppShell.Header`), so the header, the band and Main now all have to land on
 *    ONE number and step at ONE width;
 *  - the sidebar footer stopped stacking flush on the scroll region.
 *
 * None of the three is observable in happy-dom: two are decided by a media query it answers with a
 * single hard-coded width, and the third is a `getBoundingClientRect` on boxes it reports as
 * `new DOMRect()`.
 *
 * SCOPE, same discipline as every file here: geometry, computed box, viewport-driven state. Which
 * TIER a control resolves to is `theme/spacing.test.ts`'s; which token carries which number is
 * `tokens/palette.ts`'s. This file only asks whether the boxes landed where those say they should.
 */
import { afterAll, describe, test } from 'bun:test'
import { SPACE, SPACE_STEP } from '../../src/tokens/palette'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage, Named, Viewport } from './harness'
import {
  CLOSE_BUDGET_MS,
  HEADER,
  HEADER_GLOBAL,
  HEADER_LEAD,
  HEADER_PAGE_BAR,
  HEADER_ROW,
  LAPTOP_900,
  LAPTOP_1024,
  MAIN,
  NAV_ROWS,
  NAV_VIEWPORT,
  PHONE,
  PHONE_SMALL,
  SIDEBAR_FOOTER,
  TABLET_768,
  closeLayoutSuite,
  expectFullyInside,
  expectGapAtLeast,
  expectSeparatedBy,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

/**
 * A page whose header row carries everything a real one does: a long active destination (so the
 * breadcrumb genuinely WANTS more than its floor and the floor is the binding constraint rather
 * than a formality), `PageBar` row 1 with a primary plus two labelled secondaries, and the shell's
 * own three-icon `globalActions` cluster.
 *
 * `actionIcons` is what makes the secondaries eligible for `BarEntry`'s `md` label fold at all — an
 * icon-less secondary keeps its label at every width because there is nothing to fall back to — and
 * it swaps in production-length labels with it (see `BarFixture`). Without both, the row measured
 * here is narrower than any row the fold was designed for and the test would pass on a page that
 * does not exist.
 *
 * FOUR actions, which is `DESKTOP_SECONDARY_MAX` + the primary — the heaviest row 1 that still
 * renders entirely inline, so the row is as loaded as the shipped fold ever lets it get. That
 * choice is what gives these assertions their bite; MEASURED, with the fold live:
 *
 *   width   crumb side   row 1    globals
 *     320       138.0      70.0      70.0
 *     390       208.0      70.0      70.0
 *     768       120.6     224.4     108.0   ← 24.6px above the 96px floor
 *     900       252.6     224.4     108.0
 *    1024       188.3     412.7     108.0   ← labels back, row 1 grows 188.3px
 *
 * 768 is the case that matters, and it is not close to vacuous: drop the `md` fold and row 1 there
 * becomes ~368px, which needs the crumb at −23px. The crumb stops at 96, the row overflows by ~48,
 * and BOTH the fit test and the floor test below go red — which is exactly the pair that is only
 * correct together.
 */
const HEADER_PAGE: FixtureSpec = {
  sections: [
    {
      label: 'Main',
      items: [
        { key: 'progress', label: 'Study progress overview', mobile: 'tab', active: true },
        { key: 'reports', label: 'Reports', mobile: 'tab' },
        { key: 'settings', label: 'Settings', mobile: 'more' },
      ],
    },
  ],
  bar: { pills: 4, actions: 4, actionIcons: true },
  globals: 3,
}

/** Every width this suite claims to cover, narrowest first — the sweep the guard used to skip. */
const SWEEP = [PHONE_SMALL, PHONE, TABLET_768, LAPTOP_900, LAPTOP_1024] as const

/**
 * `theme.breakpoints.sm` in pixels. It is 48em, and every basalt CSS module writes its max-width
 * twin as the literal `47.99375em` because a media query cannot resolve a custom property — so the
 * two sides of the step are 767 and 768 at the default 16px root.
 */
const SM_PX = 768

/** A resolved computed length, in px. Throws rather than returning `NaN` on a value that is not one. */
async function computedPx(p: LayoutPage, selector: string, property: string): Promise<number> {
  const raw = await p.computed(selector, property)
  const value = Number.parseFloat(raw)
  if (Number.isNaN(value)) {
    throw new Error(
      `LAYOUT: \`${property}\` on \`${selector}\` resolved to \`${raw}\`, which is not a length. ` +
        'A computed style that needs layout returns `""` when the element is not laid out at all.',
    )
  }
  return value
}

/**
 * Both inline sides of one box's padding, asserted against ONE expected number.
 *
 * Both sides, not one: the gutter is an ALIGNMENT constraint (the page's first column on the
 * sidebar nav icon column's x) and a one-sided check would pass a `padding-inline-start` that was
 * moved on its own — which is exactly the shape `app-main.module.css`'s `display-mode: standalone`
 * rule already writes deliberately on the right.
 */
async function expectInlinePadding(
  p: LayoutPage,
  name: string,
  selector: string,
  expected: number,
  why: string,
): Promise<void> {
  const left = await computedPx(p, selector, 'padding-left')
  const right = await computedPx(p, selector, 'padding-right')
  if (Math.abs(left - expected) <= 0.5 && Math.abs(right - expected) <= 0.5) return
  throw new Error(
    `\nLAYOUT INVARIANT VIOLATED — ${why}\n\n` +
      `  ${name} padding-left  = ${left.toFixed(1)}px\n` +
      `  ${name} padding-right = ${right.toFixed(1)}px\n` +
      `  viewport ${p.viewport.width}x${p.viewport.height} (${p.viewport.name})\n\n` +
      `  expected: both = ${expected.toFixed(1)}px\n`,
  )
}

/** The slice of the header row to the RIGHT of the breadcrumb — where every control must live. */
function rightOfLead(row: Named, lead: Named): Named {
  return {
    name: 'right of the crumb',
    box: {
      ...row.box,
      x: lead.box.right,
      left: lead.box.right,
      width: Math.max(0, row.box.right - lead.box.right),
    },
  }
}

layout('shell chrome — the header row, the gutter, the sidebar footer', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  /**
   * THE HEADER ROW FITS ITS BAND, at every width — including the 768–1024 band nothing sampled.
   *
   * Two failures, deliberately separate, because the row can break in two directions and only one
   * of them is visible from the outside.
   *
   * OUTWARD: the row's items overflow to the RIGHT (`.bar` is a plain `flex-start` row), so the
   * globals leave the band. That is the shape the page-level overflow guard also catches, one
   * region up, and it is asserted here so the failure names the header instead of the document.
   *
   * INWARD: the controls overflow LEFTWARD out of `.pageBar`, because that box is
   * `justify-content: flex-end` and a flex container overflows towards its start. That one is
   * INVISIBLE to every document-width reading — nothing gets wider, the sync button simply paints
   * on top of the page title (MEASURED once, in Chrome: title 119.7–197.1, sync button 158.3–188.3).
   * `.pageBar` is `flex: 0 0 auto` with no `min-width: 0` beneath it precisely so this cannot
   * happen; this is the assertion that says so.
   */
  for (const viewport of SWEEP) {
    test(`the header row fits its band (${viewport.width}px, ${viewport.name})`, async () => {
      const p = await openFixture(HEADER_PAGE, viewport)
      await p.settle()

      const row = await p.box('header row', HEADER_ROW)
      const lead = await p.box('crumb side', HEADER_LEAD)
      const pageBar = await p.box('page actions', HEADER_PAGE_BAR)
      const globals = await p.box('globals', HEADER_GLOBAL)

      for (const slot of [lead, pageBar, globals]) {
        expectFullyInside(
          slot,
          row,
          'every slot of the header row stays inside the row — the row does not fold, so a row ' +
            'that does not fit spills its LAST item out of the band instead of shrinking',
          viewport,
        )
      }

      const bounds = rightOfLead(row, lead)
      for (const box of await p.boxes(`${HEADER_PAGE_BAR} > *`)) {
        expectFullyInside(
          { name: 'row-1 content', box },
          bounds,
          "row 1's controls may never paint over the breadcrumb — `.pageBar` is " +
            '`justify-content: flex-end`, so content it cannot fit overflows LEFTWARD and nothing ' +
            'about the page gets wider when it does',
          viewport,
        )
      }
    })
  }

  /**
   * THE BREADCRUMB FLOOR — `.lead` is the row's one elastic side, and it must never be elastic to
   * nothing.
   *
   * `min-width` was `0` until this round, which made the breadcrumb the row's entire shock absorber:
   * it absorbed itself out of existence and the row overflowed anyway, because `.pageBar` and
   * `.global` beside it are both rigid. The fold bought nothing and cost the reader the one word
   * saying where they are.
   *
   * The floor is READ OFF THE ELEMENT rather than written down here. That is not laziness about the
   * number: 96px is a TYPOGRAPHIC argument (~13 characters at `VX.text.lg` / `font-stretch: 88%`),
   * it lives in one place with the paragraph that justifies it, and a second copy in a test file is
   * a copy that goes stale silently. What this asserts is the invariant the number serves — the
   * fold ran BEFORE the title got crushed — at every width, whatever the floor is set to.
   *
   * The active destination is deliberately long ("Study progress overview"), so the crumb wants far
   * more than the floor everywhere and the floor is genuinely the binding constraint. On a phone it
   * is expected NOT to bind at all (the row there is the crumb plus ~66px of globals and ~26px of
   * gaps) — that half of the sweep is the control, and it is worth running: it is what would catch
   * the floor becoming binding on a phone, where the ancestors are already hidden and there is
   * nothing left to give.
   */
  for (const viewport of SWEEP) {
    test(`the crumb never falls under its floor (${viewport.width}px, ${viewport.name})`, async () => {
      const p = await openFixture(HEADER_PAGE, viewport)
      await p.settle()

      const floor = await computedPx(p, HEADER_LEAD, 'min-width')
      const lead = await p.box('crumb side', HEADER_LEAD)
      if (lead.box.width >= floor - 0.5) return

      const row = await p.box('header row', HEADER_ROW)
      const pageBar = await p.box('page actions', HEADER_PAGE_BAR)
      throw new Error(
        '\nLAYOUT INVARIANT VIOLATED — the breadcrumb absorbed the whole row again\n\n' +
          `  crumb side  w=${lead.box.width.toFixed(1)} (floor ${floor.toFixed(1)})\n` +
          `  page actions w=${pageBar.box.width.toFixed(1)}\n` +
          `  header row   w=${row.box.width.toFixed(1)}\n` +
          `  viewport ${viewport.width}x${viewport.height} (${viewport.name})\n\n` +
          '  expected: the row folds (BarEntry drops labelled secondaries to icons above `sm`) ' +
          'BEFORE `.lead` goes under its own `min-width`\n',
      )
    })
  }

  /**
   * THE RESPONSIVE PAGE GUTTER — one number, three boxes, one step.
   *
   * THE DECISION, since the brief asked for it explicitly: the expected values are READ FROM THE
   * TOKEN TABLE (`SPACE_STEP.appShellInset` / `.appShellInsetMobile`), not hardcoded here.
   *
   * Hardcoding 20 and 8 would make this file fail on a deliberate retune, and that failure would be
   * NOISE — `theme/spacing.test.ts` already pins both literals by value, beside the var names they
   * emit, which is the right home for "the token is 20". A second copy buys no coverage and makes
   * one intended change red in two places, which is how a test earns a reputation for being
   * something you edit rather than something you believe.
   *
   * What is asserted instead is the part no value test can see, and the part that actually broke
   * here: that the number REACHES the box, that all three boxes get the SAME one, and that the pair
   * really is a pair. `expectPairIsResponsive` below is what keeps this from being unfalsifiable —
   * a "responsive" gutter whose two halves collapsed to one value would satisfy every reading below
   * and is a real regression, so it is checked directly rather than implied.
   *
   * The two props take DIFFERENT roads through Mantine — `AppShell padding` through
   * `assign-padding-variables.mjs`, `AppShell.Header px` through `parse-style-props.mjs` — and only
   * agree because both resolve `sm` from `theme.breakpoints`. That is exactly the kind of agreement
   * that holds until a Mantine minor, and exactly what a real browser is for.
   */
  test('the mobile and desktop gutters are a genuine pair', () => {
    const mobile = SPACE_STEP.appShellInsetMobile
    const desktop = SPACE_STEP.appShellInset
    if (mobile < desktop) return
    throw new Error(
      'LAYOUT: the page gutter is declared as a responsive pair, and the pair collapsed — ' +
        `appShellInsetMobile = ${mobile}, appShellInset = ${desktop}. Every assertion below would ` +
        'still pass with one value at both widths, which is why this is checked on its own.',
    )
  })

  for (const [viewport, expected] of [
    [{ name: 'one px under sm', width: SM_PX - 1, height: 720 }, SPACE_STEP.appShellInsetMobile],
    [{ name: 'sm exactly', width: SM_PX, height: 720 }, SPACE_STEP.appShellInset],
  ] as const satisfies readonly (readonly [Viewport, number])[]) {
    test(`the gutter is ${expected}px at ${viewport.width}px (${viewport.name})`, async () => {
      const p = await openFixture(HEADER_PAGE, viewport)
      await p.settle()

      await expectInlinePadding(
        p,
        'AppShell.Main',
        MAIN,
        expected,
        'the page gutter steps at `theme.breakpoints.sm` and nowhere else — below it the phone ' +
          "gets 10px more line width a side, at and above it the page's first column lands on " +
          "the sidebar nav icon column's x across the seam",
      )
      await expectInlinePadding(
        p,
        'AppShell.Header',
        HEADER,
        expected,
        'the header takes the SAME gutter as Main by a different Mantine road (a Box style prop, ' +
          "not the shell padding var) — the breadcrumb's left edge and the globals' right edge " +
          "land on the card column's edges only while the two agree",
      )
    })
  }

  /**
   * THE GUTTER IS SPLIT BY AXIS, and only the inline half is responsive.
   *
   * `.main`'s padding stopped being a shorthand of one value this round: inline tracks
   * `--app-shell-padding` because it is an ALIGNMENT constraint against the sidebar seam, block is
   * `--vx-space-stack-md` because it is breathing room under the band's divider and nothing aligns
   * to it. A future "simplification" back to one value would be invisible at `sm`+ (both are set)
   * and would silently take 8px off the top of every phone page — so the invariant asserted is that
   * the BLOCK inset does not move across the step, which is the half that has no other guard.
   */
  test('the block inset does not step with the inline one', async () => {
    const below = await openFixture(HEADER_PAGE, {
      name: 'under sm',
      width: SM_PX - 1,
      height: 720,
    })
    await below.settle()
    const blockBelow = await computedPx(below, MAIN, 'padding-top')

    const at = await openFixture(HEADER_PAGE, { name: 'at sm', width: SM_PX, height: 720 })
    await at.settle()
    const blockAt = await computedPx(at, MAIN, 'padding-top')

    if (Math.abs(blockBelow - blockAt) <= 0.5) return
    throw new Error(
      `LAYOUT: Main's BLOCK padding moved across the sm step — ${blockBelow.toFixed(1)}px under, ` +
        `${blockAt.toFixed(1)}px at. Only the inline axis is responsive; a gap under a divider is ` +
        'not a gutter beside a seam, and the two were split for exactly that reason.',
    )
  })

  /**
   * THE SIDEBAR FOOTER OWNS ITS OWN AIR.
   *
   * The footer's rows used to stack FLUSH on the scroll region above them and on each other — the
   * `Stack` wrapping them is `gap={0}`, so with no rule of its own the region had no rhythm at all.
   * What landed is SPACE, not a seam: `.footer` opens with one `sidebarRegionGap` and its children
   * separate by `stack-sm`. A `--vx-divider` hairline on `.footer` was the obvious alternative and
   * `app-sidebar.module.css` rejects it in as many words — the boundary is already carried by that
   * padding and by the account row's own inset, so a rule there would answer a question nobody
   * asked (and would put the module into `theme/divider-law.test.ts`'s hairline inventory for it).
   *
   * That is why this asserts a GAP and not "a gap or a border": which of the two forms shipped is
   * not an implementation detail the sidebar is free to swap later, it is a decision with an
   * argument attached. If a later round paints a seam anyway, this failing is the correct outcome
   * and that argument is the thing to answer.
   *
   * The floors are read from the token table for the same reason the gutter's are — `tokens/
   * palette.ts` carries the numbers and the argument for them, and a copy here would go stale on a
   * density retune while looking authoritative.
   */
  test('the footer reads as its own region, not as more rows', async () => {
    const p = await openFixture(
      { ...HEADER_PAGE, sidebar: { account: true, settings: 2 } },
      LAPTOP_1024,
    )
    await p.settle()

    const footer = await p.box('footer', SIDEBAR_FOOTER)
    const children = await p.boxes(`${SIDEBAR_FOOTER} > *`)
    const [first, second] = children
    if (!first || !second) {
      throw new Error(
        `LAYOUT: the sidebar footer rendered ${children.length} child(ren) — this invariant needs ` +
          'the settings rows AND the account row, so the gap between them is measurable at all.',
      )
    }

    expectGapAtLeast(
      footer,
      { name: 'first footer row', box: first },
      'top',
      SPACE_STEP.sidebarRegionGap - 0.5,
      'the footer must open with a full region gap — it is the seam between the scrolling nav and ' +
        'the pinned cluster, and with `gap: 0` on the Stack around it there is nothing else to draw it',
      p.viewport,
    )

    expectSeparatedBy(
      { name: 'settings rows', box: first },
      { name: 'account row', box: second },
      SPACE.stackSm - 0.5,
      'the footer is ONE cluster of rows that belong together, but its parts still separate — ' +
        'flush is the "cramped footer", and it is what `gap={0}` gives you unstyled',
      p.viewport,
    )
  })

  /**
   * THE LAST NAV ROW IS NEVER CLIPPED MID-ROW.
   *
   * An overflowing nav column with only the inline inset cut its last row flush against the
   * viewport's bottom edge, which reads as a list that is CLIPPED rather than one that scrolls —
   * the reader has no signal that scrolling would help. `.navViewport`'s `padding-block-end` is the
   * scroll END-STOP that fixes it, and it is one `sidebarRegionGap`, the same number the column
   * opens with at its other end — and the same height as the mask that fades the viewport's bottom
   * edge, which is why the last row lands FULLY OPAQUE: at the scroll end the end-stop's empty air
   * is what sits in the fade band. This measures that pairing; a mask taller than the end-stop
   * would dim a real row here and read as the clipping it exists to replace.
   *
   * Scrolled to the END on purpose: at rest the last row is off-screen and every reading below is
   * vacuously true. The nav viewport is scrolled directly through `raw` rather than through
   * `scrollToEnd()`, which resolves `AppShell.Main` — the shell's scrollport is a different element
   * and scrolling it would leave the sidebar exactly where it was.
   *
   * `LAPTOP_1024` is 640px tall against ~24 nav rows, so the column genuinely overflows. If a later
   * round makes the rows short enough to fit, this fails loudly on the row count rather than going
   * green on a list that never scrolled.
   */
  test('the nav scroll region stops on a whole row, not through one', async () => {
    const p = await openFixture(
      {
        sections: Array.from({ length: 3 }, (_, s) => ({
          label: `Section ${s + 1}`,
          items: Array.from({ length: 8 }, (_, i) => ({
            key: `s${s}i${i}`,
            label: `Destination ${s + 1}.${i + 1}`,
            ...(s === 0 && i === 0 ? { active: true as const } : {}),
          })),
        })),
        sidebar: { account: true },
      },
      LAPTOP_1024,
    )
    await p.settle()

    const scroll = await p.scroll(NAV_VIEWPORT)
    if (scroll.scrollHeight <= scroll.clientHeight + 1) {
      throw new Error(
        `LAYOUT: the nav column did not overflow (scrollHeight ${scroll.scrollHeight}, ` +
          `clientHeight ${scroll.clientHeight}) — this invariant is about a column that SCROLLS, ` +
          'and it just measured one that fits. Add rows or shorten the viewport.',
      )
    }

    await p.raw.evaluate((selector) => {
      document.querySelector(selector)?.scrollTo({ top: 1e7, behavior: 'instant' })
    }, NAV_VIEWPORT)
    await p.settle()

    const viewport = await p.box('nav viewport', NAV_VIEWPORT)
    const rows = await p.boxes(NAV_ROWS)
    const last = rows.at(-1)
    if (!last) throw new Error('LAYOUT: the sidebar rendered no nav rows — the fixture is wrong')
    const lastRow = { name: 'last nav row', box: last }

    expectFullyInside(
      lastRow,
      viewport,
      'scrolled to the end, the last nav row must be WHOLE inside the scrollport — a row cut by ' +
        'the viewport edge reads as a clipped list, not as one that has more below',
      p.viewport,
    )
    expectGapAtLeast(
      viewport,
      lastRow,
      'bottom',
      SPACE_STEP.sidebarRegionGap - 0.5,
      'the scroll END-STOP is a full region gap of air under the last row — the same number the ' +
        "column opens with at the other end, so both of the nav region's edges read the same",
      p.viewport,
    )
  })
})
