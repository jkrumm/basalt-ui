/**
 * The v3 shell frame in a real browser, on the v3 fixture (`fixture/v3/scenarios/shell-frame.tsx`):
 * `AppShell` under a memory router with a `Page` inside.
 *
 * - the document never scrolls and never overflows sideways at 1440, 1024 and 390;
 * - one header height at every width, the frame's top row beside the brand zone, gutters 8, 12, 16,
 *   rail 240, 64, 0;
 * - the docked aside's header meets the page-bar band's bottom edge, and an unclaimed aside is 0 wide;
 * - axe finds no serious or critical landmark, region or heading-one violation;
 * - the skip link is the first tab stop and moves focus into `Main`;
 * - a table row's `detail` opens in the page's `PageAside` with no host wired, under `detailTitle(row)`;
 * - a 100-row page prints every page, not the 24 rows a clipped scrollport showed.
 *
 * v3 only: the 2.x oracle has no `AppShell`.
 */
import { acquireShellTarget } from './shell-target'
import { afterAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { providedSlots } from './fixture/v3/registry'
import type { ShellFrameSpec } from './fixture/v3/scenarios/shell-frame'
import { LAYOUT_TARGET, PANEL_WIDTH_LOSS, S, SHELL_GEOMETRY } from './shell-slots'
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
  { viewport: DESKTOP_1440, gutter: 16, rail: 240 },
  { viewport: LAPTOP_1024, gutter: 12, rail: 64 },
  { viewport: PHONE, gutter: 8, rail: 0 },
]

/** The work surface as laid out: its outer box, its inner top, its edges and the two planes' colors. */
async function surfaceOf(p: LayoutPage) {
  return p.raw.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-slot="shell-surface"]')
    const root = document.querySelector<HTMLElement>('[data-slot="shell"]')
    const rail = document.querySelector<HTMLElement>('[data-slot="shell-rail"]')
    if (el === null || root === null || rail === null) throw new Error('LAYOUT: no shell surface')
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return {
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      innerTop: r.top + el.clientTop,
      innerLeft: r.left + el.clientLeft,
      innerRight: r.left + el.clientLeft + el.clientWidth,
      radius: parseFloat(s.borderTopLeftRadius),
      edges: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].map(
        (w) => parseFloat(w),
      ),
      ring: s.boxShadow,
      surface: s.backgroundColor,
      frame: getComputedStyle(root).backgroundColor,
      railEdge: parseFloat(getComputedStyle(rail).borderRightWidth) || 0,
    }
  })
}

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
        // The header is the frame's top row, and the work surface starts under it.
        expect(header.box.top).toBe(0)
        expect((await surfaceOf(p)).top).toBe(header.box.bottom)
        if (rail > 0) {
          // The brand zone is the row's other cell: one top, one height, so one line across.
          const brand = (await p.box('brand zone', S('shell-brand-zone'))).box
          expect([brand.top, brand.height, brand.right]).toEqual([0, 48, header.box.left])
        }
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

  test("a table row's detail opens in the page aside under its detailTitle, with no host wired", async () => {
    const wide: Viewport = { name: 'desktop', width: 1800, height: 900 }
    const p = await openFixture(specOf({ detailTable: true, aside: true }), wide)
    // the row's first cell: with no table sheet the filler past the last column is no row cell
    await p.tap('tbody tr:nth-of-type(2) td')
    await p.waitFor('[data-testid="detail-body"]')
    expect(await p.raw.getAttribute(ASIDE, 'data-state')).toBe('docked')
    const aside = await p.raw.evaluate((sel) => {
      const node = document.querySelector(`${sel} [data-slot="page-aside"]`)
      return {
        title: node?.querySelector('h2')?.textContent ?? null,
        body: node?.querySelector('[data-testid="detail-body"]')?.textContent ?? null,
      }
    }, ASIDE)
    expect(aside).toEqual({ title: 'Run 1 details', body: 'Run 1 facts' })
    expect(await p.count('[role="dialog"]')).toBe(0)
  })

  test('an auto aside below the dock room overlays Main and reserves no column', async () => {
    const p = await openFixture(specOf({ aside: true }), LAPTOP_1024)
    expect(await p.raw.getAttribute(ASIDE, 'data-state')).toBe('overlay')
    expect((await p.box('aside', ASIDE)).box.width).toBe(0)
    const main = await p.box('main', MAIN)
    expect(main.box.width).toBe(1024 - 64 - PANEL_WIDTH_LOSS)
    expect(await p.count(`${ASIDE} ${slot('page-aside')}`)).toBe(1)
  })

  test('dock always docks a medium window beside Main', async () => {
    const p = await openFixture(specOf({ aside: { dock: 'always', width: 320 } }), LAPTOP_1024)
    expect(await p.raw.getAttribute(ASIDE, 'data-state')).toBe('docked')
    expect((await p.box('aside', ASIDE)).box.width).toBe(320)
    expect((await p.box('main', MAIN)).box.width).toBe(1024 - 64 - PANEL_WIDTH_LOSS - 320)
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

  test('a bound aside on a phone: state true shows the sheet, Escape writes false, the header button opens it again', async () => {
    const SHEET = '[data-slot="sheet-content"]'
    const stateOf = (p: LayoutPage): Promise<string | undefined> =>
      p.raw.evaluate(() => document.documentElement.dataset['asideState'])
    const p = await openFixture(specOf({ aside: { state: true } }), PHONE)
    await p.waitFor(SHEET)
    expect(await p.count(SHEET), 'a deep link with the state set opens the sheet on load').toBe(1)
    await p.raw.keyboard.press('Escape')
    await p.quiesce()
    expect(await stateOf(p), 'closing the sheet writes false').toBe('false')
    expect(await p.count(SHEET)).toBe(0)
    await p.raw.locator(`${HEADER} button:has-text("Run details")`).click()
    await p.waitFor(SHEET)
    expect(await stateOf(p), 'the header button writes true').toBe('true')
  })

  test('a record aside on a phone has no header button while no record is open, and the sheet while one is', async () => {
    const SHEET = '[data-slot="sheet-content"]'
    const buttons = (p: LayoutPage): Promise<number> =>
      p.raw.evaluate(
        (sel) =>
          [...document.querySelectorAll(`${sel} button`)].filter(
            (b) => b.textContent === 'Run details',
          ).length,
        HEADER,
      )
    const none = await openFixture(specOf({ aside: { record: '' } }), PHONE)
    expect(await buttons(none), 'no record, no header button').toBe(0)
    expect(await none.count(SHEET)).toBe(0)
    const open = await openFixture(specOf({ aside: { record: 'login-crash' } }), PHONE)
    await open.waitFor(SHEET)
    expect(await buttons(open), 'an open record keeps its header button').toBe(1)
    await open.raw.keyboard.press('Escape')
    await open.quiesce()
    expect(
      await open.raw.evaluate(() => document.documentElement.dataset['asideRecord']),
      'closing the sheet clears the record',
    ).toBe('')
    expect(await buttons(open), 'the cleared record drops the button').toBe(0)
    // A boolean-bound aside keeps its button while closed.
    const flag = await openFixture(specOf({ aside: { state: false } }), PHONE)
    expect(await buttons(flag)).toBe(1)
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

layout('the two planes: the rail on the frame, one work surface for the page', () => {
  const INSET = SHELL_GEOMETRY.panelInset
  const CARD_RADIUS = 14

  for (const scheme of ['light', 'dark'] as const) {
    for (const { viewport, rail } of VIEWPORTS) {
      test(`${scheme} ${viewport.name}: ${rail === 0 ? 'flush' : 'a panel'} on a frame of another color, no hairline on the rail`, async () => {
        const p = await openFixture(specOf(), viewport)
        await p.raw.evaluate((s) => document.documentElement.setAttribute('data-theme', s), scheme)
        const g = await surfaceOf(p)
        expect(g.surface, 'the surface and the frame are two colors').not.toBe(g.frame)
        expect(g.railEdge, 'the rail draws no hairline: the planes divide it').toBe(0)
        const header = (await p.box('header', HEADER)).box
        expect(header.left, 'the strip starts past the rail, over the surface').toBe(g.left)
        expect(g.top, 'the surface starts under the strip').toBe(header.bottom)
        if (rail === 0) {
          expect([g.left, g.radius]).toEqual([0, 0])
          expect(g.right).toBe(viewport.width)
          expect(g.edges).toEqual([0, 0, 0, 0])
          expect(g.ring).toBe('none')
          return
        }
        expect(g.left, 'no inset on the rail side').toBe(rail)
        expect(viewport.width - g.right).toBe(INSET)
        expect(viewport.height - g.bottom).toBe(INSET)
        expect(g.radius).toBe(CARD_RADIUS)
        expect(g.edges, 'the edge is a ring, not a border').toEqual([0, 0, 0, 0])
        expect(g.ring).toMatch(/0px 0px 0px 1px/)
      })
    }
  }

  test('flush meets the window on every free side, with one hairline toward the rail and the strip', async () => {
    const p = await openFixture(specOf({ frame: 'flush' }), DESKTOP_1440)
    const g = await surfaceOf(p)
    expect([g.top, g.left, g.right, g.bottom, g.radius]).toEqual([
      48,
      240,
      1440,
      DESKTOP_1440.height,
      0,
    ])
    expect(g.edges).toEqual([1, 0, 0, 1])
    expect((await p.box('header', HEADER)).box.top).toBe(0)
  })

  test('data-frame on <html> wins over the prop both ways, and a phone stays flush', async () => {
    const setFrame = (p: LayoutPage, frame: string | null) =>
      p.raw.evaluate((f) => {
        if (f === null) document.documentElement.removeAttribute('data-frame')
        else document.documentElement.setAttribute('data-frame', f)
      }, frame)
    const panelProp = await openFixture(specOf(), DESKTOP_1440)
    await setFrame(panelProp, 'flush')
    const flush = await surfaceOf(panelProp)
    expect([flush.top, flush.left, flush.right, flush.radius]).toEqual([48, 240, 1440, 0])
    expect(flush.edges).toEqual([1, 0, 0, 1])
    await setFrame(panelProp, null)

    const flushProp = await openFixture(specOf({ frame: 'flush' }), DESKTOP_1440)
    await setFrame(flushProp, 'panel')
    const panel = await surfaceOf(flushProp)
    expect([panel.top, panel.left, panel.radius]).toEqual([48, 240, CARD_RADIUS])
    expect(1440 - panel.right).toBe(INSET)
    expect(panel.edges).toEqual([0, 0, 0, 0])
    expect(panel.ring).toMatch(/0px 0px 0px 1px/)
    await setFrame(flushProp, null)

    const phone = await openFixture(specOf(), PHONE)
    await setFrame(phone, 'panel')
    const compact = await surfaceOf(phone)
    expect([compact.top, compact.left, compact.radius]).toEqual([48, 0, 0])
    expect(compact.ring).toBe('none')
    await setFrame(phone, null)
  })

  test('a fill page runs its table to the surface edges with no card and no gutter', async () => {
    for (const viewport of [DESKTOP_1440, PHONE]) {
      const p = await openFixture(specOf({ fill: true }), viewport)
      const g = await surfaceOf(p)
      const table = (await p.box('table', slot('table-root'))).box
      expect(Math.abs(table.left - g.innerLeft)).toBeLessThanOrEqual(SEAM_TOLERANCE)
      expect(Math.abs(table.right - g.innerRight)).toBeLessThanOrEqual(SEAM_TOLERANCE)
      expect(await p.count(`${slot('card')} ${slot('table-root')}`)).toBe(0)
      expect(parseFloat(await p.computed(PAGE_MAIN, 'padding-left'))).toBe(0)
      const band = (await p.box('band', BAND)).box
      expect(Math.abs(table.top - band.bottom)).toBeLessThanOrEqual(SEAM_TOLERANCE)
    }
  })

  test('a padded page keeps the gutter and its card reads by a hairline ring on the surface color', async () => {
    const p = await openFixture(specOf({ card: true }), DESKTOP_1440)
    const card = await p.raw.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-slot="card"]')
      const surface = document.querySelector<HTMLElement>('[data-slot="shell-surface"]')
      if (el === null || surface === null) throw new Error('LAYOUT: no card')
      const s = getComputedStyle(el)
      return {
        bg: s.backgroundColor,
        surface: getComputedStyle(surface).backgroundColor,
        shadow: s.boxShadow,
        border: parseFloat(s.borderTopWidth) || 0,
      }
    })
    expect(card.bg, 'no ground contrast: the card is the surface color').toBe(card.surface)
    expect(card.shadow, 'the ring is the card shadow').toMatch(/0px 0px 0px 1px/)
    expect(card.border, 'one edge: no border beside the ring').toBe(0)
    expect(parseFloat(await p.computed(PAGE_MAIN, 'padding-left'))).toBe(16)
  })
})
