/**
 * Touch interaction model across chart kinds (`docs/CHARTS-SPEC.md` §4, Tooltip, wave 9 step 3;
 * the provisional-press contract is `R2C-1`/`P0-2`): a touch press is PROVISIONAL — `pointerdown`
 * shows the readout, `pointerup` for the same pointer commits the pin, and a `pointercancel`
 * before commit (a scroll winning the gesture) clears it. Once committed, the pin survives lift and
 * is dismissed by a tap outside, a `document` scroll, or Escape. `useChartCursor`/`useDiscreteCursor`
 * are the code under test — see their own JSDoc for the contract this suite pins.
 * `Donut.test.tsx`/`Heatmap.test.tsx` already pin the same contract's LOGIC on jsdom; what only a
 * real browser can prove is that the interaction still reaches a REALLY portaled, REALLY measured
 * `ChartTooltipFloat` (jsdom's `useLayoutEffect` never observes a real `offsetWidth`/`offsetHeight`)
 * and that a tap outside crosses a REAL document boundary rather than a synthetic one.
 *
 * DISPATCH METHOD, chosen empirically rather than assumed: a real `PointerEvent` dispatched
 * DIRECTLY on the target element (`element.dispatchEvent(...)`, `pointerType: 'touch'`), not
 * `page.touchscreen.tap()` / raw CDP `Input.dispatchTouchEvent` at screen coordinates.
 * `charts.layout.test.ts`'s own `hoverAt` helper already proves this reaches React's delegated
 * listener with the real event shape (`event.pointerType`/`clientX`/`clientY` are all the app code
 * reads) — that file's mouse-hover tests pass today using exactly this technique. Two problems a
 * coordinate-based dispatch would hit that direct-element dispatch sidesteps entirely:
 * `page.touchscreen.tap()` only synthesizes `touchstart`+`touchend` with no move step, so it cannot
 * express a scrub at all; and Donut's arcs are annular sectors whose bounding-box CENTER often sits
 * in the punched-out hole or a neighbouring slice's wedge, so a coordinate landing "inside the box"
 * is not guaranteed to hit-test onto the intended slice — dispatching straight at the element skips
 * hit-testing and lands on the exact node under test regardless of its painted shape.
 *
 * Every gesture still carries real, geometry-derived `clientX`/`clientY` (read off the actual
 * element's `getBoundingClientRect()`), because `useChartCursor`'s nearest-point search and
 * `ChartTooltipFloat`'s anchor both read those fields — only the HIT-TEST step is bypassed, not the
 * coordinates the app logic itself consumes.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { ChartsSpec, FixtureSpec } from './fixture/spec'
import type { Box, LayoutPage } from './harness'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

/** One chart above the filler, in an otherwise minimal shell — mirrors `charts.layout.test.ts`'s
 * own `chartFixture`, redeclared locally so this file stays a self-contained unit. */
const FRAME = '[data-testid="chart-frame"]'
const OVERLAY = `${FRAME} rect[role="slider"]`
const TOOLTIP = '[role="tooltip"]'
/** Donut's arcs and Heatmap's cells — the two discrete `useDiscreteCursor` target shapes. */
const OPTION = `${FRAME} [role="option"]`
/** The shared keyboard/focus host `useDiscreteCursor` puts on the kind's own `<svg>`. */
const LISTBOX = `${FRAME} svg[role="listbox"]`

function chartFixture(charts: ChartsSpec): FixtureSpec {
  return {
    sections: [
      { label: 'Main', items: [{ key: 'home', label: 'Home', mobile: 'tab', active: true }] },
    ],
    charts,
  }
}

type TouchType = 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel'

/**
 * Dispatches a real touch `PointerEvent` directly on the `index`-th element matching `selector` —
 * see the file header for why direct-element dispatch beats a coordinate-based one here. Every
 * event carries the same `pointerId` (7) so a `pointerup`/`pointercancel` names the press its
 * `pointerdown` opened, which is exactly the id matching the provisional-press contract keys on.
 */
async function touch(
  p: LayoutPage,
  selector: string,
  index: number,
  type: TouchType,
  point: { x: number; y: number },
): Promise<void> {
  await p.raw.evaluate(
    ([sel, idx, evtType, x, y]) => {
      const el = document.querySelectorAll(sel)[idx]
      if (!el) throw new Error(`LAYOUT: no element at index ${idx} for \`${sel}\``)
      el.dispatchEvent(
        new PointerEvent(evtType, {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          pointerId: 7,
          pointerType: 'touch',
          isPrimary: true,
        }),
      )
    },
    [selector, index, type, point.x, point.y] as [string, number, TouchType, number, number],
  )
  await p.settle()
}

/** A tap outside every chart's boundary. Dispatched on `document.body`, which sits outside every
 * kind's own boundary ref (the `<svg>` itself) — the node both `useChartCursor` and
 * `useDiscreteCursor`'s outside-tap listeners test with `boundary.contains(event.target)`. */
async function tapOutside(p: LayoutPage): Promise<void> {
  await p.raw.evaluate(() => {
    document.body.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: 2,
        clientY: 2,
        pointerId: 9,
        pointerType: 'touch',
        isPrimary: true,
      }),
    )
  })
  await p.settle()
}

/** A scroll anywhere in the document — the dismissal `useChartCursor` installs while pinned. */
async function scrollDocument(p: LayoutPage): Promise<void> {
  await p.raw.evaluate(() => {
    document.dispatchEvent(new Event('scroll', { bubbles: true }))
  })
  await p.settle()
}

/** Escape from an UNFOCUSED overlay (dispatched on `document.body`), the case the overlay's own
 * `onKeyDown` cannot cover — `R2C-14`. */
async function escapeFromBody(p: LayoutPage): Promise<void> {
  await p.raw.evaluate(() => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  await p.settle()
}

async function nthBox(p: LayoutPage, selector: string, index: number): Promise<Box> {
  const found = await p.raw.evaluate(
    ([sel, idx]) => {
      const el = document.querySelectorAll(sel)[idx]
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        left: r.left,
      }
    },
    [selector, index] as [string, number],
  )
  if (found === null) throw new Error(`LAYOUT: no element at index ${index} for \`${selector}\``)
  return found as Box
}

function center(box: Box): { x: number; y: number } {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

/** Waits for the portaled tooltip to become visible and returns its rendered text. */
async function tooltipText(p: LayoutPage): Promise<string> {
  await p.waitFor(TOOLTIP)
  return p.raw.locator(TOOLTIP).innerText()
}

async function activeDescendant(p: LayoutPage): Promise<string | null> {
  return p.raw.locator(LISTBOX).getAttribute('aria-activedescendant')
}

async function optionId(p: LayoutPage, index: number): Promise<string | null> {
  return p.raw.evaluate(([sel, idx]) => document.querySelectorAll(sel)[idx]?.id ?? null, [
    OPTION,
    index,
  ] as [string, number])
}

layout('Chart touch model', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  /**
   * The cartesian contract (`CartesianChart`/`useChartCursor`, `docs/CHARTS-SPEC.md` §4, Tooltip):
   * a tap with no preceding `pointermove` resolves and shows the tooltip immediately, a scrub keeps
   * resolving through the SAME `onPointerMove` path a fine pointer's hover uses, `pointerup` commits
   * the pin, a `pointercancel` before commit clears it (the scroll case), the pin survives lift and
   * moves on a fresh tap elsewhere, and it is dismissed by a tap outside or on scroll/Escape.
   * `multiLine` stands in for every cartesian kind — they all route through the same
   * `HoverOverlay`/`useChartCursor` pair.
   */
  describe('multiLine (cartesian)', () => {
    test('a completed tap shows the tooltip immediately and it stays pinned past lift', async () => {
      const p = await openFixture(chartFixture({ kind: 'multiLine' }), DESKTOP_1440)
      const overlay = await p.box('overlay', OVERLAY)
      const point = {
        x: overlay.box.left + overlay.box.width * 0.15,
        y: overlay.box.top + overlay.box.height / 2,
      }

      // `pointerdown` alone is PROVISIONAL and already shows the readout.
      await touch(p, OVERLAY, 0, 'pointerdown', point)
      const shown = await tooltipText(p)
      expect(shown.length).toBeGreaterThan(0)

      // `pointerup` for the same pointer commits the pin; a later `pointercancel` is then the
      // committed-touch no-op, not a dismissal.
      await touch(p, OVERLAY, 0, 'pointerup', point)
      await touch(p, OVERLAY, 0, 'pointercancel', point)
      expect(await p.count(TOOLTIP)).toBe(1)
      expect(await tooltipText(p)).toBe(shown)
    })

    test('a scroll gesture that starts on the chart (pointerdown then pointercancel) leaves no pin', async () => {
      const p = await openFixture(chartFixture({ kind: 'multiLine' }), DESKTOP_1440)
      const overlay = await p.box('overlay', OVERLAY)
      const point = center(overlay.box)

      // The readout appears on contact…
      await touch(p, OVERLAY, 0, 'pointerdown', point)
      expect(await p.count(TOOLTIP)).toBe(1)

      // …and the browser taking the gesture (a vertical pan cancels the pointer) must clear it,
      // because the press never completed with a `pointerup`.
      await touch(p, OVERLAY, 0, 'pointercancel', point)
      await p.quiesce()
      expect(await p.count(TOOLTIP)).toBe(0)
    })

    test('a scrub after the tap moves the tooltip, and pointerup commits it with no cancel', async () => {
      const p = await openFixture(chartFixture({ kind: 'multiLine' }), DESKTOP_1440)
      const overlay = await p.box('overlay', OVERLAY)
      const start = {
        x: overlay.box.left + overlay.box.width * 0.1,
        y: overlay.box.top + overlay.box.height / 2,
      }
      const end = {
        x: overlay.box.left + overlay.box.width * 0.9,
        y: overlay.box.top + overlay.box.height / 2,
      }

      await touch(p, OVERLAY, 0, 'pointerdown', start)
      const before = await tooltipText(p)

      await touch(p, OVERLAY, 0, 'pointermove', end)
      const after = await tooltipText(p)
      expect(after).not.toBe(before)

      // The completed drag commits as scrub-then-pin; nothing cancels it.
      await touch(p, OVERLAY, 0, 'pointerup', end)
      expect(await p.count(TOOLTIP)).toBe(1)
      expect(await tooltipText(p)).toBe(after)
    })

    test('a tap elsewhere in the same chart moves the pin to the new point', async () => {
      const p = await openFixture(chartFixture({ kind: 'multiLine' }), DESKTOP_1440)
      const overlay = await p.box('overlay', OVERLAY)
      const first = {
        x: overlay.box.left + overlay.box.width * 0.2,
        y: overlay.box.top + overlay.box.height / 2,
      }
      const second = {
        x: overlay.box.left + overlay.box.width * 0.8,
        y: overlay.box.top + overlay.box.height / 2,
      }

      await touch(p, OVERLAY, 0, 'pointerdown', first)
      await touch(p, OVERLAY, 0, 'pointerup', first)
      const before = await tooltipText(p)
      await touch(p, OVERLAY, 0, 'pointerdown', second)
      await touch(p, OVERLAY, 0, 'pointerup', second)
      const after = await tooltipText(p)

      expect(after).not.toBe(before)
      expect(await p.count(TOOLTIP)).toBe(1)
    })

    test('a cancelled SECOND press restores the previously committed pin instead of dropping it', async () => {
      // R2C-1/P0-2, round 2's carried-forward gap: tap A pins it; a second press at B is only
      // PROVISIONAL, and the browser taking THAT press as a scroll must restore A's committed pin,
      // not drop it.
      const p = await openFixture(chartFixture({ kind: 'multiLine' }), DESKTOP_1440)
      const overlay = await p.box('overlay', OVERLAY)
      const pointA = {
        x: overlay.box.left + overlay.box.width * 0.2,
        y: overlay.box.top + overlay.box.height / 2,
      }
      const pointB = {
        x: overlay.box.left + overlay.box.width * 0.8,
        y: overlay.box.top + overlay.box.height / 2,
      }

      await touch(p, OVERLAY, 0, 'pointerdown', pointA)
      await touch(p, OVERLAY, 0, 'pointerup', pointA)
      const pinnedA = await tooltipText(p)

      // Press B — provisional, moves the readout…
      await touch(p, OVERLAY, 0, 'pointerdown', pointB)
      const provisionalB = await tooltipText(p)
      expect(provisionalB).not.toBe(pinnedA)

      // …then a vertical scroll cancels it: A's pin must still be showing.
      await touch(p, OVERLAY, 0, 'pointercancel', pointB)
      await p.quiesce()
      expect(await p.count(TOOLTIP)).toBe(1)
      expect(await tooltipText(p)).toBe(pinnedA)
    })

    test('a tap outside the chart dismisses the pinned tooltip', async () => {
      const p = await openFixture(chartFixture({ kind: 'multiLine' }), DESKTOP_1440)
      const overlay = await p.box('overlay', OVERLAY)

      await touch(p, OVERLAY, 0, 'pointerdown', center(overlay.box))
      await touch(p, OVERLAY, 0, 'pointerup', center(overlay.box))
      await tooltipText(p)

      await tapOutside(p)
      await p.quiesce()
      expect(await p.count(TOOLTIP)).toBe(0)
    })

    test('a document scroll clears a pinned tooltip', async () => {
      const p = await openFixture(chartFixture({ kind: 'multiLine' }), DESKTOP_1440)
      const overlay = await p.box('overlay', OVERLAY)

      await touch(p, OVERLAY, 0, 'pointerdown', center(overlay.box))
      await touch(p, OVERLAY, 0, 'pointerup', center(overlay.box))
      await tooltipText(p)

      await scrollDocument(p)
      await p.quiesce()
      expect(await p.count(TOOLTIP)).toBe(0)
    })

    test('Escape clears a pinned tooltip even with the overlay unfocused', async () => {
      const p = await openFixture(chartFixture({ kind: 'multiLine' }), DESKTOP_1440)
      const overlay = await p.box('overlay', OVERLAY)

      await touch(p, OVERLAY, 0, 'pointerdown', center(overlay.box))
      await touch(p, OVERLAY, 0, 'pointerup', center(overlay.box))
      await tooltipText(p)

      await escapeFromBody(p)
      await p.quiesce()
      expect(await p.count(TOOLTIP)).toBe(0)
    })
  })

  /**
   * Donut's ring (`useDiscreteCursor`, no `columns` — a ring has no 2D shape, every arrow steps by
   * one). Same provisional-press/pin/move/dismiss contract as the cartesian kinds, over discrete
   * slice targets instead of a continuous domain, plus arrow-key stepping through
   * `aria-activedescendant`.
   */
  describe('donut (discrete)', () => {
    test('a completed tap on a slice pins the tooltip past lift', async () => {
      const p = await openFixture(chartFixture({ kind: 'donut' }), DESKTOP_1440)
      const slice = await nthBox(p, OPTION, 0)

      await touch(p, OPTION, 0, 'pointerdown', center(slice))
      const shown = await tooltipText(p)
      expect(shown.length).toBeGreaterThan(0)

      await touch(p, OPTION, 0, 'pointerup', center(slice))
      await touch(p, OPTION, 0, 'pointercancel', center(slice))
      expect(await p.count(TOOLTIP)).toBe(1)
      expect(await tooltipText(p)).toBe(shown)
    })

    test('a cancelled press on a slice leaves no tooltip', async () => {
      const p = await openFixture(chartFixture({ kind: 'donut' }), DESKTOP_1440)
      const slice = await nthBox(p, OPTION, 0)

      await touch(p, OPTION, 0, 'pointerdown', center(slice))
      await touch(p, OPTION, 0, 'pointercancel', center(slice))
      await p.quiesce()
      expect(await p.count(TOOLTIP)).toBe(0)
    })

    test('a tap on a different slice moves the pin', async () => {
      const p = await openFixture(chartFixture({ kind: 'donut' }), DESKTOP_1440)
      const first = await nthBox(p, OPTION, 0)
      const second = await nthBox(p, OPTION, 1)

      await touch(p, OPTION, 0, 'pointerdown', center(first))
      await touch(p, OPTION, 0, 'pointerup', center(first))
      const before = await tooltipText(p)
      await touch(p, OPTION, 1, 'pointerdown', center(second))
      await touch(p, OPTION, 1, 'pointerup', center(second))
      const after = await tooltipText(p)

      expect(after).not.toBe(before)
      expect(await p.count(TOOLTIP)).toBe(1)
    })

    test('a cancelled SECOND press restores the previously committed pin instead of dropping it', async () => {
      // Same R2C-1/P0-2 regression as the cartesian case above, over `useDiscreteCursor`'s own
      // press/commit/cancel machine: tap slice A pins it; a second press on slice B is only
      // PROVISIONAL, and a scroll cancelling THAT press must restore A's pin, not drop it.
      const p = await openFixture(chartFixture({ kind: 'donut' }), DESKTOP_1440)
      const sliceA = await nthBox(p, OPTION, 0)
      const sliceB = await nthBox(p, OPTION, 1)

      await touch(p, OPTION, 0, 'pointerdown', center(sliceA))
      await touch(p, OPTION, 0, 'pointerup', center(sliceA))
      const pinnedA = await tooltipText(p)

      await touch(p, OPTION, 1, 'pointerdown', center(sliceB))
      const provisionalB = await tooltipText(p)
      expect(provisionalB).not.toBe(pinnedA)

      await touch(p, OPTION, 1, 'pointercancel', center(sliceB))
      await p.quiesce()
      expect(await p.count(TOOLTIP)).toBe(1)
      expect(await tooltipText(p)).toBe(pinnedA)
    })

    test('a tap outside the ring dismisses the pin', async () => {
      const p = await openFixture(chartFixture({ kind: 'donut' }), DESKTOP_1440)
      const slice = await nthBox(p, OPTION, 0)

      await touch(p, OPTION, 0, 'pointerdown', center(slice))
      await touch(p, OPTION, 0, 'pointerup', center(slice))
      await tooltipText(p)

      await tapOutside(p)
      await p.quiesce()
      expect(await p.count(TOOLTIP)).toBe(0)
    })

    test('arrow-key stepping moves aria-activedescendant through the slices, and Escape dismisses', async () => {
      const p = await openFixture(chartFixture({ kind: 'donut' }), DESKTOP_1440)
      await p.raw.locator(LISTBOX).focus()

      await p.raw.keyboard.press('ArrowRight')
      await p.settle()
      expect(await activeDescendant(p)).toBe(await optionId(p, 0))

      await p.raw.keyboard.press('ArrowRight')
      await p.settle()
      expect(await activeDescendant(p)).toBe(await optionId(p, 1))

      await p.raw.keyboard.press('Escape')
      await p.settle()
      expect(await activeDescendant(p)).toBeNull()
    })
  })

  /**
   * Heatmap's grid (`useDiscreteCursor` with `columns: cols.length`) — the one kind whose keyboard
   * step is genuinely 2D: Left/Right move one cell, Up/Down jump a full row. The fixture's grid is
   * 5 rows × 4 columns (`HEAT_ROWS`/`HEAT_COLS` in `fixture/fixtures.tsx`), so a real row jump from
   * index 1 lands on index 5 — never index 2, which is what a Right-equivalent stride of 1 would
   * produce, and exactly the defect a `columns` mis-wire would look like.
   */
  describe('heatmap (discrete, 2D grid)', () => {
    test('a completed tap on a cell pins the tooltip past lift', async () => {
      const p = await openFixture(chartFixture({ kind: 'heatmap' }), DESKTOP_1440)
      const cell = await nthBox(p, OPTION, 0)

      await touch(p, OPTION, 0, 'pointerdown', center(cell))
      const shown = await tooltipText(p)
      expect(shown.length).toBeGreaterThan(0)

      await touch(p, OPTION, 0, 'pointerup', center(cell))
      await touch(p, OPTION, 0, 'pointercancel', center(cell))
      expect(await p.count(TOOLTIP)).toBe(1)
      expect(await tooltipText(p)).toBe(shown)
    })

    test('a cancelled press on a cell leaves no tooltip', async () => {
      const p = await openFixture(chartFixture({ kind: 'heatmap' }), DESKTOP_1440)
      const cell = await nthBox(p, OPTION, 0)

      await touch(p, OPTION, 0, 'pointerdown', center(cell))
      await touch(p, OPTION, 0, 'pointercancel', center(cell))
      await p.quiesce()
      expect(await p.count(TOOLTIP)).toBe(0)
    })

    test('a tap elsewhere in the grid moves the pin', async () => {
      const p = await openFixture(chartFixture({ kind: 'heatmap' }), DESKTOP_1440)
      const first = await nthBox(p, OPTION, 0)
      const second = await nthBox(p, OPTION, 5)

      await touch(p, OPTION, 0, 'pointerdown', center(first))
      await touch(p, OPTION, 0, 'pointerup', center(first))
      const before = await tooltipText(p)
      await touch(p, OPTION, 5, 'pointerdown', center(second))
      await touch(p, OPTION, 5, 'pointerup', center(second))
      const after = await tooltipText(p)

      expect(after).not.toBe(before)
      expect(await p.count(TOOLTIP)).toBe(1)
    })

    test('a tap outside the grid dismisses the pin', async () => {
      const p = await openFixture(chartFixture({ kind: 'heatmap' }), DESKTOP_1440)
      const cell = await nthBox(p, OPTION, 0)

      await touch(p, OPTION, 0, 'pointerdown', center(cell))
      await touch(p, OPTION, 0, 'pointerup', center(cell))
      await tooltipText(p)

      await tapOutside(p)
      await p.quiesce()
      expect(await p.count(TOOLTIP)).toBe(0)
    })

    test('ArrowDown steps aria-activedescendant a full row (the `columns` stride), and Escape dismisses', async () => {
      const p = await openFixture(chartFixture({ kind: 'heatmap' }), DESKTOP_1440)
      await p.raw.locator(LISTBOX).focus()

      await p.raw.keyboard.press('ArrowRight')
      await p.settle()
      expect(await activeDescendant(p)).toBe(await optionId(p, 0))

      await p.raw.keyboard.press('ArrowRight')
      await p.settle()
      expect(await activeDescendant(p)).toBe(await optionId(p, 1))

      await p.raw.keyboard.press('ArrowDown')
      await p.settle()
      expect(await activeDescendant(p)).toBe(await optionId(p, 5))

      await p.raw.keyboard.press('Escape')
      await p.settle()
      expect(await activeDescendant(p)).toBeNull()
    })
  })
})
