/**
 * Wave 42: column sizing and state chrome as real geometry (SPEC § 6.6, § 6.12).
 *
 * - At 1440 a 4-column kinded table (entity, no text column) spans its container and its data columns
 *   sit next to each other: the gap between two adjacent values is at most twice the cell inset plus
 *   the widest content, not a quarter of the table.
 * - A paginated table's range label reads the header's size and its pager the cells' size.
 * - Loading hides the count chip and the pager range but keeps the footer's height; the skeleton is
 *   one page of rows.
 * - An active filter pill's border and the pager's current page are ink, not the accent.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const base: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
}

const ROOT = '[data-testid="w42-states"]'
const TABLE = `${ROOT} table`

layout('table sizing and state chrome', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('data columns size to their content; the table still spans its container (1440)', async () => {
    const p = await openFixture({ ...base, w42States: {} }, DESKTOP_1440)
    const geometry = await p.raw.evaluate((selector) => {
      const table = document.querySelector(selector) as HTMLElement
      const heads = [...table.querySelectorAll('thead th')] as HTMLElement[]
      const wrapper = table.parentElement as HTMLElement
      const cells = [...table.querySelectorAll('tbody tr:first-child td')] as HTMLElement[]
      const inset = Number.parseFloat(getComputedStyle(cells[0] as HTMLElement).paddingLeft)
      const widest = Math.max(
        ...heads.slice(1, -1).map((th) => (th.querySelector('*') ?? th).scrollWidth),
        ...cells.slice(1, -1).map((td) => td.scrollWidth),
      )
      return {
        table: table.getBoundingClientRect().width,
        wrapper: wrapper.getBoundingClientRect().width,
        widths: heads.map((th) => th.getBoundingClientRect().width),
        inset,
        widest,
      }
    }, TABLE)
    expect(geometry.table).toBeGreaterThanOrEqual(geometry.wrapper - 1)
    // No text column and figures after the entity (Wave 52): the slack is the trailing spacer's, so the
    // name sits by its next value; every data column is its content plus its insets.
    const spacer = geometry.widths.at(-1) ?? 0
    const [entity = 0, ...figures] = geometry.widths.slice(0, -1)
    expect(spacer).toBeGreaterThan(entity + figures.reduce((sum, width) => sum + width, 0))
    for (const width of figures) {
      expect(width).toBeLessThanOrEqual(geometry.inset * 2 + geometry.widest)
    }
  })

  test("a paginated table reads in few sizes: the range is the header's, the pager the cells' (1440)", async () => {
    const p = await openFixture({ ...base, w42States: {} }, DESKTOP_1440)
    const size = (selector: string) => p.computed(selector, 'font-size')
    const range = await p.raw.evaluate((root) => {
      const el = [...document.querySelectorAll(`${root} p`)].find((node) =>
        (node.textContent ?? '').startsWith('Showing'),
      )
      return getComputedStyle(el as Element).fontSize
    }, ROOT)
    expect(range).toBe(await size(`${TABLE} thead th`))
    expect(await size(`${ROOT} .mantine-Pagination-control`)).toBe(await size(`${TABLE} tbody td`))
  })

  test('loading: no count, no range, the footer keeps its height, one page of skeleton rows', async () => {
    const p = await openFixture({ ...base, w42States: {} }, DESKTOP_1440)
    const loaded = await p.raw.evaluate((root) => {
      const footer = document
        .querySelector(`${root} .mantine-Select-root`)
        ?.closest('.mantine-Group-root')
      return { height: footer?.getBoundingClientRect().height ?? 0 }
    }, ROOT)
    const q = await openFixture({ ...base, w42States: { loading: true } }, DESKTOP_1440)
    const state = await q.raw.evaluate((root) => {
      const host = document.querySelector(root) as HTMLElement
      const range = [...host.querySelectorAll('p')].find((el) =>
        (el.textContent ?? '').startsWith('Showing'),
      )
      const footer = host.querySelector('.mantine-Select-root')?.closest('.mantine-Group-root')
      return {
        rangeVisibility: range === undefined ? 'absent' : getComputedStyle(range).visibility,
        footer: footer?.getBoundingClientRect().height ?? 0,
        skeletonRows: host.querySelectorAll('tbody tr').length,
        text: host.innerText,
      }
    }, ROOT)
    expect(state.rangeVisibility).toBe('hidden')
    expect(state.footer).toBeCloseTo(loaded.height, 0)
    expect(state.skeletonRows).toBe(5)
    expect(state.text).not.toContain('Showing 0')
  })

  for (const viewport of [DESKTOP_1440, PHONE]) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`the active pill and the current page are ink, not the accent (${viewport.name}, ${scheme})`, async () => {
        const p = await openFixture({ ...base, colorScheme: scheme, w42States: {} }, viewport)
        const colors = await p.raw.evaluate((root) => {
          const host = document.querySelector(root) as HTMLElement
          const probe = document.createElement('i')
          host.append(probe)
          const resolve = (value: string): string => {
            probe.style.color = value
            return getComputedStyle(probe).color
          }
          const pill = host.querySelector('[data-active]') as HTMLElement | null
          const page = host.querySelector(
            '.mantine-Pagination-control[data-active]',
          ) as HTMLElement | null
          const out = {
            pillBorder: pill === null ? '' : getComputedStyle(pill).borderTopColor,
            pageBg: page === null ? '' : getComputedStyle(page).backgroundColor,
            accent: resolve('var(--vx-accent)'),
            ink: resolve('var(--vx-ink)'),
            pageText: page === null ? '' : getComputedStyle(page).color,
          }
          probe.remove()
          return out
        }, ROOT)
        expect(colors.pillBorder, 'the active pill exists').not.toBe('')
        expect(colors.pillBorder).not.toBe(colors.accent)
        expect(colors.pageBg, 'the current page exists').not.toBe('')
        expect(colors.pageBg).not.toBe(colors.accent)
        expect(colors.pageText, 'the current page label is ink').toBe(colors.ink)
      })
    }
  }

  test('rows hold one line at 390: every body row is the 40 px row (add-on 7)', async () => {
    const p = await openFixture({ ...base, w42States: {} }, PHONE)
    const heights = await p.raw.evaluate((selector) => {
      return [...document.querySelectorAll(`${selector} tbody tr`)].map(
        (row) => row.getBoundingClientRect().height,
      )
    }, TABLE)
    expect(heights.length).toBeGreaterThan(0)
    for (const height of heights) expect(height).toBeLessThanOrEqual(41)
  })

  test('a row hovers to VX.surface.rowHover (add-on 10)', async () => {
    // The harness page reports `hover: none`, so Mantine's fine-pointer rule never paints; the fill
    // the rule would use is the row's `--tr-hover-bg`, and that must be the row-hover token.
    const p = await openFixture({ ...base, w42States: {} }, DESKTOP_1440)
    const fills = await p.raw.evaluate((selector) => {
      const row = document.querySelector(`${selector} tbody tr`) as HTMLElement
      const probe = document.createElement('i')
      row.append(probe)
      probe.style.color = 'var(--vx-surface-row-hover)'
      const token = getComputedStyle(probe).color
      probe.style.color = 'var(--tr-hover-bg)'
      const hover = getComputedStyle(probe).color
      probe.remove()
      return { token, hover, marked: row.hasAttribute('data-hover') }
    }, TABLE)
    expect(fills.marked).toBe(true)
    expect(fills.hover).toBe(fills.token)
  })

  test("a pinned header cell paints the header's own fill (add-on 12)", async () => {
    for (const scheme of ['light', 'dark'] as const) {
      const p = await openFixture(
        { ...base, colorScheme: scheme, w42States: { pinned: true } },
        DESKTOP_1440,
      )
      const fills = await p.raw.evaluate((selector) => {
        const [first, second] = [...document.querySelectorAll(`${selector} thead th`)]
        return [first, second].map((th) => getComputedStyle(th as Element).backgroundColor)
      }, TABLE)
      expect(fills[0], scheme).toBe(fills[1])
    }
  })

  test("an explicitly pinned header cell of a striped table keeps the header's fill (1440)", async () => {
    for (const scheme of ['light', 'dark'] as const) {
      const p = await openFixture(
        { ...base, colorScheme: scheme, w42States: { pinned: 'striped-page' } },
        DESKTOP_1440,
      )
      const tint = await p.raw.evaluate(
        (selector) =>
          getComputedStyle(
            document.querySelector(`${selector} thead th`) as Element,
          ).getPropertyValue('--pinned-tint'),
        TABLE,
      )
      // The stripe's tint is a body-row state: the header cell layers nothing over its fill.
      expect(tint.trim(), scheme).toBe('transparent')
    }
  })

  test('the footer controls share one height: the page-size Select and the page buttons (1440)', async () => {
    const p = await openFixture({ ...base, w42States: {} }, DESKTOP_1440)
    const heights = await p.raw.evaluate((root) => {
      const h = (selector: string) =>
        (document.querySelector(`${root} ${selector}`) as HTMLElement).getBoundingClientRect()
          .height
      return { select: h('.mantine-Select-input'), pager: h('.mantine-Pagination-control') }
    }, ROOT)
    expect(Math.abs(heights.select - heights.pager)).toBeLessThanOrEqual(1)
  })

  test("an empty table's title is not larger than the table title (1440)", async () => {
    const p = await openFixture({ ...base, w42States: { empty: true } }, DESKTOP_1440)
    const sizes = await p.raw.evaluate((root) => {
      const host = document.querySelector(root) as HTMLElement
      const size = (el: Element | null | undefined) =>
        Number.parseFloat(getComputedStyle(el as Element).fontSize)
      const tableTitle = [...host.querySelectorAll('*')].find(
        (el) => el.children.length === 0 && el.textContent === 'Outages',
      )
      const emptyTitle = [...host.querySelectorAll('tbody span')].find(
        (el) => el.textContent === 'No outages listed',
      )
      return { table: size(tableTitle), empty: size(emptyTitle) }
    }, ROOT)
    expect(sizes.empty).toBeGreaterThan(0)
    expect(sizes.empty).toBeLessThanOrEqual(sizes.table)
  })

  test('skeleton bars take their column shape, not the width of the slack (1440)', async () => {
    const p = await openFixture({ ...base, w42States: { loading: true } }, DESKTOP_1440)
    const widths = await p.raw.evaluate(
      (selector) =>
        [...document.querySelectorAll(`${selector} tbody .mantine-Skeleton-root`)].map(
          (bar) => bar.getBoundingClientRect().width,
        ),
      TABLE,
    )
    expect(widths.length).toBeGreaterThan(0)
    for (const width of widths) expect(width).toBeLessThanOrEqual(160)
  })

  test('a long error string wraps inside the table width at 390', async () => {
    const p = await openFixture({ ...base, w42States: { longError: true } }, PHONE)
    const geometry = await p.raw.evaluate((selector) => {
      const table = document.querySelector(selector) as HTMLElement
      const message = [...table.querySelectorAll('p')].find((el) =>
        el.textContent.includes('upstream'),
      )
      return {
        table: table.getBoundingClientRect().width,
        wrapper: (table.parentElement as HTMLElement).getBoundingClientRect().width,
        lines: message === undefined ? 0 : message.getClientRects().length,
        height: message?.getBoundingClientRect().height ?? 0,
        whiteSpace: message === undefined ? '' : getComputedStyle(message).whiteSpace,
      }
    }, TABLE)
    expect(geometry.table).toBeLessThanOrEqual(geometry.wrapper + 1)
    expect(geometry.whiteSpace).toBe('normal')
    expect(geometry.height, 'the message takes more than one line').toBeGreaterThan(24)
  })
})
