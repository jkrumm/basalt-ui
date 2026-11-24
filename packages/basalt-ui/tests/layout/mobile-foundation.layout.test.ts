/**
 * The mobile foundation in a real browser, on the shell-frame scenario (`fixture/v3/scenarios`):
 *
 * - safe areas: with non-zero insets emulated on all four sides (`Emulation.setSafeAreaInsetsOverride`)
 *   the shell pads top, left and right, the tab bar owns the bottom inset on a phone and the root owns
 *   it from `md`, and a bottom Sheet keeps its content clear of the home indicator and the notch;
 * - the keyboard: while a text field has focus under a coarse pointer the bottom bar is gone, a field
 *   in a Sheet stays inside the visual viewport, a checkbox or a fine pointer never hides the bar;
 * - the Sheet: a grabber, a content-height rest capped at 90dvh, snap points that move it and a drag
 *   down that dismisses it.
 *
 * Assertions are relations and bounds, never font-metric pixels. v3 only.
 */
import { acquireShellTarget } from './shell-target'
import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync } from 'node:fs'
import { providedSlots } from './fixture/v3/registry'
import type { ShellFrameSpec } from './fixture/v3/scenarios/shell-frame'
import { LAYOUT_TARGET, S } from './shell-slots'
import { DESKTOP_1440, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { LayoutPage } from './harness'
import { slot } from './harness/slots'

acquireShellTarget()
const ready = await initLayoutSuite()

afterAll(closeLayoutSuite)

const runnable =
  ready &&
  LAYOUT_TARGET === 'v3' &&
  ['shell-header', 'shell-main', 'shell-tab-bar'].every((name) => providedSlots().has(name))
const layout = runnable ? describe : describe.skip

const specOf = (shellFrame: NonNullable<ShellFrameSpec['shellFrame']> = {}): ShellFrameSpec => ({
  sections: [],
  shellFrame,
})

const ROOT = slot('shell')
const HEADER = S('shell-header')
const BAR = slot('shell-tab-bar')
const FOOTER = slot('shell-footer')
const SHEET = slot('sheet-content')
const GRABBER = '[data-panel="grabber"]'

const INSETS = { top: 47, left: 20, bottom: 34, right: 30 } as const

/** Frames of the Sheet at 390, for the pull request (`FRAMES_DIR`). */
const FRAMES_DIR = process.env['FRAMES_DIR']

/** The safe areas a notched phone reports, emulated: `env(safe-area-inset-*)` reads them. */
async function emulateInsets(p: LayoutPage): Promise<void> {
  const session = await p.raw.context().newCDPSession(p.raw)
  await session.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS })
  await p.settle()
}

const px = (value: string): number => Number.parseFloat(value)

async function frame(p: LayoutPage, name: string): Promise<void> {
  if (FRAMES_DIR === undefined) return
  mkdirSync(FRAMES_DIR, { recursive: true })
  await p.raw.screenshot({ path: `${FRAMES_DIR}/${name}.png` })
}

const boxOf = (p: LayoutPage, selector: string) =>
  p.raw.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel)
    if (el === null) return null
    const r = el.getBoundingClientRect()
    return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, height: r.height }
  }, selector)

layout('Mobile foundation — safe areas', () => {
  test('on a phone the shell pads top, left and right and the tab bar owns the bottom inset', async () => {
    const p = await openFixture(specOf({ pageField: true }), PHONE)
    await emulateInsets(p)
    const pad = await p.raw.evaluate((sel) => {
      const s = getComputedStyle(document.querySelector<HTMLElement>(sel)!)
      return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(Number.parseFloat)
    }, ROOT)
    expect(pad).toEqual([INSETS.top, INSETS.right, 0, INSETS.left])
    const header = await boxOf(p, HEADER)
    expect(header!.top).toBeGreaterThanOrEqual(INSETS.top)
    const bar = await boxOf(p, BAR)
    // the bar's own row ends INSETS.bottom above the screen edge, its footer fills the inset
    expect(PHONE.height - bar!.bottom).toBeCloseTo(INSETS.bottom, 0)
    expect(bar!.left).toBeGreaterThanOrEqual(INSETS.left)
    expect(bar!.right).toBeLessThanOrEqual(PHONE.width - INSETS.right)
  })

  test('from md the root owns the bottom inset', async () => {
    const p = await openFixture(specOf({}), DESKTOP_1440, '/', 'reduce', 'fine')
    await emulateInsets(p)
    const bottom = await p.raw.evaluate(
      (sel) => getComputedStyle(document.querySelector<HTMLElement>(sel)!).paddingBottom,
      ROOT,
    )
    expect(px(bottom)).toBe(INSETS.bottom)
  })

  test('a bottom Sheet keeps its content clear of the notch and the home indicator', async () => {
    const p = await openFixture(specOf({ sheet: { form: true } }), PHONE)
    await emulateInsets(p)
    await p.raw.waitForSelector(SHEET)
    await p.settle()
    const pad = await p.raw.evaluate((sel) => {
      const s = getComputedStyle(document.querySelector<HTMLElement>(sel)!)
      return [s.paddingRight, s.paddingBottom, s.paddingLeft].map(Number.parseFloat)
    }, SHEET)
    expect(pad).toEqual([INSETS.right, INSETS.bottom, INSETS.left])
    const sheet = await boxOf(p, SHEET)
    const save = await boxOf(p, '[data-testid="sheet-save"]')
    expect(sheet!.bottom).toBeCloseTo(PHONE.height, 0)
    expect(save!.bottom).toBeLessThanOrEqual(PHONE.height - INSETS.bottom)
    await frame(p, 'sheet-content-insets')
  })
})

layout('Mobile foundation — the keyboard', () => {
  const barShown = (p: LayoutPage) =>
    p.raw.evaluate((sel) => document.querySelector(sel)!.checkVisibility(), FOOTER)

  test('focusing a text field hides the bottom bar and leaving it brings the bar back', async () => {
    const p = await openFixture(specOf({ pageField: true }), PHONE)
    expect(await barShown(p)).toBe(true)
    await p.raw.focus('[data-testid="field-page"]')
    await p.raw.waitForFunction(() =>
      document.querySelector('[data-slot="shell"]')?.hasAttribute('data-keyboard'),
    )
    expect(await barShown(p)).toBe(false)
    await p.raw.evaluate(() => (document.activeElement as HTMLElement).blur())
    await p.raw.waitForFunction(
      () => !document.querySelector('[data-slot="shell"]')?.hasAttribute('data-keyboard'),
    )
    expect(await barShown(p)).toBe(true)
  })

  test('a fine pointer keeps the bar: a mouse has no software keyboard', async () => {
    const p = await openFixture(specOf({ pageField: true }), PHONE, '/', 'reduce', 'fine')
    await p.raw.focus('[data-testid="field-page"]')
    await p.settle()
    expect(
      await p.raw.evaluate(() =>
        document.querySelector('[data-slot="shell"]')?.hasAttribute('data-keyboard'),
      ),
    ).toBe(false)
  })

  test('a field inside a Sheet stays visible and the bar is gone', async () => {
    const p = await openFixture(specOf({ sheet: { form: true } }), PHONE)
    await p.raw.waitForSelector(SHEET)
    await p.raw.focus('[data-testid="field-sheet-end"]')
    await p.raw.waitForFunction(() =>
      document.querySelector('[data-slot="shell"]')?.hasAttribute('data-keyboard'),
    )
    await p.settle()
    expect(await barShown(p)).toBe(false)
    const field = await boxOf(p, '[data-testid="field-sheet-end"]')
    expect(field!.top).toBeGreaterThanOrEqual(0)
    expect(field!.bottom).toBeLessThanOrEqual(PHONE.height)
    await frame(p, 'sheet-keyboard')
  })
})

layout('Mobile foundation — the Sheet', () => {
  const TOP = (p: LayoutPage) => boxOf(p, SHEET)

  test('a bottom Sheet has a grabber and hugs its content under 90dvh', async () => {
    const p = await openFixture(specOf({ sheet: true }), PHONE)
    await p.raw.waitForSelector(SHEET)
    await p.settle()
    expect(await p.count(GRABBER)).toBe(1)
    const sheet = (await TOP(p))!
    expect(sheet.height).toBeLessThan(PHONE.height * 0.5)
    await frame(p, 'sheet-content-height')
    const tall = await openFixture(specOf({ sheet: { form: true } }), PHONE)
    await tall.raw.waitForSelector(SHEET)
    await tall.settle()
    const capped = (await TOP(tall))!
    expect(capped.height).toBeLessThanOrEqual(PHONE.height * 0.9 + 1)
    expect(capped.height).toBeGreaterThan(PHONE.height * 0.85)
    await frame(tall, 'sheet-capped')
  })

  test('a right Sheet has no grabber', async () => {
    const p = await openFixture(specOf({ sheet: true }), DESKTOP_1440, '/', 'reduce', 'fine')
    await p.raw.waitForSelector(SHEET)
    expect(await p.count(GRABBER)).toBe(0)
  })

  test('snap points: it opens at half, a drag up rests it at 90 %, a drag down dismisses it', async () => {
    const p = await openFixture(
      specOf({ sheet: { form: true, snapPoints: ['half', 'full'] } }),
      PHONE,
    )
    await p.raw.waitForSelector(SHEET)
    await p.settle()
    const half = (await TOP(p))!
    expect(Math.abs(half.top - PHONE.height * 0.5)).toBeLessThan(PHONE.height * 0.06)
    const save = (await boxOf(p, '[data-testid="sheet-save"]'))!
    expect(save.bottom).toBeLessThanOrEqual(PHONE.height)
    await frame(p, 'sheet-snap-half')
    const x = PHONE.width / 2
    await p.raw.mouse.move(x, half.top + 12)
    await p.raw.mouse.down()
    await p.raw.mouse.move(x, half.top - 140, { steps: 8 })
    await p.raw.mouse.up()
    await p.settle()
    await p.raw.waitForFunction(
      ([sel, top]) =>
        (document.querySelector(sel as string)?.getBoundingClientRect().top ?? 1e9) <
        (top as number) - 60,
      [SHEET, half.top] as const,
    )
    const full = (await TOP(p))!
    expect(Math.abs(full.top - PHONE.height * 0.1)).toBeLessThan(PHONE.height * 0.06)
    await frame(p, 'sheet-snap-full')
    await p.raw.mouse.move(x, full.top + 12)
    await p.raw.mouse.down()
    await p.raw.mouse.move(x, PHONE.height - 20, { steps: 10 })
    await p.raw.mouse.up()
    await p.raw.waitForSelector(SHEET, { state: 'detached' })
  })

  test('a drag down on a content-height Sheet past half its height dismisses it', async () => {
    const p = await openFixture(specOf({ sheet: true }), PHONE)
    await p.raw.waitForSelector(SHEET)
    await p.settle()
    const sheet = (await TOP(p))!
    const x = PHONE.width / 2
    await p.raw.mouse.move(x, sheet.top + 12)
    await p.raw.mouse.down()
    await p.raw.mouse.move(x, PHONE.height - 10, { steps: 10 })
    await p.raw.mouse.up()
    await p.raw.waitForSelector(SHEET, { state: 'detached' })
  })

  test('scroll inside a Sheet body does not chain to the page', async () => {
    const p = await openFixture(specOf({ sheet: { form: true } }), PHONE)
    await p.raw.waitForSelector(SHEET)
    expect(await p.computed('[data-panel="body"]', 'overscroll-behavior-y')).toBe('contain')
  })
})
