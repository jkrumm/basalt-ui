/**
 * Wave 50: the folded table's chrome as real geometry (SPEC § 6.6, § 6.11, § 7).
 *
 * - The visible fold header names what folded ("+4 cols"), on one line, inside its 44px cell.
 * - A cold-loading table's skeleton folds the same number of columns the loaded rows fold.
 * - The scroller's focus ring closes on all four sides: it is drawn over the sticky cells, not under.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { CLOSE_BUDGET_MS, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const WIDE: Viewport = { name: 'w50 800', width: 800, height: 900 }
const TOGGLE_WIDTH = 44

const base: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
}

const ROOT = '[data-testid="w42-responsive"]'
const SCROLLER = `${ROOT} .mantine-TableScrollContainer-scrollContainer`
const FOLD_HEADER = `${ROOT} thead th:first-child`

const CASES = [
  { shape: 'workouts', width: 390 },
  { shape: 'workouts', width: 360 },
  { shape: 'sessions', width: 390 },
  { shape: 'sessions', width: 360 },
  { shape: 'outages', width: 374 },
  { shape: 'outages', width: 350 },
  { shape: 'outages', width: 330 },
  { shape: 'outages', width: 310 },
] as const

layout('folded table chrome', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const { shape, width } of CASES) {
    const name = `${shape} @${width}`

    test(`${name}: the fold header says what folded and fits its cell`, async () => {
      const p = await openFixture({ ...base, w42Responsive: { shape, width } }, WIDE)
      await p.quiesce()
      const header = await p.raw.evaluate((s) => {
        const th = document.querySelector(s) as HTMLElement
        const visible = th.querySelector('button') as HTMLElement
        const range = document.createRange()
        // The count is the button's first child; the second is the first folded name (a hint).
        range.selectNodeContents(visible.firstChild as Node)
        return {
          text: visible.firstChild?.textContent,
          width: th.getBoundingClientRect().width,
          height: th.getBoundingClientRect().height,
          textWidth: range.getBoundingClientRect().width,
          hintInside: (() => {
            const hint = visible.querySelector('span')?.getBoundingClientRect()
            const cell = th.getBoundingClientRect()
            return (
              hint !== undefined && hint.left >= cell.left - 0.5 && hint.right <= cell.right + 0.5
            )
          })(),
        }
      }, FOLD_HEADER)
      expect(header.text).toMatch(/^\+\d+ cols?$/)
      // The hint under the count stays inside the cell too.
      expect(header.hintInside).toBe(true)
      expect(header.width).toBeLessThanOrEqual(TOGGLE_WIDTH + 0.5)
      expect(header.textWidth).toBeLessThanOrEqual(header.width)
      expect(header.height).toBeLessThanOrEqual(41)
    })

    // Only the outage log: its text column is a short category word, which a 10rem skeleton bar
    // made 176px wide against 55px loaded (+2 vs +1). A skeleton cannot know a column's content, so
    // a shape whose text is long (workouts, sessions) is not held to the same equality.
    test.if(shape === 'outages')(
      `${name}: the skeleton folds the columns the rows fold`,
      async () => {
        const foldCount = async (loading: boolean): Promise<string | null> => {
          const p = await openFixture(
            {
              ...base,
              w42Responsive: { shape, width, ...(loading && { loading: true as const }) },
            },
            WIDE,
          )
          await p.quiesce()
          return p.raw.evaluate(
            (s) => document.querySelector(s)?.querySelector('button')?.textContent ?? null,
            FOLD_HEADER,
          )
        }
        expect(await foldCount(true)).toBe(await foldCount(false))
      },
    )
  }

  test('a two-digit fold count still fits the toggle cell (390)', async () => {
    const p = await openFixture({ ...base, w42Responsive: { shape: 'wide', width: 390 } }, WIDE)
    await p.quiesce()
    const header = await p.raw.evaluate((s) => {
      const th = document.querySelector(s) as HTMLElement
      const visible = th.querySelector('button') as HTMLElement
      const range = document.createRange()
      range.selectNodeContents(visible.firstChild as Node)
      return {
        text: visible.firstChild?.textContent,
        width: th.getBoundingClientRect().width,
        textWidth: range.getBoundingClientRect().width,
      }
    }, FOLD_HEADER)
    expect(header.text).toMatch(/^\+1\d cols$/)
    expect(header.textWidth).toBeLessThanOrEqual(TOGGLE_WIDTH)
    expect(header.width).toBeLessThanOrEqual(TOGGLE_WIDTH + 0.5)
  })

  test('a cold load with row selection keeps the select column narrow and folds like the rows', async () => {
    const open = async (loading: boolean) => {
      const p = await openFixture(
        {
          ...base,
          w42Responsive: {
            shape: 'outages',
            width: 374,
            select: true,
            ...(loading && { loading: true as const }),
          },
        },
        WIDE,
      )
      await p.quiesce()
      return p.raw.evaluate(
        ([fold, table]) => ({
          fold: document.querySelector(fold!)?.querySelector('button')?.textContent ?? null,
          selectWidth: (
            document.querySelector(
              `${table} tr:first-child [data-basalt-fixed-id="__basalt_select__"]`,
            ) as HTMLElement | null
          )?.getBoundingClientRect().width,
        }),
        [FOLD_HEADER, `${ROOT} table`],
      )
    }
    const cold = await open(true)
    const loaded = await open(false)
    expect(cold.fold).toBe(loaded.fold)
    expect(cold.selectWidth ?? 0).toBeLessThanOrEqual(64)
  })

  test('the scroller focus ring is drawn over the sticky cells, closed on all four sides (390)', async () => {
    const p = await openFixture({ ...base, w42Responsive: { shape: 'workouts', width: 390 } }, WIDE)
    await p.quiesce()
    await p.raw.focus(SCROLLER)
    await p.raw.keyboard.press('Tab')
    await p.raw.keyboard.press('Shift+Tab')
    const ring = await p.raw.evaluate((s) => {
      const scroller = document.querySelector(s) as HTMLElement
      const host = scroller.closest('[class*="foldWrapper"]') as HTMLElement
      const pseudo = getComputedStyle(host, '::after')
      const box = host.getBoundingClientRect()
      const sticky = [...scroller.querySelectorAll<HTMLElement>('th, td')]
        .filter((cell) => getComputedStyle(cell).position === 'sticky')
        .map((cell) => Number.parseInt(getComputedStyle(cell).zIndex, 10) || 0)
      return {
        focused: document.activeElement === scroller,
        position: pseudo.position,
        events: pseudo.pointerEvents,
        sides: [
          pseudo.borderTopWidth,
          pseudo.borderRightWidth,
          pseudo.borderBottomWidth,
          pseudo.borderLeftWidth,
        ],
        width: Number.parseFloat(pseudo.width),
        height: Number.parseFloat(pseudo.height),
        host: { width: box.width, height: box.height },
        z: Number.parseInt(pseudo.zIndex, 10),
        stickyZ: Math.max(0, ...sticky),
        outline: getComputedStyle(scroller).outlineStyle,
      }
    }, SCROLLER)
    expect(ring.focused).toBe(true)
    expect(ring.position).toBe('absolute')
    expect(ring.events).toBe('none')
    expect(ring.sides).toEqual(['2px', '2px', '2px', '2px'])
    expect(ring.width).toBeCloseTo(ring.host.width, 0)
    expect(ring.height).toBeCloseTo(ring.host.height, 0)
    expect(ring.z).toBeGreaterThan(ring.stickyZ)
    expect(ring.outline, 'one ring, not an outline under the overlay').toBe('none')
  })
})
