/**
 * Wave 42: the compact table, measured as real geometry in headless Chrome (SPEC § 6.6 / § 9.1).
 *
 * argo's workouts shape (six columns, no `meta.priority`) and S2's sessions shape, each in a 390 and
 * a 360 px container. The fold takes the table to its two-column floor; what still overflows pins the
 * first column and scrolls the rest INSIDE the table's own box:
 * - the page never scrolls sideways;
 * - the first column is `position: sticky`, stays at the scroller's start edge (beside the fold
 *   toggle, which leads it) after `scrollLeft = max`, is opaque in rest and hover, one line tall;
 * - the scroller takes focus and ArrowRight moves `scrollLeft`;
 * - Tab reaches the fold toggle, Enter expands it, the folded value is visible.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const WIDE: Viewport = { name: 'w42 800', width: 800, height: 900 }
const TOGGLE_WIDTH = 44

const base: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
}

const ROOT = '[data-testid="w42-responsive"]'
const SCROLLER = `${ROOT} .mantine-TableScrollContainer-scrollContainer`
const TABLE = `${ROOT} table`
const FIRST_TH = `${TABLE} thead th[data-basalt-fold-id]`
const FIRST_TD = `${TABLE} tbody tr:first-child td[data-kind]`

type Shape = 'workouts' | 'sessions'
/**
 * `scrolls`: whether the floor-folded table is still wider than its container. argo's workouts keep
 * a date and a long exercise name, which cannot fit; S2's sessions pin the exercise itself, and the
 * 45% cap ellipsizes it until the pair fits — pinned, but with nothing left to scroll, so no tab
 * stop. The 260 px sessions case leaves no such room.
 */
const CASES: { shape: Shape; width: number; scrolls: boolean }[] = [
  { shape: 'workouts', width: 390, scrolls: true },
  { shape: 'workouts', width: 360, scrolls: true },
  { shape: 'sessions', width: 390, scrolls: false },
  { shape: 'sessions', width: 360, scrolls: false },
  { shape: 'sessions', width: 260, scrolls: true },
]

layout('compact tables pin the first column and scroll', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const { shape, width, scrolls } of CASES) {
    const name = `${shape} @${width}`
    const spec = (scheme: 'light' | 'dark' = 'light'): FixtureSpec => ({
      ...base,
      colorScheme: scheme,
      w42Responsive: { shape, width },
    })

    test(`${name}: the scroller contains the table and the page stays put`, async () => {
      const p = await openFixture(spec(), WIDE)
      const scroller = await p.box('scroller', SCROLLER)
      expect(scroller.box.width).toBeLessThanOrEqual(width + 0.5)
      const info = await p.raw.evaluate((s) => {
        const el = document.querySelector(s) as HTMLElement
        return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
      }, SCROLLER)
      if (scrolls) expect(info.scrollWidth).toBeGreaterThan(info.clientWidth)
      else expect(info.scrollWidth).toBeLessThanOrEqual(info.clientWidth)
      expect(
        await p.raw.getAttribute(SCROLLER, 'tabindex'),
        'a tab stop only while it scrolls',
      ).toBe(scrolls ? '0' : null)
      const overflow = await p.horizontalOverflow()
      expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.innerWidth)
    })

    test(`${name}: the first column is sticky, opaque, and one line`, async () => {
      const p = await openFixture(spec(), WIDE)
      expect(await p.computed(FIRST_TD, 'position')).toBe('sticky')
      expect(await p.computed(FIRST_TH, 'position')).toBe('sticky')
      expect(await p.computed(FIRST_TD, 'white-space')).toBe('nowrap')
      const td = await p.box('first cell', FIRST_TD)
      const row = await p.box('row', `${TABLE} tbody tr:first-child`)
      expect(td.box.height).toBeLessThanOrEqual(row.box.height + 0.5)
      // A wrapped cell is 59 tall; one line is the 40px row plus its rule.
      expect(td.box.height).toBeLessThanOrEqual(44)
      const bg = await p.computed(FIRST_TD, 'background-color')
      expect(bg).not.toBe('rgba(0, 0, 0, 0)')
      expect(bg).toMatch(/^rgb\(/)
    })

    test.if(shape === 'sessions')(
      `${name}: a long identifier ellipsizes, full text in title`,
      async () => {
        const p = await openFixture(spec(), WIDE)
        const scroller = await p.box('scroller', SCROLLER)
        const td = await p.box('first cell', FIRST_TD)
        // Truncated: the cell's content is wider than the cell.
        const clipped = await p.raw.evaluate((s) => {
          const el = document.querySelector(s) as HTMLElement
          return el.scrollWidth > el.clientWidth
        }, FIRST_TD)
        expect(clipped).toBe(true)
        expect(await p.computed(FIRST_TD, 'text-overflow')).toBe('ellipsis')
        expect(await p.raw.getAttribute(FIRST_TD, 'title')).toContain('Overhead press (strict')
        // Where the table overflows the cap binds (45% of the container, floored at the 120px minimum).
        if (scrolls)
          expect(td.box.width).toBeLessThanOrEqual(Math.max(scroller.box.width * 0.45, 120) + 1)
      },
    )

    test.if(scrolls)(`${name}: it holds the start edge after scrolling to the end`, async () => {
      const p = await openFixture(spec(), WIDE)
      await p.raw.evaluate((s) => {
        const el = document.querySelector(s) as HTMLElement
        el.scrollLeft = el.scrollWidth
      }, SCROLLER)
      await p.settle()
      const scrolled = await p.raw.evaluate(
        (s) => (document.querySelector(s) as HTMLElement).scrollLeft,
        SCROLLER,
      )
      expect(scrolled).toBeGreaterThan(0)
      const scroller = await p.box('scroller', SCROLLER)
      const td = await p.box('first cell', FIRST_TD)
      // The fold toggle leads the row, sticky at the edge; the pinned column rides right beside it.
      expect(Math.abs(td.box.x - (scroller.box.x + TOGGLE_WIDTH))).toBeLessThanOrEqual(1)
      const toggleCell = await p.box('toggle cell', `${TABLE} tbody tr:first-child td:first-child`)
      expect(Math.abs(toggleCell.box.x - scroller.box.x)).toBeLessThanOrEqual(1)
    })

    for (const scheme of ['light', 'dark'] as const) {
      for (const onPage of [false, true]) {
        test(`${name}, ${scheme}, ${onPage ? 'on the page' : 'in a card'}: the pinned cell takes the row's own background in every state`, async () => {
          // A fine pointer: the touch emulation matches `(hover: none)`, where Mantine tints on :active.
          const p = await openFixture(
            {
              ...spec(scheme),
              w42Responsive: { shape, width, ...(onPage && { onPage: true as const }) },
            },
            WIDE,
            '/',
            'reduce',
            'fine',
          )
          const surface = await p.raw.evaluate((s) => {
            let el: Element | null = document.querySelector(s)
            while (el !== null) {
              const bgc = getComputedStyle(el).backgroundColor
              if (bgc !== 'rgba(0, 0, 0, 0)') return bgc
              el = el.parentElement
            }
            return 'none'
          }, TABLE)
          const read = (row: number) =>
            p.raw.evaluate(
              ([tr, td]) => {
                const rowEl = document.querySelector(tr as string) as HTMLElement
                const cell = document.querySelector(td as string) as HTMLElement
                return {
                  rowBg: getComputedStyle(rowEl).backgroundColor,
                  cellBg: getComputedStyle(cell).backgroundColor,
                  cellImage: getComputedStyle(cell).backgroundImage,
                }
              },
              [
                `${TABLE} tbody tr:nth-child(${row})`,
                `${TABLE} tbody tr:nth-child(${row}) td[data-kind]`,
              ],
            )
          // Rest, every row: a striped row's tint is layered over the surface; an unstriped row IS
          // the surface. Either way the pinned cell paints what its row paints.
          for (const row of [1, 2]) {
            const state = await read(row)
            expect(state.cellBg, `row ${row} base`).toBe(surface)
            if (state.rowBg !== 'rgba(0, 0, 0, 0)') expect(state.cellImage).toContain(state.rowBg)
            else expect(state.cellImage).toBe('linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0))')
          }
          // Hover: the row's hover tint is layered the same way.
          await p.raw.hover(`${TABLE} tbody tr:nth-child(2)`)
          await p.settle()
          const hovered = await read(2)
          expect(hovered.rowBg).not.toBe('rgba(0, 0, 0, 0)')
          expect(hovered.cellBg).toBe(surface)
          expect(hovered.cellImage).toContain(hovered.rowBg)
        })
      }
    }

    test.if(scrolls)(`${name}: the scroller takes focus and the arrow keys scroll it`, async () => {
      const p = await openFixture(spec(), WIDE)
      expect(await p.raw.getAttribute(SCROLLER, 'tabindex')).toBe('0')
      expect(await p.raw.getAttribute(SCROLLER, 'role')).toBe('region')
      expect(await p.raw.getAttribute(SCROLLER, 'aria-label')).toMatch(/scrolls horizontally$/)
      await p.quiesce()
      await p.raw.focus(SCROLLER)
      const before = await p.raw.evaluate(
        (s) => (document.querySelector(s) as HTMLElement).scrollLeft,
        SCROLLER,
      )
      await p.raw.keyboard.press('ArrowRight')
      await p.settle()
      const after = await p.raw.evaluate(
        (s) => (document.querySelector(s) as HTMLElement).scrollLeft,
        SCROLLER,
      )
      expect(after).toBeGreaterThan(before)
    })

    test(`${name}: Tab reaches the fold toggle, Enter expands it, the folded value shows`, async () => {
      const p = await openFixture(spec(), WIDE)
      const toggle = `${TABLE} tbody tr:first-child button[aria-expanded]`
      expect(await p.raw.getAttribute(toggle, 'aria-expanded')).toBe('false')
      expect(await p.raw.getAttribute(toggle, 'aria-label')).toMatch(/^Show /)
      await p.raw.focus(FIRST_TH)
      // The sortable headers are tab stops too; walk until the toggle holds focus.
      let focused: string | null = null
      for (let i = 0; i < 12 && focused === null; i++) {
        await p.raw.keyboard.press('Tab')
        focused = await p.raw.evaluate(
          () => document.activeElement?.getAttribute('aria-expanded') ?? null,
        )
      }
      expect(focused).toBe('false')
      await p.raw.keyboard.press('Enter')
      await p.settle()
      expect(await p.raw.getAttribute(toggle, 'aria-expanded')).toBe('true')
      const disclosure = `${TABLE} tbody tr:nth-child(2)`
      const visible = await p.raw.evaluate((s) => {
        const el = document.querySelector(s) as HTMLElement
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && el.textContent !== ''
      }, disclosure)
      expect(visible).toBe(true)
    })
  }

  test('the shell-width table never wraps a header and never overflows the page (phone)', async () => {
    const p = await openFixture({ ...base, w42Responsive: { shape: 'workouts' } }, PHONE)
    const heights = await p.raw.evaluate((s) => {
      return [...document.querySelectorAll(s)].map((el) => el.getBoundingClientRect().height)
    }, `${TABLE} thead th`)
    for (const height of heights) expect(height).toBeLessThanOrEqual(41)
    const overflow = await p.horizontalOverflow()
    expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.innerWidth)
  })

  for (const { shape, width } of [
    { shape: 'workouts', width: 360 },
    { shape: 'sessions', width: 390 },
  ] as const) {
    const headerTexts = (p: Awaited<ReturnType<typeof openFixture>>) =>
      p.raw.evaluate((s) => {
        return [...document.querySelectorAll(s)].map((th) => ({
          text: th.textContent,
          height: th.getBoundingClientRect().height,
        }))
      }, `${TABLE} thead th`)

    test(`a refetching ${shape} table @${width} keeps the loaded fold; its headers hold one line`, async () => {
      const p = await openFixture({ ...base, w42Responsive: { shape, width, reload: true } }, WIDE)
      await p.quiesce()
      const loaded = await headerTexts(p)
      await p.raw.click('[data-testid="w42-reload"]')
      await p.quiesce()
      expect(await p.count(`${TABLE} tbody tr:first-child td`)).toBe(loaded.length)
      const loading = await headerTexts(p)
      expect(loading.map((h) => h.text)).toEqual(loaded.map((h) => h.text))
      for (const header of loading) expect(header.height).toBeLessThanOrEqual(41)
    })

    test(`a cold-loading ${shape} table @${width} never wraps a header or overflows its box`, async () => {
      const p = await openFixture({ ...base, w42Responsive: { shape, width, loading: true } }, WIDE)
      await p.quiesce()
      for (const header of await headerTexts(p)) expect(header.height).toBeLessThanOrEqual(41)
      const info = await p.raw.evaluate((s) => {
        const el = document.querySelector(s) as HTMLElement
        return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
      }, SCROLLER)
      expect(info.scrollWidth).toBeLessThanOrEqual(info.clientWidth + 1)
    })
  }

  test('a loading table never overflows the page (phone)', async () => {
    const p = await openFixture(
      { ...base, w42Responsive: { shape: 'sessions', loading: true } },
      PHONE,
    )
    const overflow = await p.horizontalOverflow()
    expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.innerWidth)
  })
})
