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
import { LAYOUT_TARGET } from './shell-slots'
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
    expect(Math.abs(peek.right - DESKTOP_1440.width)).toBeLessThanOrEqual(TOLERANCE)
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
