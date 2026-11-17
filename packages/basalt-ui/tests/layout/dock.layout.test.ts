/**
 * `Dock` in a real shell (`fixture/v3/scenarios/shell-frame.ts`, `dock`): a fourth grid track at the
 * end edge that pushes main while there is room for it and overlays main when there is none or on a
 * phone; it sits beside a docked `PageAside`, never under it; the page behind stays live; and the
 * push eases while the width changes, not at load and not under reduced motion. The address, the
 * pin and the click rule are `src/router/peek.router.test.tsx`'s.
 *
 * v3 only.
 */
import { acquireShellTarget } from './shell-target'
import { afterAll, describe, expect, test } from 'bun:test'
import type { ShellFrameSpec } from './fixture/v3/scenarios/shell-frame'
import { LAYOUT_TARGET } from './shell-slots'
import {
  DESKTOP_1440,
  LAPTOP_1024,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'
import type { Viewport } from './harness'

acquireShellTarget()
const ready = await initLayoutSuite()

afterAll(closeLayoutSuite)

const layout = ready && LAYOUT_TARGET === 'v3' ? describe : describe.skip

const specOf = (shellFrame: NonNullable<ShellFrameSpec['shellFrame']>): ShellFrameSpec => ({
  sections: [],
  shellFrame,
})

const DOCK = '[data-slot="dock"]'
const REGION = '[data-slot="shell-dock"]'
const ASIDE = '[data-slot="shell-aside"]'
const MAIN = '[data-slot="shell-main"]'
const HEADER = '[data-slot="shell-header"]'
const TOLERANCE = 0.5
const DOCK_PX = 416
const RAIL_EXPANDED = 240
const RAIL_MEDIUM = 64
const WIDE: Viewport = { name: 'wide', width: 1800, height: 900 }

const near = (a: number, b: number): void => {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(TOLERANCE)
}

layout('Dock over the shell at 1440', () => {
  test('docks at the end edge between the header and the footer and main gives up its width', async () => {
    const page = await openFixture(specOf({ dock: true }), DESKTOP_1440)
    const dock = (await page.box('dock', DOCK)).box
    const header = (await page.box('header', HEADER)).box
    const main = (await page.box('main', MAIN)).box
    near(dock.top, header.bottom)
    near(dock.bottom, main.bottom)
    near(dock.right, DESKTOP_1440.width)
    near(dock.width, DOCK_PX)
    near(main.right, dock.left)
    near(main.width, DESKTOP_1440.width - RAIL_EXPANDED - DOCK_PX)
    expect(await page.count(`${REGION}[data-state="docked"] ${DOCK}`)).toBe(1)
    near((await page.box('region', REGION)).box.width, DOCK_PX)
    near((await page.box('aside', ASIDE)).box.width, 0)
  })

  test('closed it reserves nothing: main takes the whole content area', async () => {
    const page = await openFixture(specOf({ dock: 'toggle' }), DESKTOP_1440)
    near((await page.box('region', REGION)).box.width, 0)
    near((await page.box('main', MAIN)).box.width, DESKTOP_1440.width - RAIL_EXPANDED)
    expect(await page.count(DOCK)).toBe(0)
  })

  test('is not modal: no scrim, nothing inert, a point left of it hits the page', async () => {
    const page = await openFixture(specOf({ dock: true }), DESKTOP_1440)
    const dock = (await page.box('dock', DOCK)).box
    const probe = await page.raw.evaluate(
      ({ x, y, main }) => ({
        inMain: document.elementFromPoint(x, y)?.closest(main) !== null,
        inert: document.querySelector('[inert]') !== null,
        scrim:
          document.querySelector('[data-slot="sheet-content"], [role="presentation"]') !== null,
      }),
      { x: dock.left - 20, y: dock.top + 200, main: MAIN },
    )
    expect(probe).toEqual({ inMain: true, inert: false, scrim: false })
  })

  test('does not scroll with the page, and its own body scrolls', async () => {
    const page = await openFixture(specOf({ dock: true, rows: 60 }), DESKTOP_1440)
    const before = (await page.box('dock', DOCK)).box
    const moved = await page.raw.evaluate(
      async ({ main, body }) => {
        const scroller = document.querySelector(main) as HTMLElement
        scroller.scrollTop = 300
        const inner = document.querySelector(body) as HTMLElement
        inner.scrollTop = 200
        await new Promise((r) => requestAnimationFrame(() => r(0)))
        return { page: scroller.scrollTop, dock: inner.scrollTop }
      },
      { main: MAIN, body: `${DOCK} [data-slot="scroll-area"]` },
    )
    const after = (await page.box('dock', DOCK)).box
    expect(moved.page).toBeGreaterThan(0)
    expect(moved.dock).toBeGreaterThan(0)
    near(after.top, before.top)
    near(after.left, before.left)
  })

  test('takes focus on open and the close button closes it', async () => {
    const page = await openFixture(specOf({ dock: true }), DESKTOP_1440)
    expect(
      await page.raw.evaluate((s) => document.activeElement === document.querySelector(s), DOCK),
    ).toBe(true)
    await page.tap(`${DOCK} button[aria-label="Close panel"]`)
    expect(await page.raw.evaluate(() => 'dockClosed' in document.documentElement.dataset)).toBe(
      true,
    )
    near((await page.box('main', MAIN)).box.width, DESKTOP_1440.width - RAIL_EXPANDED)
  })
})

layout('Dock beside a docked PageAside', () => {
  test('the order is main, the aside, then the dock, and nothing overlaps', async () => {
    const page = await openFixture(
      specOf({ dock: true, aside: { dock: 'always', width: 360 } }),
      WIDE,
    )
    const main = (await page.box('main', MAIN)).box
    const aside = (await page.box('aside', ASIDE)).box
    const dock = (await page.box('dock', DOCK)).box
    near(aside.width, 360)
    near(dock.width, DOCK_PX)
    near(main.right, aside.left)
    near(aside.right, dock.left)
    near(dock.right, WIDE.width)
    near(main.width, WIDE.width - RAIL_EXPANDED - 360 - DOCK_PX)
  })
})

layout('Dock with no room', () => {
  test('at 1024 it overlays main at the end edge and main keeps its width', async () => {
    const without = await openFixture(specOf({ dock: 'toggle' }), LAPTOP_1024)
    const full = (await without.box('main', MAIN)).box.width
    const page = await openFixture(specOf({ dock: true }), LAPTOP_1024)
    const dock = (await page.box('dock', DOCK)).box
    const main = (await page.box('main', MAIN)).box
    expect(await page.count(`${REGION}[data-state="overlay"] ${DOCK}`)).toBe(1)
    near(main.width, full)
    near(main.width, LAPTOP_1024.width - RAIL_MEDIUM)
    near((await page.box('region', REGION)).box.width, 0)
    near(dock.right, LAPTOP_1024.width)
    near(dock.width, DOCK_PX)
    expect(dock.left).toBeLessThan(main.right)
  })
})

layout('Dock on a phone', () => {
  test('fills the content area, between the header and the tab bar', async () => {
    const page = await openFixture(specOf({ dock: true }), PHONE)
    const dock = (await page.box('dock', DOCK)).box
    const main = (await page.box('main', MAIN)).box
    near(dock.width, PHONE.width)
    near(dock.top, main.top)
    near(dock.bottom, main.bottom)
    near(dock.right, PHONE.width)
    near((await page.box('region', REGION)).box.width, 0)
  })
})

/** Main's width on each frame for `frames` frames, after `act` ran in the page. */
async function sampleMain(
  page: Awaited<ReturnType<typeof openFixture>>,
  act: 'toggle' | 'none',
  frames: number,
): Promise<number[]> {
  return page.raw.evaluate(
    async ({ main, act: what, frames: n }) => {
      const el = document.querySelector(main) as HTMLElement
      if (what === 'toggle') {
        ;(document.querySelector('[data-testid="dock-toggle"]') as HTMLElement).click()
      }
      const widths: number[] = []
      for (let i = 0; i < n; i += 1) {
        await new Promise((r) => requestAnimationFrame(() => r(0)))
        widths.push(el.getBoundingClientRect().width)
      }
      return widths
    },
    { main: MAIN, act, frames },
  )
}

const START = DESKTOP_1440.width - RAIL_EXPANDED
const END = START - DOCK_PX

layout('Dock motion', () => {
  test('the push eases: main passes through widths between the two ends and settles on the last', async () => {
    const page = await openFixture(specOf({ dock: 'toggle' }), DESKTOP_1440, '/', 'no-preference')
    const widths = await sampleMain(page, 'toggle', 60)
    const between = widths.filter((w) => w > END + 1 && w < START - 1)
    expect(between.length).toBeGreaterThan(2)
    expect(widths.every((w, i) => i === 0 || w <= (widths[i - 1] ?? START) + TOLERANCE)).toBe(true)
    near(widths.at(-1) ?? 0, END)
  })

  test('the width eases back on close, and the easing switches itself off afterwards', async () => {
    const page = await openFixture(specOf({ dock: 'toggle' }), DESKTOP_1440, '/', 'no-preference')
    await sampleMain(page, 'toggle', 60)
    const back = await sampleMain(page, 'toggle', 60)
    expect(back.some((w) => w > END + 1 && w < START - 1)).toBe(true)
    near(back.at(-1) ?? 0, START)
    expect(
      await page.raw.evaluate(() => document.querySelector('[data-dock-shift]') !== null),
    ).toBe(false)
  })

  test('a dock already open at load does not ease', async () => {
    const page = await openFixture(specOf({ dock: true }), DESKTOP_1440, '/', 'no-preference')
    const widths = await sampleMain(page, 'none', 6)
    for (const w of widths) near(w, END)
  })

  test('under reduced motion the push has no intermediate widths', async () => {
    const page = await openFixture(specOf({ dock: 'toggle' }), DESKTOP_1440, '/', 'reduce')
    const widths = await sampleMain(page, 'toggle', 30)
    expect(
      widths.every((w) => Math.abs(w - START) <= TOLERANCE || Math.abs(w - END) <= TOLERANCE),
    ).toBe(true)
    near(widths.at(-1) ?? 0, END)
  })
})
