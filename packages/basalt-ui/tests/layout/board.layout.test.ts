/**
 * Wave 45: `Board` in real Chrome — what happy-dom cannot see.
 * - At 1440 the populated and empty columns share one row, and a long column scrolls alone.
 * - Enter and Space on a focused card open it (native button activation).
 * - At 390 one column shows under the switcher; there is no horizontal scroll.
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

const HOST = '[data-testid="board-host"]'

const spec = (mode: NonNullable<FixtureSpec['board']>): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  board: mode,
})

layout('Wave 45 Board', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('1440: columns share the row and each scrolls alone', async () => {
    const p = await openFixture(spec('columns'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} [role="group"]`)
    const r = (await p.raw.evaluate(`(() => {
      const groups = [...document.querySelectorAll('${HOST} [role="group"]')]
      const tops = groups.map((g) => Math.round(g.getBoundingClientRect().top))
      const widths = groups.map((g) => Math.round(g.getBoundingClientRect().width))
      const viewports = groups.map((g) => g.querySelector('[data-scrollarea-viewport], .mantine-ScrollArea-viewport'))
      return {
        count: groups.length,
        tops,
        widths,
        scrolls: viewports.map((v) => (v ? v.scrollHeight > v.clientHeight + 1 : false)),
        heights: viewports.map((v) => (v ? Math.round(v.clientHeight) : 0)),
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
      }
    })()`)) as {
      count: number
      tops: number[]
      widths: number[]
      scrolls: boolean[]
      heights: number[]
      pageOverflow: boolean
    }
    expect(r.count).toBe(4)
    expect(new Set(r.tops).size).toBe(1)
    expect(Math.max(...r.widths) - Math.min(...r.widths)).toBeLessThanOrEqual(2)
    expect(r.scrolls[0]).toBe(true)
    expect(r.heights[0]).toBeLessThanOrEqual(360)
    expect(r.scrolls[3]).toBe(false)
    expect(r.pageOverflow).toBe(false)
  })

  test('1440: Enter and Space on a focused card call onOpen', async () => {
    const p = await openFixture(spec('columns'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} [role="group"]`)
    await p.raw.focus(`${HOST} button[tabindex="0"]`)
    await p.raw.keyboard.press('Enter')
    await p.raw.keyboard.press('ArrowDown')
    await p.raw.keyboard.press('Space')
    const opened = await p.raw.evaluate('window.basaltBoardOpened')
    expect(opened).toEqual(['n0', 'n1'])
  })

  test('390: one column under the switcher, no horizontal scroll', async () => {
    const p = await openFixture(spec('compact'), PHONE)
    await p.raw.waitForSelector(`${HOST} [role="group"]`)
    const r = (await p.raw.evaluate(`(() => {
      const host = document.querySelector('${HOST}')
      return {
        groups: host.querySelectorAll('[role="group"]').length,
        switcher: Boolean(host.querySelector('[aria-label="Board column"]')),
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
      }
    })()`)) as { groups: number; switcher: boolean; pageOverflow: boolean }
    expect(r.groups).toBe(1)
    expect(r.switcher).toBe(true)
    expect(r.pageOverflow).toBe(false)
  })
})
