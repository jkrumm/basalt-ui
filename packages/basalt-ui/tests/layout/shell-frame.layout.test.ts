/**
 * The v3 shell frame in a real browser, on the v3 fixture (`fixture/v3/scenarios/shell-frame.tsx`):
 * `AppShell` under a memory router with a `Page` inside.
 *
 * - the document never scrolls and never overflows sideways at 1440, 1024 and 390;
 * - one header height at every width, gutters 8, 16, 24, rail 240, 64, 0;
 * - the docked aside's header meets the page-bar band's bottom edge, and an unclaimed aside is 0 wide;
 * - axe finds no serious or critical landmark, region or heading-one violation;
 * - the skip link is the first tab stop and moves focus into `Main`;
 * - a 100-row page prints every page, not the 24 rows a clipped scrollport showed.
 *
 * v3 only: the 2.x oracle has no `AppShell`.
 */
import { acquireShellTarget } from './shell-target'
import { afterAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { providedSlots } from './fixture/v3/registry'
import type { ShellFrameSpec } from './fixture/v3/scenarios/shell-frame'
import { LAYOUT_TARGET, S } from './shell-slots'
import {
  DESKTOP_1440,
  LAPTOP_1024,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'
import type { LayoutPage, Viewport } from './harness'
import { slot } from './harness/slots'

acquireShellTarget()
const ready = await initLayoutSuite()

afterAll(closeLayoutSuite)

const runnable =
  ready &&
  LAYOUT_TARGET === 'v3' &&
  ['shell-header', 'shell-main', 'shell-aside', 'shell-rail', 'shell-tab-bar'].every((name) =>
    providedSlots().has(name),
  )
const layout = runnable ? describe : describe.skip

const specOf = (shellFrame: NonNullable<ShellFrameSpec['shellFrame']> = {}): ShellFrameSpec => ({
  sections: [],
  shellFrame,
})

const ROOT = slot('shell')
const HEADER = S('shell-header')
const MAIN = S('shell-main')
const ASIDE = S('shell-aside')
const RAIL = S('shell-rail')
const BAND = S('page-bar')
const PAGE_MAIN = slot('page-main')

const REPO_ROOT = new URL('../../../../', import.meta.url).pathname
const axeSource = readFileSync(`${REPO_ROOT}node_modules/axe-core/axe.min.js`, 'utf8')

const VIEWPORTS: readonly { viewport: Viewport; gutter: number; rail: number }[] = [
  { viewport: DESKTOP_1440, gutter: 24, rail: 240 },
  { viewport: LAPTOP_1024, gutter: 16, rail: 64 },
  { viewport: PHONE, gutter: 8, rail: 0 },
]

/** The one pixel the band and the header each draw their seam on, plus sub-pixel layout. */
const SEAM_TOLERANCE = 1

async function overflowOf(p: LayoutPage) {
  return p.raw.evaluate(() => {
    const main = document.querySelector('[data-slot="shell-main"]')
    return {
      docX: document.documentElement.scrollWidth - window.innerWidth,
      docY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      mainX: main === null ? 0 : main.scrollWidth - main.clientWidth,
    }
  })
}

layout('AppShell frame — real layout', () => {
  for (const { viewport, gutter, rail } of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('the document never scrolls and nothing overflows sideways', async () => {
        for (const rows of [12, 100]) {
          const p = await openFixture(specOf({ rows }), viewport)
          const o = await overflowOf(p)
          expect({ rows, ...o }).toEqual({ rows, docX: 0, docY: 0, mainX: 0 })
          const info = await p.scroll('page')
          expect(info.scrollHeight).toBe(info.clientHeight)
        }
      })

      test('Main is the scrollport and a long page scrolls inside it', async () => {
        const p = await openFixture(specOf({ rows: 100 }), viewport)
        const main = await p.scroll(MAIN)
        expect(main.scrollHeight).toBeGreaterThan(main.clientHeight)
        expect(await p.computed(MAIN, 'overflow-y')).toBe('auto')
        expect(await p.count('main')).toBe(1)
        expect(await p.raw.getAttribute(MAIN, 'data-scroll-restoration-id')).toBe('shell-main')
      })

      test('Main is a tab stop only while it scrolls, and always focusable by the skip link', async () => {
        const tabIndexOf = (p: LayoutPage) =>
          p.raw.evaluate(
            () => document.querySelector<HTMLElement>('[data-slot="shell-main"]')?.tabIndex,
          )
        const short = await openFixture(specOf({ rows: 1 }), viewport)
        const fits = await short.scroll(MAIN)
        expect(fits.scrollHeight).toBeLessThanOrEqual(fits.clientHeight)
        expect(await tabIndexOf(short)).toBe(-1)
        const long = await openFixture(specOf({ rows: 100 }), viewport)
        await long.raw.waitForFunction(
          () => document.querySelector<HTMLElement>('[data-slot="shell-main"]')?.tabIndex === 0,
        )
        expect(await tabIndexOf(long)).toBe(0)
      })

      test('one header token height, the gutter and the rail follow the size class', async () => {
        const p = await openFixture(specOf(), viewport)
        const header = await p.box('header', HEADER)
        expect(header.box.height).toBe(48)
        expect(header.box.top).toBe(0)
        const root = await p.box('root', ROOT)
        expect(root.box.height).toBe(viewport.height)
        expect(parseFloat(await p.computed(PAGE_MAIN, 'padding-left'))).toBe(gutter)
        const railBox = await p.box('rail', RAIL)
        expect(railBox.box.width).toBe(rail)
      })

      test('an unclaimed aside is 0 wide and draws nothing', async () => {
        const p = await openFixture(specOf(), viewport)
        const aside = await p.box('aside', ASIDE)
        expect(aside.box.width).toBe(0)
        expect(await p.count(slot('page-aside'))).toBe(0)
      })

      test('axe finds no serious or critical landmark, region or heading violation', async () => {
        const p = await openFixture(specOf({ rows: 30 }), viewport)
        await p.raw.addScriptTag({ content: axeSource })
        const violations = await p.raw.evaluate(async () => {
          const axe = (
            window as unknown as {
              axe: {
                run: (
                  context: Document,
                  options: { rules: Record<string, { enabled: boolean }> },
                ) => Promise<{
                  violations: { id: string; impact: string; nodes: { html: string }[] }[]
                }>
              }
            }
          ).axe
          const result = await axe.run(document, {
            rules: { 'color-contrast': { enabled: false } },
          })
          return result.violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html).join(' | ')}`)
        })
        expect(violations).toEqual([])
      })
    })
  }

  test('the rail state overrides the size class once the user chose it', async () => {
    const collapsed = await openFixture(specOf({ rail: 'collapsed' }), DESKTOP_1440)
    expect((await collapsed.box('rail', RAIL)).box.width).toBe(64)
    const expanded = await openFixture(specOf({ rail: 'expanded' }), LAPTOP_1024)
    expect((await expanded.box('rail', RAIL)).box.width).toBe(240)
  })

  test('compactHeader hidden removes the header row on a phone only', async () => {
    const phone = await openFixture(specOf({ compactHeader: 'hidden' }), PHONE)
    expect((await phone.box('header', HEADER)).box.height).toBe(0)
    const desktop = await openFixture(specOf({ compactHeader: 'hidden' }), DESKTOP_1440)
    expect((await desktop.box('header', HEADER)).box.height).toBe(48)
  })

  test('a docked aside header meets the page-bar band seam, in the same frame', async () => {
    const p = await openFixture(specOf({ aside: true }), DESKTOP_1440)
    expect(await p.raw.getAttribute(ASIDE, 'data-state')).toBe('docked')
    const aside = await p.box('aside', ASIDE)
    expect(aside.box.width).toBe(360)
    const band = await p.box('band', BAND)
    const header = await p.box('aside header', `${slot('page-aside')} > header`)
    expect(Math.abs(header.box.bottom - band.box.bottom)).toBeLessThanOrEqual(SEAM_TOLERANCE)
    expect(Math.abs(header.box.top - band.box.top)).toBeLessThanOrEqual(SEAM_TOLERANCE)
    const o = await overflowOf(p)
    expect(o).toEqual({ docX: 0, docY: 0, mainX: 0 })
  })

  test('the aside seam holds at paint time when the band changes height', async () => {
    const p = await openFixture(specOf({ aside: true }), DESKTOP_1440)
    const seam = await p.raw.evaluate(async () => {
      const bar = document.querySelector<HTMLElement>('[data-slot="page-bar"]')
      const head = document.querySelector<HTMLElement>('[data-slot="page-aside"] > header')
      if (bar === null || head === null) return null
      let worst = 0
      const observer = new ResizeObserver(() => {
        worst = Math.max(
          worst,
          Math.abs(head.getBoundingClientRect().bottom - bar.getBoundingClientRect().bottom),
        )
      })
      observer.observe(bar)
      bar.style.minHeight = '80px'
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      observer.disconnect()
      return {
        worst,
        settled: Math.abs(head.getBoundingClientRect().bottom - bar.getBoundingClientRect().bottom),
      }
    })
    expect(seam).not.toBeNull()
    expect(seam!.worst).toBeLessThanOrEqual(SEAM_TOLERANCE)
    expect(seam!.settled).toBeLessThanOrEqual(SEAM_TOLERANCE)
  })

  test('an auto aside below the dock room overlays Main and reserves no column', async () => {
    const p = await openFixture(specOf({ aside: true }), LAPTOP_1024)
    expect(await p.raw.getAttribute(ASIDE, 'data-state')).toBe('overlay')
    expect((await p.box('aside', ASIDE)).box.width).toBe(0)
    const main = await p.box('main', MAIN)
    expect(main.box.width).toBe(1024 - 64)
    expect(await p.count(`${ASIDE} ${slot('page-aside')}`)).toBe(1)
  })

  test('dock always docks a medium window beside Main', async () => {
    const p = await openFixture(specOf({ aside: { dock: 'always', width: 320 } }), LAPTOP_1024)
    expect(await p.raw.getAttribute(ASIDE, 'data-state')).toBe('docked')
    expect((await p.box('aside', ASIDE)).box.width).toBe(320)
    expect((await p.box('main', MAIN)).box.width).toBe(1024 - 64 - 320)
  })

  test('a phone gets the aside as a sheet behind a header trigger, not a column', async () => {
    const p = await openFixture(specOf({ aside: true }), PHONE)
    expect((await p.box('aside', ASIDE)).box.width).toBe(0)
    expect(await p.count(slot('page-aside'))).toBe(0)
    const triggers = await p.raw.evaluate(
      (sel) =>
        [...document.querySelectorAll(`${sel} button`)].filter(
          (b) => b.textContent === 'Run details',
        ).length,
      HEADER,
    )
    expect(triggers).toBe(1)
  })

  test('the skip link is the first tab stop and moves focus into Main', async () => {
    const p = await openFixture(specOf(), DESKTOP_1440)
    await p.raw.keyboard.press('Tab')
    expect(await p.raw.evaluate(() => document.activeElement?.getAttribute('data-slot'))).toBe(
      'shell-skip',
    )
    await p.raw.keyboard.press('Enter')
    expect(await p.raw.evaluate(() => document.activeElement?.getAttribute('data-slot'))).toBe(
      'shell-main',
    )
  })

  test('document.title is page · brand', async () => {
    const p = await openFixture(specOf(), DESKTOP_1440)
    expect(await p.raw.title()).toBe('Runs · Basalt')
  })

  test('a 100-row page prints every page, with the frame off', async () => {
    const p = await openFixture(specOf({ rows: 100 }), DESKTOP_1440)
    await p.raw.emulateMedia({ media: 'print' })
    const printed = await p.raw.evaluate(() => {
      const main = document.querySelector<HTMLElement>('[data-slot="shell-main"]')
      const visible = (selector: string): boolean => {
        const el = document.querySelector<HTMLElement>(selector)
        return el !== null && el.getBoundingClientRect().width > 0
      }
      return {
        mainHeight: main?.getBoundingClientRect().height ?? 0,
        overflow: main === null ? '' : getComputedStyle(main).overflowY,
        header: visible('[data-slot="shell-header"]'),
        rail: visible('[data-slot="shell-rail"]'),
        docHeight: document.documentElement.scrollHeight,
      }
    })
    // 100 rows of 32 px: every one in Main's box, none behind a scrollport.
    expect(printed.overflow).toBe('visible')
    expect(printed.mainHeight).toBeGreaterThanOrEqual(3200)
    expect(printed.docHeight).toBeGreaterThanOrEqual(3200)
    expect(printed.header).toBe(false)
    expect(printed.rail).toBe(false)
    const pdf = await p.raw.pdf({ format: 'A4' })
    const pages = (
      Buffer.from(pdf)
        .toString('latin1')
        .match(/\/Type\s*\/Page[^s]/g) ?? []
    ).length
    // 3200 px of rows cannot fit fewer than three A4 pages.
    expect(pages).toBeGreaterThanOrEqual(3)
  })
})
