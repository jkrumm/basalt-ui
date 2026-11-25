/**
 * The one panel anatomy in a real shell (`fixture/v3/scenarios/shell-frame.ts`): `Peek`, `Dock`,
 * `PageAside` and a right `Sheet` draw the same header (height, insets, title face, close
 * button, hairline) and each resizes from its inner edge; a peek in any presentation leaves no
 * scrim and nothing inert on a wide screen, so the page behind stays usable; and at 390 every
 * presentation is a bottom sheet. The address and the keys are `src/page/peek-present.test.tsx`'s.
 *
 * v3 only.
 */
import { acquireShellTarget } from './shell-target'
import { afterAll, describe, expect, test } from 'bun:test'
import type { ShellFrameSpec } from './fixture/v3/scenarios/shell-frame'
import { LAYOUT_TARGET } from './shell-slots'
import { PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'

acquireShellTarget()
const ready = await initLayoutSuite()

afterAll(closeLayoutSuite)

const layout = ready && LAYOUT_TARGET === 'v3' ? describe : describe.skip

type Frame = NonNullable<ShellFrameSpec['shellFrame']>
const specOf = (shellFrame: Frame): ShellFrameSpec => ({ sections: [], shellFrame })

const WIDE: Viewport = { name: 'wide', width: 1800, height: 1200 }
const TOLERANCE = 0.5
const MAIN = '[data-slot="shell-main"]'
const PEEK = '[data-slot="peek"]'
const SHEET = '[data-slot="sheet-content"]'

const PANELS: readonly { name: string; frame: Frame; panel: string }[] = [
  { name: 'Peek', frame: { peek: true }, panel: PEEK },
  { name: 'Dock', frame: { dock: true }, panel: '[data-slot="dock"]' },
  // Bound to an open state, so it has a close button to measure.
  {
    name: 'PageAside',
    frame: { aside: { dock: 'always', state: true } },
    panel: '[data-slot="page-aside"]',
  },
  { name: 'Sheet', frame: { sheet: true }, panel: SHEET },
]

type Anatomy = {
  height: number
  lead: number
  end: number
  close: { w: number; h: number }
  font: string
  weight: string
  hairline: string
  atTop: boolean
  /** The page bar band's height, or null where the frame has none. */
  band: number | null
}

async function anatomyOf(frame: Frame, panel: string): Promise<Anatomy> {
  const page = await openFixture(specOf(frame), WIDE)
  await page.raw.waitForSelector(`${panel} [data-panel="header"]`)
  return page.raw.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement
    const header = el.querySelector('[data-panel="header"]') as HTMLElement
    const h = header.getBoundingClientRect()
    const first = (header.firstElementChild as HTMLElement).getBoundingClientRect()
    const close = (
      header.querySelector('[data-panel="close"]') as HTMLElement
    ).getBoundingClientRect()
    const title = getComputedStyle(header.querySelector('h2') as HTMLElement)
    return {
      height: h.height,
      lead: first.left - h.left,
      end: h.right - close.right,
      close: { w: close.width, h: close.height },
      font: title.fontSize,
      weight: title.fontWeight,
      hairline: getComputedStyle(header).borderBottomWidth,
      atTop: Math.abs(h.top - el.getBoundingClientRect().top) <= 1,
      band:
        document.querySelector('[data-slot="page-bar"]')?.getBoundingClientRect().height ?? null,
    }
  }, panel)
}

layout('one panel anatomy at 1800', () => {
  test('Peek, Dock, PageAside and a right Sheet draw the same header', async () => {
    const all: Record<string, Anatomy> = {}
    for (const { name, frame, panel } of PANELS) all[name] = await anatomyOf(frame, panel)
    const peek = all['Peek'] as Anatomy
    for (const [name, a] of Object.entries(all)) {
      expect({ name, lead: Math.round(a.lead), end: Math.round(a.end) }).toEqual({
        name,
        lead: 16,
        end: Math.round(peek.end),
      })
      expect({
        name,
        close: a.close,
        font: a.font,
        weight: a.weight,
        hairline: a.hairline,
      }).toEqual({
        name,
        close: peek.close,
        font: peek.font,
        weight: peek.weight,
        hairline: '1px',
      })
      expect(a.atTop).toBe(true)
    }
    // The three shell panels take the page bar band's height, so their hairline meets the band's.
    for (const name of ['Peek', 'Dock', 'PageAside']) {
      const a = all[name] as Anatomy
      expect({ name, band: a.band !== null }).toEqual({ name, band: true })
      expect(Math.abs(a.height - (a.band ?? 0))).toBeLessThanOrEqual(TOLERANCE)
    }
    // A Sheet is a layer over the whole app, beside no band: the header's own 48px.
    expect(Math.abs((all['Sheet'] as Anatomy).height - 48)).toBeLessThanOrEqual(TOLERANCE)
  })

  for (const { name, frame, panel } of PANELS) {
    test(`${name} resizes from its inner edge: ArrowLeft on the handle widens it by 16px, Enter resets it`, async () => {
      const page = await openFixture(specOf(frame), WIDE)
      const handle = `${panel} [data-panel="handle"]`
      await page.raw.waitForSelector(handle)
      const before = (await page.box('panel', panel)).box
      await page.raw.focus(handle)
      await page.raw.keyboard.press('ArrowLeft')
      await page.raw.waitForFunction(
        ({ sel, want }) =>
          Math.abs(
            (document.querySelector(sel) as HTMLElement).getBoundingClientRect().width - want,
          ) <= 0.5,
        { sel: panel, want: before.width + 16 },
      )
      const label = await page.raw.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement
        return { role: el.getAttribute('role'), now: el.getAttribute('aria-valuenow') }
      }, handle)
      expect(label.role).toBe('separator')
      expect(label.now).not.toBeNull()
      await page.raw.keyboard.press('Enter')
      await page.raw.waitForFunction(
        ({ sel, want }) =>
          Math.abs(
            (document.querySelector(sel) as HTMLElement).getBoundingClientRect().width - want,
          ) <= 0.5,
        { sel: panel, want: before.width },
      )
    })
  }

  test('a docked PageAside that widens takes the width from main', async () => {
    const page = await openFixture(specOf({ aside: { dock: 'always' } }), WIDE)
    const handle = '[data-slot="page-aside"] [data-panel="handle"]'
    await page.raw.waitForSelector(handle)
    const main = (await page.box('main', MAIN)).box
    await page.raw.focus(handle)
    await page.raw.keyboard.press('ArrowLeft')
    await page.raw.waitForFunction(
      ({ sel, want }) =>
        Math.abs(
          (document.querySelector(sel) as HTMLElement).getBoundingClientRect().width - want,
        ) <= 0.5,
      { sel: MAIN, want: main.width - 16 },
    )
  })
})

/** No scrim, nothing inert, and a point at `x`, `y` hits the page behind. */
async function probe(
  page: Awaited<ReturnType<typeof openFixture>>,
  at: { x: number; y: number } | null,
): Promise<{ inMain: boolean; inert: boolean; scrim: boolean }> {
  return page.raw.evaluate(
    ({ point, main }) => ({
      inMain: point === null || document.elementFromPoint(point.x, point.y)?.closest(main) !== null,
      inert: document.querySelector('[inert]') !== null,
      scrim: document.querySelector('.bg-scrim, [data-slot="sheet-content"]') !== null,
    }),
    { point: at, main: MAIN },
  )
}

layout('a record presentation leaves the page usable at 1800', () => {
  test('peek: the side panel, and a point left of it hits the page', async () => {
    const page = await openFixture(specOf({ peek: true, present: 'peek' }), WIDE)
    const box = (await page.box('peek', `${PEEK}[data-present="peek"]`)).box
    expect(await probe(page, { x: box.left - 20, y: box.top + 200 })).toEqual({
      inMain: true,
      inert: false,
      scrim: false,
    })
  })

  test('window: a floating window over the page, and a point outside it hits the page', async () => {
    const page = await openFixture(specOf({ peek: true, present: 'window' }), WIDE)
    const box = (await page.box('window', `${PEEK}[data-present="window"]`)).box
    expect(box.width).toBeGreaterThan(360)
    expect(box.left).toBeGreaterThan(0)
    expect(box.right).toBeLessThan(WIDE.width)
    expect(await probe(page, { x: box.left - 20, y: box.top + 100 })).toEqual({
      inMain: true,
      inert: false,
      scrim: false,
    })
    expect(await page.count('[data-panel="window-edge"]')).toBe(8)
  })

  test('page: covers main exactly, the page stays mounted under it, and nothing is inert', async () => {
    const page = await openFixture(specOf({ peek: true, present: 'page' }), WIDE)
    const box = (await page.box('page', `${PEEK}[data-present="page"]`)).box
    const main = (await page.box('main', MAIN)).box
    expect(Math.abs(box.left - main.left)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(box.right - main.right)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(box.top - main.top)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(box.bottom - main.bottom)).toBeLessThanOrEqual(TOLERANCE)
    expect(await page.count('[data-testid="table"]')).toBe(1)
    expect(await probe(page, null)).toEqual({ inMain: true, inert: false, scrim: false })
  })
})

layout('drawer: a short panel at the foot of main at 1800', () => {
  const HANDLE = `${PEEK}[data-present="drawer"] [data-slot="peek-handle"]`

  test('rests at a third of the viewport on main, the rows above stay usable and scroll clear of it', async () => {
    const page = await openFixture(specOf({ peek: true, present: 'drawer' }), WIDE)
    const box = (await page.box('drawer', `${PEEK}[data-present="drawer"]`)).box
    const main = (await page.box('main', MAIN)).box
    expect(Math.abs(box.height - WIDE.height / 3)).toBeLessThanOrEqual(2)
    expect(Math.abs(box.bottom - main.bottom)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(box.left - main.left)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(box.right - main.right)).toBeLessThanOrEqual(TOLERANCE)
    // the page above it is live: no scrim, nothing inert, a point over the drawer's top edge hits main
    expect(await probe(page, { x: box.left + 200, y: box.top - 20 })).toEqual({
      inMain: true,
      inert: false,
      scrim: false,
    })
    // and main's scrollport is padded by the drawer's height, so the last row scrolls above it
    const padding = await page.raw.evaluate(
      (sel) => Number.parseFloat(getComputedStyle(document.querySelector(sel)!).paddingBottom),
      MAIN,
    )
    expect(Math.abs(padding - box.height)).toBeLessThanOrEqual(1)
  })

  test('its top edge drags up to the whole of main; ArrowDown shrinks it, Enter puts it back', async () => {
    const page = await openFixture(specOf({ peek: true, present: 'drawer' }), WIDE)
    await page.raw.waitForSelector(HANDLE)
    const rest = (await page.box('drawer', `${PEEK}[data-present="drawer"]`)).box
    const main = (await page.box('main', MAIN)).box
    const handle = (await page.box('handle', HANDLE)).box
    const x = handle.left + handle.width / 2
    const y = handle.top + handle.height / 2
    await page.raw.mouse.move(x, y)
    await page.raw.mouse.down()
    await page.raw.mouse.move(x, y - 150, { steps: 6 })
    await page.raw.mouse.up()
    const grown = (await page.box('drawer', `${PEEK}[data-present="drawer"]`)).box
    expect(Math.abs(grown.height - (rest.height + 150))).toBeLessThanOrEqual(2)
    await page.raw.mouse.move(x, y - 150)
    await page.raw.mouse.down()
    await page.raw.mouse.move(x, main.top - 200, { steps: 6 })
    await page.raw.mouse.up()
    const full = (await page.box('drawer', `${PEEK}[data-present="drawer"]`)).box
    expect(Math.abs(full.height - main.height)).toBeLessThanOrEqual(2)
    expect(Math.abs(full.top - main.top)).toBeLessThanOrEqual(2)
    await page.raw.focus(HANDLE)
    await page.raw.keyboard.press('ArrowDown')
    const less = (await page.box('drawer', `${PEEK}[data-present="drawer"]`)).box
    expect(Math.abs(less.height - (full.height - 16))).toBeLessThanOrEqual(1)
    await page.raw.keyboard.press('Enter')
    await page.raw.waitForFunction(
      ({ sel, want }) =>
        Math.abs(
          (document.querySelector(sel) as HTMLElement).getBoundingClientRect().height - want,
        ) <= 2,
      { sel: `${PEEK}[data-present="drawer"]`, want: rest.height },
    )
  })
})

layout('drawer at 390: a bottom sheet without the scrim, at a third of the screen', () => {
  test('the page behind stays live and a record taller than a third rests at a third', async () => {
    const page = await openFixture(specOf({ peek: true, present: 'drawer' }), PHONE)
    await page.raw.waitForSelector(`${SHEET}[data-present="drawer"]`)
    await page.settle()
    const sheet = (await page.box('sheet', SHEET)).box
    // 90dvh tall, resting with its top at two thirds of the screen: a third is showing
    expect(Math.abs(sheet.top - PHONE.height * (2 / 3))).toBeLessThanOrEqual(2)
    expect(await page.count('.bg-scrim')).toBe(0)
    expect(await page.raw.evaluate(() => document.querySelector('[inert]') !== null)).toBe(false)
    // a tap above the drawer lands on the page, not on a backdrop
    expect(
      await page.raw.evaluate(
        () => document.elementFromPoint(100, 100)?.closest('[data-slot="sheet-content"]') === null,
      ),
    ).toBe(true)
  })
})

layout('every presentation is a bottom sheet at 390', () => {
  for (const present of ['peek', 'window', 'page'] as const) {
    test(`${present}`, async () => {
      const page = await openFixture(specOf({ peek: true, present }), PHONE)
      await page.raw.waitForSelector(`${SHEET}[data-present="sheet"]`)
      const sheet = (await page.box('sheet', SHEET)).box
      expect(Math.abs(sheet.bottom - PHONE.height)).toBeLessThanOrEqual(1)
      expect(Math.abs(sheet.width - PHONE.width)).toBeLessThanOrEqual(1)
      expect(await page.count('.bg-scrim')).toBe(1)
      expect(await page.count(`${PEEK}`)).toBe(0)
    })
  }
})
