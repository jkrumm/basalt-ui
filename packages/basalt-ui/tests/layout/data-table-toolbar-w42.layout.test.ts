/**
 * Wave 42 (SPEC § 6.6): the table toolbar is ONE row of equal-height controls from the `compact`
 * container class up — title, search, facet chips and an `actions` button — and the table reads its
 * own container, never the viewport. The viewport stays 1440 (or a 390 phone) while only the
 * container moves.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage, Viewport } from './harness'
import {
  CLOSE_BUDGET_MS,
  PHONE,
  closeLayoutSuite,
  expectNoHorizontalOverflow,
  initLayoutSuite,
  openFixture,
} from './harness'
import { CONTAINER_CLASSES } from '../../src/tokens/size-classes'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const DESKTOP: Viewport = { name: 'desktop', width: 1440, height: 900 }
const TOOLBAR = '[data-basalt-tier="ctl"] > .mantine-Group-root'
const CONTROLS =
  '.mantine-TextInput-input, [data-filter-slot]:not([data-folded]) > button, [data-filter-row] > button, .mantine-Button-root:not([data-filter-row] *)'

const specAt = (containerWidth: number | undefined, extra: Partial<FixtureSpec['table']> = {}) =>
  ({
    sections: [
      { label: 'Main', items: [{ key: 'home', label: 'Home', mobile: 'tab', active: true }] },
    ],
    table: {
      rows: 8,
      columns: 6,
      stickyHeader: false,
      search: true,
      facets: 2,
      actions: true,
      ...(containerWidth !== undefined && { containerWidth }),
      ...extra,
    },
  }) satisfies FixtureSpec

type Rect = { top: number; height: number; right: number; text: string }

/** Every rendered toolbar control's box. */
function controlRects(p: LayoutPage): Promise<Rect[]> {
  return p.raw.evaluate(
    ([toolbar, controls]) => {
      const group = document.querySelector(toolbar as string)
      if (!group) throw new Error(`no toolbar under ${String(toolbar)}`)
      return [...group.querySelectorAll<HTMLElement>(controls as string)]
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.height > 0)
        .map(({ el, rect }) => ({
          top: Math.round(rect.top),
          height: Math.round(rect.height),
          right: rect.right,
          text: el.textContent ?? '',
        }))
    },
    [TOOLBAR, CONTROLS],
  )
}

const rowSpread = (rects: Rect[]): number =>
  Math.max(...rects.map((r) => r.top)) - Math.min(...rects.map((r) => r.top))

layout('BasaltDataTable toolbar — one row of equal-height controls', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const width of [CONTAINER_CLASSES.regular, CONTAINER_CLASSES.wide]) {
    test(`a ${width}px container keeps ONE toolbar row of 28px controls`, async () => {
      const p = await openFixture(specAt(width), DESKTOP, '/', 'reduce', 'fine')
      const rects = await controlRects(p)
      // search + at least one facet pill + the action
      expect(rects.length).toBeGreaterThanOrEqual(3)
      expect(rowSpread(rects)).toBeLessThanOrEqual(1)
      for (const rect of rects) expect(rect.height).toBe(28)
      const edges = await p.raw.evaluate((sel) => {
        const group = document.querySelector(sel)
        const action = [...(group?.querySelectorAll('button') ?? [])].find((b) =>
          b.textContent?.includes('Export CSV'),
        )
        return {
          group: group?.getBoundingClientRect().right ?? 0,
          action: action?.getBoundingClientRect().right ?? 0,
        }
      }, TOOLBAR)
      expect(Math.abs(edges.group - edges.action)).toBeLessThanOrEqual(1)
    })
  }

  // The compact class opens AT 240: one px under it the row may wrap, at it the row must not.
  test('the row wraps only below the compact container class', async () => {
    const compact = CONTAINER_CLASSES.compact
    const at = await openFixture(specAt(compact), DESKTOP, '/', 'reduce', 'fine')
    expect(rowSpread(await controlRects(at))).toBeLessThanOrEqual(1)
    const wrapsAt = (p: LayoutPage): Promise<string> => p.computed(TOOLBAR, 'flex-wrap')
    expect(await wrapsAt(at)).toBe('nowrap')
    const under = await openFixture(specAt(compact - 1), DESKTOP, '/', 'reduce', 'fine')
    expect(await wrapsAt(under)).toBe('wrap')
  })

  test('a phone: every toolbar control shares ONE height, nothing is clipped, facets live in one place', async () => {
    const p = await openFixture(specAt(undefined), PHONE)
    await p.settle()
    const rects = await controlRects(p)
    expect(rects.length).toBeGreaterThanOrEqual(2)
    expect(new Set(rects.map((r) => r.height)).size).toBe(1)
    // iOS zooms a focused input under 16px — the shared height must not have shrunk the type.
    const fontSize = await p.computed('.mantine-TextInput-input', 'font-size')
    expect(Number.parseFloat(fontSize)).toBeGreaterThanOrEqual(16)
    expectNoHorizontalOverflow(
      await p.horizontalOverflow(),
      'the phone toolbar fits its column',
      PHONE,
    )
    // The facets' ONE home at the phone tier is `Filters`; no facet pill is also rendered inline.
    const texts = rects.map((r) => r.text)
    expect(texts.some((t) => t.includes('Filters'))).toBe(true)
    expect(texts.some((t) => /Department|Role|Any /.test(t))).toBe(false)
  })

  test('a regular-class container on a phone viewport keeps its facets inline, not only in Filters', async () => {
    const p = await openFixture(specAt(CONTAINER_CLASSES.regular), PHONE)
    await p.settle()
    const texts = (await controlRects(p)).map((r) => r.text)
    expect(texts.some((t) => /Department|Any /.test(t))).toBe(true)
  })

  test('a preset facet reads its name muted and its value bright (computed colours)', async () => {
    const p = await openFixture(specAt(800, { preset: true }), DESKTOP, '/', 'reduce', 'fine')
    const colours = await p.raw.evaluate(() => {
      const resolve = (token: string): string => {
        const probe = document.createElement('span')
        probe.style.color = `var(${token})`
        document.body.appendChild(probe)
        const colour = getComputedStyle(probe).color
        probe.remove()
        return colour
      }
      const name = document.querySelector('[data-pill-part="name"]')
      const value = document.querySelector('[data-pill-part="value"]')
      if (!name || !value) throw new Error('no preset pill rendered')
      return {
        name: getComputedStyle(name).color,
        value: getComputedStyle(value).color,
        muted: resolve('--vx-muted'),
        ink: resolve('--vx-ink'),
      }
    })
    expect(colours.name).toBe(colours.muted)
    expect(colours.value).toBe(colours.ink)
    expect(colours.name).not.toBe(colours.value)
  })

  test('the pill’s name and value are visibly separated', async () => {
    const p = await openFixture(specAt(800, { preset: true }), DESKTOP, '/', 'reduce', 'fine')
    const name = await p.box('name', '[data-pill-part="name"]')
    const value = await p.box('value', '[data-pill-part="value"]')
    expect(value.box.left - name.box.right).toBeGreaterThanOrEqual(4)
  })

  for (const pointer of ['fine', 'coarse'] as const) {
    test(`the footer's rows-per-page Select and pager share one height (${pointer} pointer)`, async () => {
      const p = await openFixture(specAt(800, { paginate: true }), DESKTOP, '/', 'reduce', pointer)
      const heights = await p.raw.evaluate(() => {
        const h = (sel: string): number[] =>
          [...document.querySelectorAll(sel)].map((el) =>
            Math.round(el.getBoundingClientRect().height),
          )
        return {
          select: h('.mantine-Select-input'),
          pager: h('.mantine-Pagination-control'),
        }
      })
      const all = [...heights.select, ...heights.pager]
      expect(heights.pager.length).toBeGreaterThan(0)
      expect(new Set(all).size).toBe(1)
      if (pointer === 'fine') expect(all[0]).toBe(28)
    })
  }
})
