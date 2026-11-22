/**
 * `Peek` in a real shell (`fixture/v3/scenarios/shell-frame.ts`, `peek: true`): the panel is a
 * positioned box in the shell's aside region, so it sits between the header and the footer, does not
 * scroll with the page, leaves the page live behind it (no scrim, hits reach main), and fills the
 * content area on a phone. The address, the click handler and Escape are `src/router/peek.router.test.tsx`'s.
 *
 * v3 only.
 */
import { acquireShellTarget } from './shell-target'
import { afterAll, describe, expect, test } from 'bun:test'
import type { ShellFrameSpec } from './fixture/v3/scenarios/shell-frame'
import { LAYOUT_TARGET, PANEL_END } from './shell-slots'
import { DESKTOP_1440, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'

acquireShellTarget()
const ready = await initLayoutSuite()

afterAll(closeLayoutSuite)

const layout = ready && LAYOUT_TARGET === 'v3' ? describe : describe.skip

const SPEC: ShellFrameSpec = { sections: [], shellFrame: { peek: true, rows: 60 } }

const PEEK = '[data-slot="peek"]'
const MAIN = '[data-slot="shell-main"]'
const HEADER = '[data-slot="shell-header"]'
const TOLERANCE = 0.5
const REM = 16

layout('Peek over the shell at 1440', () => {
  test('sits between the header and the footer at the end edge, wider than 38rem and at most 52rem', async () => {
    const page = await openFixture(SPEC, DESKTOP_1440)
    const peek = (await page.box('peek', PEEK)).box
    const header = (await page.box('header', HEADER)).box
    const main = (await page.box('main', MAIN)).box
    expect(Math.abs(peek.top - header.bottom)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(peek.bottom - main.bottom)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(peek.right - (DESKTOP_1440.width - PANEL_END))).toBeLessThanOrEqual(TOLERANCE)
    expect(peek.width).toBeGreaterThanOrEqual(38 * REM - TOLERANCE)
    expect(peek.width).toBeLessThanOrEqual(52 * REM + TOLERANCE)
    expect(await page.count(`[data-slot="shell-aside"] ${PEEK}`)).toBe(1)
  })

  test('does not scroll with the page, and its own body scrolls', async () => {
    const page = await openFixture(SPEC, DESKTOP_1440)
    const before = (await page.box('peek', PEEK)).box
    const moved = await page.raw.evaluate(
      async ({ main, body }) => {
        const scroller = document.querySelector(main) as HTMLElement
        scroller.scrollTop = 300
        const inner = document.querySelector(body) as HTMLElement
        inner.scrollTop = 200
        await new Promise((r) => requestAnimationFrame(() => r(0)))
        return { page: scroller.scrollTop, peek: inner.scrollTop }
      },
      { main: MAIN, body: `${PEEK} [data-slot="scroll-area"]` },
    )
    const after = (await page.box('peek', PEEK)).box
    expect(moved.page).toBeGreaterThan(0)
    expect(moved.peek).toBeGreaterThan(0)
    expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(after.left - before.left)).toBeLessThanOrEqual(TOLERANCE)
  })

  test('is not modal: no scrim, nothing inert, and a point left of it hits the page', async () => {
    const page = await openFixture(SPEC, DESKTOP_1440)
    const peek = (await page.box('peek', PEEK)).box
    const probe = await page.raw.evaluate(
      ({ x, y, main }) => {
        const hit = document.elementFromPoint(x, y)
        return {
          inMain: hit?.closest(main) !== null,
          inert: document.querySelector('[inert]') !== null,
          scrim:
            document.querySelector('[data-slot="sheet-content"], [role="presentation"]') !== null,
        }
      },
      { x: peek.left - 20, y: peek.top + 200, main: MAIN },
    )
    expect(probe).toEqual({ inMain: true, inert: false, scrim: false })
  })

  test('takes focus on open and the close button closes it', async () => {
    const page = await openFixture(SPEC, DESKTOP_1440)
    const focused = await page.raw.evaluate(
      (peek) => document.activeElement === document.querySelector(peek),
      PEEK,
    )
    expect(focused).toBe(true)
    await page.tap(`${PEEK} button[aria-label="Close panel"]`)
    expect(await page.raw.evaluate(() => 'peekClosed' in document.documentElement.dataset)).toBe(
      true,
    )
  })
})

layout('Peek width handle at 1440', () => {
  const HANDLE = `${PEEK} [data-slot="peek-handle"]`

  test('a drag toward the start widens the panel, clamps at the content area less 3rem, and the page behind stays put', async () => {
    const page = await openFixture(SPEC, DESKTOP_1440)
    const before = (await page.box('peek', PEEK)).box
    const handle = (await page.box('handle', HANDLE)).box
    const y = handle.top + handle.height / 2
    const x = handle.left + handle.width / 2
    await page.raw.mouse.move(x, y)
    await page.raw.mouse.down()
    await page.raw.mouse.move(x - 100, y, { steps: 4 })
    await page.raw.mouse.up()
    const widened = (await page.box('peek', PEEK)).box
    expect(Math.abs(widened.width - (before.width + 100))).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(widened.right - (DESKTOP_1440.width - PANEL_END))).toBeLessThanOrEqual(
      TOLERANCE,
    )

    const nowHandle = (await page.box('handle', HANDLE)).box
    await page.raw.mouse.move(nowHandle.left + 2, y)
    await page.raw.mouse.down()
    await page.raw.mouse.move(2, y, { steps: 4 })
    await page.raw.mouse.up()
    const widest = (await page.box('peek', PEEK)).box
    expect(widest.width).toBeLessThanOrEqual(DESKTOP_1440.width - 3 * REM + TOLERANCE)
    expect(widest.width).toBeGreaterThan(widened.width)
  })

  test('the keyboard resizes the focused handle and Enter returns to the default', async () => {
    const page = await openFixture(SPEC, DESKTOP_1440)
    const start = (await page.box('peek', PEEK)).box
    await page.raw.focus(HANDLE)
    await page.raw.keyboard.press('ArrowLeft')
    const wider = (await page.box('peek', PEEK)).box
    expect(Math.abs(wider.width - (start.width + 16))).toBeLessThanOrEqual(TOLERANCE)
    await page.raw.keyboard.press('Home')
    const home = (await page.box('peek', PEEK)).box
    expect(Math.abs(home.width - 24 * REM)).toBeLessThanOrEqual(TOLERANCE)
    await page.raw.keyboard.press('Enter')
    const reset = (await page.box('peek', PEEK)).box
    expect(Math.abs(reset.width - start.width)).toBeLessThanOrEqual(TOLERANCE)
    // The value is read in a passive effect, a frame after the press.
    await page.raw.waitForFunction(
      ({ sel, want }) => {
        const now = Number(document.querySelector(sel)?.getAttribute('aria-valuenow'))
        return Math.abs(now - want) <= 1
      },
      { sel: HANDLE, want: start.width },
    )
  })
})

layout('Peek over the shell at 390 has no handle', () => {
  test('the whole-area panel draws no width handle', async () => {
    const page = await openFixture(SPEC, PHONE)
    expect(await page.count(`${PEEK} [data-slot="peek-handle"]`)).toBe(0)
  })
})

layout('Peek over the shell at 390', () => {
  test('fills the whole content area, between the header and the tab bar', async () => {
    const page = await openFixture(SPEC, PHONE)
    const peek = (await page.box('peek', PEEK)).box
    const main = (await page.box('main', MAIN)).box
    expect(Math.abs(peek.width - PHONE.width)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(peek.top - main.top)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(peek.bottom - main.bottom)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(peek.right - PHONE.width)).toBeLessThanOrEqual(TOLERANCE)
  })
})
