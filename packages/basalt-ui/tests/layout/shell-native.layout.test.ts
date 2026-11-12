/**
 * `AppShell chrome="native-overlay"` and `CommandPalette` in a real browser, on the v3 fixture
 * (`fixture/v3/scenarios/shell-native.tsx`).
 *
 * - under `native-overlay` the header is 52 tall and the first 80 px of it hold nothing; on the web it
 *   is the 48 token and there is no titlebar strip;
 * - `data-tauri-drag-region` is on `shell-header` alone, buttons never carry it, and the computed
 *   `app-region` is drag on the header and no-drag on every control in it;
 * - `expectShellInvariants` passes its `native` state;
 * - the palette opens on Mod+K inside the viewport at desktop and phone width, with no sideways
 *   overflow, and Escape closes it while the dialog under it stays.
 *
 * v3 only: the 2.x oracle has no `AppShell`.
 */
import { acquireShellTarget } from './shell-target'
import { afterAll, describe, expect, test } from 'bun:test'
import { expectShellInvariants } from '../../src/testing/shell-invariants'
import type { ShellInvariantsPage } from '../../src/testing/shell-invariants'
import { providedSlots } from './fixture/v3/registry'
import type { ShellNativeSpec } from './fixture/v3/scenarios/shell-native'
import { LAYOUT_TARGET, S } from './shell-slots'
import { PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { LayoutPage, Viewport } from './harness'
import { slot } from './harness/slots'

acquireShellTarget()
const ready = await initLayoutSuite()

afterAll(closeLayoutSuite)

const runnable =
  ready &&
  LAYOUT_TARGET === 'v3' &&
  ['shell-header', 'shell-titlebar', 'command-palette'].every((name) => providedSlots().has(name))
const layout = runnable ? describe : describe.skip

const LAPTOP_1024: Viewport = { name: 'laptop 1024', width: 1024, height: 700 }
const LAPTOP_1200: Viewport = { name: 'laptop 1200', width: 1200, height: 800 }
const DESKTOP_1800: Viewport = { name: 'desktop 1800', width: 1800, height: 1200 }

const specOf = (
  shellNative: NonNullable<ShellNativeSpec['shellNative']> = {},
): ShellNativeSpec => ({
  sections: [],
  shellNative,
})

const HEADER = S('shell-header')
const TITLEBAR = S('shell-titlebar')

const open = (spec: ShellNativeSpec, viewport: Viewport): Promise<LayoutPage> =>
  openFixture(spec, viewport, '/', 'reduce', 'fine')

async function dragRegions(p: LayoutPage): Promise<string[]> {
  return p.raw.evaluate(() =>
    [...document.querySelectorAll('[data-tauri-drag-region]')].map(
      (el) => el.getAttribute('data-slot') ?? el.tagName.toLowerCase(),
    ),
  )
}

layout('chrome native-overlay', () => {
  for (const viewport of [LAPTOP_1024, LAPTOP_1200]) {
    test(`the header is 52 and the lead inset is 80 at ${viewport.width}x${viewport.height}`, async () => {
      const p = await open(specOf(), viewport)
      const header = (await p.box('header', HEADER)).box
      const titlebar = (await p.box('titlebar', TITLEBAR)).box
      expect(Math.round(header.height)).toBe(52)
      expect(Math.round(titlebar.width)).toBe(80)
      expect(Math.round(titlebar.left - header.left)).toBe(0)
      const next = await p.raw.evaluate(
        () =>
          document
            .querySelector('[data-slot="shell-titlebar"]')
            ?.nextElementSibling?.getBoundingClientRect().left,
      )
      expect(Math.round(next ?? 0)).toBeGreaterThanOrEqual(80)
      expect(await p.computed(slot('shell'), '--chrome-lead-inset')).toBe('80px')
    })

    test(`the rail still starts under the header at ${viewport.width}`, async () => {
      const p = await open(specOf(), viewport)
      const header = (await p.box('header', HEADER)).box
      const rail = (await p.box('rail', S('shell-rail'))).box
      expect(Math.round(rail.top)).toBe(Math.round(header.bottom))
    })
  }

  test('the drag attribute is on shell-header alone and none on a button', async () => {
    const p = await open(specOf(), LAPTOP_1200)
    expect(await dragRegions(p)).toEqual(['shell-header'])
    expect(await p.raw.getAttribute(HEADER, 'data-tauri-drag-region')).toBe('deep')
    expect(await p.count('button[data-tauri-drag-region]')).toBe(0)
  })

  test('the header drags and every control in it opts out', async () => {
    const p = await open(specOf(), LAPTOP_1200)
    const region = (selector: string): Promise<string> =>
      p.raw.evaluate((sel) => {
        const el = document.querySelector(sel)
        if (el === null) return 'missing'
        const style = getComputedStyle(el)
        return style.getPropertyValue('app-region') || style.getPropertyValue('-webkit-app-region')
      }, selector)
    expect(await region(HEADER)).toBe('drag')
    expect(await region(`${HEADER} button`)).toBe('no-drag')
    expect(await region(`${S('shell-rail-toggle')} button`)).toBe('no-drag')
  })

  test('expectShellInvariants passes the native state, with both rail states', async () => {
    const p = await open(specOf(), LAPTOP_1200)
    await expectShellInvariants(p.raw as ShellInvariantsPage, {
      states: ['expanded', 'collapsed', 'native'],
    })
  })

  test('expectShellInvariants fails native on a web page, naming why', async () => {
    const p = await open(specOf({ chrome: 'web' }), LAPTOP_1200)
    let message = ''
    try {
      await expectShellInvariants(p.raw as ShellInvariantsPage, { states: ['native'] })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain('not under chrome="native-overlay"')
  })

  test('a seeded drag attribute on a button fails the native state', async () => {
    const p = await open(specOf(), LAPTOP_1200)
    await p.raw.evaluate(() =>
      document
        .querySelector('[data-slot="shell-header"] button')
        ?.setAttribute('data-tauri-drag-region', ''),
    )
    let message = ''
    try {
      await expectShellInvariants(p.raw as ShellInvariantsPage, { states: ['native'] })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain('data-tauri-drag-region must be on shell-header alone')
  })
})

layout('chrome web', () => {
  test('is the 48 token with no titlebar strip and no drag region', async () => {
    const p = await open(specOf({ chrome: 'web' }), LAPTOP_1200)
    expect(Math.round((await p.box('header', HEADER)).box.height)).toBe(48)
    expect(await p.count(TITLEBAR)).toBe(0)
    expect(await dragRegions(p)).toEqual([])
  })
})

layout('command palette', () => {
  const PALETTE = slot('command-palette')
  const ITEMS = `${PALETTE} ${slot('autocomplete-item')}`

  for (const viewport of [DESKTOP_1800, PHONE]) {
    test(`opens on Mod+K inside the window at ${viewport.width}x${viewport.height}`, async () => {
      const p = await open(specOf({ chrome: 'web' }), viewport)
      await p.raw.keyboard.press('ControlOrMeta+k')
      await p.waitFor(PALETTE)
      await p.raw.waitForSelector(ITEMS)
      const dialog = (await p.box('dialog', slot('dialog-content'))).box
      expect(dialog.left).toBeGreaterThanOrEqual(0)
      expect(dialog.right).toBeLessThanOrEqual(viewport.width)
      expect(dialog.top).toBeGreaterThanOrEqual(0)
      expect(dialog.bottom).toBeLessThanOrEqual(viewport.height)
      const rows = await p.boxes(ITEMS)
      expect(rows.length).toBeGreaterThan(3)
      for (const row of rows) {
        expect(row.left).toBeGreaterThanOrEqual(dialog.left - 1)
        expect(row.right).toBeLessThanOrEqual(dialog.right + 1)
      }
      const overflow = await p.horizontalOverflow()
      expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.innerWidth)
    })
  }

  test('typing ranks the list and Enter runs the first row', async () => {
    const p = await open(specOf({ chrome: 'web' }), DESKTOP_1800)
    await p.raw.keyboard.press('ControlOrMeta+k')
    await p.raw.waitForSelector(ITEMS)
    await p.raw.keyboard.type('dep')
    await p.raw.waitForFunction(() =>
      document
        .querySelector('[data-slot="autocomplete-item"]')
        ?.textContent?.startsWith('Deploy now'),
    )
    await p.raw.keyboard.press('Enter')
    await p.raw.waitForSelector(PALETTE, { state: 'detached' })
  })

  test('Escape closes the palette and the dialog under it stays', async () => {
    const p = await open(specOf({ chrome: 'web', dialogUnder: true }), DESKTOP_1800)
    await p.raw.waitForSelector('text=Underneath')
    await p.raw.keyboard.press('ControlOrMeta+k')
    await p.raw.waitForSelector(ITEMS)
    await p.raw.keyboard.press('Escape')
    await p.raw.waitForSelector(PALETTE, { state: 'detached' })
    expect(
      await p.raw.evaluate(() =>
        document.querySelector('[data-slot="dialog-content"]')?.textContent?.includes('Underneath'),
      ),
    ).toBe(true)
  })
})
