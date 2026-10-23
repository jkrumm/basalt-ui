/**
 * Wave 52 lists in real Chrome:
 * - a timeline box that cuts a row above or below says so (`N earlier` / `N later`), so the day header's
 *   count matches what a reader can reach (W51 S3 item timeline at 390);
 * - the rows of a short feed carry a gap between them, no divider (row 211);
 * - the slack of a wide table sits after the last column, not in a short cell (W51 S1 outages, S2 sessions);
 * - the fold button names what it reveals before a tap (W51 S1/S2/S7 at 390);
 * - a table's time tooltip clears the adjacent rows' times (W51 S7);
 * - a Board column's scroll thumb is thin and quiet (W51 S3).
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
  moduleClass,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const base: Pick<FixtureSpec, 'sections'> = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
}
const lists = (w52Lists: NonNullable<FixtureSpec['w52Lists']>): FixtureSpec => ({
  ...base,
  w52Lists,
})

const HOST = '[data-testid="w52-host"]'
const SCROLL = `${HOST} ${moduleClass('scroll')}`

layout('Wave 52 EventList', () => {
  test('390: a timeline box that cuts rows above names them, and the first row is reachable by scrolling', async () => {
    const p = await openFixture(lists('timeline'), PHONE)
    await p.raw.waitForSelector(`${SCROLL}[data-above]`)
    const r = (await p.raw.evaluate(`(() => {
      const el = document.querySelector('${SCROLL}')
      const rows = [...el.querySelectorAll('[data-event-id]')]
      const text = getComputedStyle(el, '::before').content
      const above = el.getAttribute('data-above')
      const headerH = el.querySelector('[data-day-header]').getBoundingClientRect().height
      const box = el.getBoundingClientRect()
      const hidden = rows.filter((r) => r.getBoundingClientRect().top < box.top + headerH - 1).length
      const total = rows.length
      el.scrollTop = 0
      return { text, above: Number(above), hidden, total, atTopFirst: rows[0].getBoundingClientRect().top >= box.top }
    })()`)) as { text: string; above: number; hidden: number; total: number; atTopFirst: boolean }
    expect(r.total).toBe(5)
    expect(r.above).toBeGreaterThan(0)
    expect(r.above).toBe(r.hidden)
    expect(r.text).toContain(`${r.above} earlier`)
    // Scrolled to the top the first row is reachable and the top cue is gone; the cue names the rows below.
    expect(r.atTopFirst).toBe(true)
    await p.raw.waitForSelector(`${SCROLL}:not([data-above])`)
    const below = (await p.raw.evaluate(`(() => {
      const el = document.querySelector('${SCROLL}')
      const box = el.getBoundingClientRect()
      const past = [...el.querySelectorAll('[data-event-id]')].filter((r) => r.getBoundingClientRect().bottom > box.bottom + 1).length
      return { past, attr: Number(el.getAttribute('data-below')), text: getComputedStyle(el, '::after').content }
    })()`)) as { past: number; attr: number; text: string }
    expect(below.past).toBeGreaterThan(0)
    expect(below.attr).toBe(below.past)
    expect(below.text).toContain(`${below.past} later`)
  })

  for (const [name, viewport] of [
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const) {
    test(`${name}: nine feed rows read as nine, a gap between them`, async () => {
      const p = await openFixture(lists('feed9'), viewport)
      await p.raw.waitForSelector(`${HOST} [data-event-id]`)
      const r = (await p.raw.evaluate(`(() => {
        const rows = [...document.querySelectorAll('${HOST} [data-event-id]')]
        return {
          n: rows.length,
          headers: document.querySelectorAll('${HOST} [data-day-header]').length,
          tops: rows.map((r) => parseFloat(getComputedStyle(r).paddingTop)),
        }
      })()`)) as { n: number; headers: number; tops: number[] }
      expect(r.n).toBe(9)
      expect(r.headers).toBe(1)
      // The same air on every row, more than the 4 px rhythm of a rail row's neighbour.
      expect(new Set(r.tops).size).toBe(1)
      expect(r.tops[0]).toBeGreaterThan(4)
    })
  }
})

layout('Wave 52 table', () => {
  test('1440: a short Scope / Exercise cell does not take the slack; the tail or a spacer does', async () => {
    const p = await openFixture(lists('slack'), DESKTOP_1440)
    await p.raw.waitForSelector('[data-testid="w52-outages"] tbody tr')
    const r = (await p.raw.evaluate(`(() => {
      const w = (sel) => document.querySelector(sel).getBoundingClientRect().width
      return {
        scope: w('[data-testid="w52-outages"] tbody tr:first-child td:nth-child(3)'),
        cause: w('[data-testid="w52-outages"] tbody tr:first-child td:nth-child(4)'),
        table: w('[data-testid="w52-outages"] table'),
        row: document.querySelector('[data-testid="w52-outages"] tbody tr:first-child').getBoundingClientRect().height,
        exercise: w('[data-testid="w52-sessions"] tbody tr:first-child td:nth-child(1)'),
        spacer: w('[data-testid="w52-sessions"] tbody tr:first-child td:last-child'),
        sessions: w('[data-testid="w52-sessions"] table'),
      }
    })()`)) as Record<
      'scope' | 'cause' | 'table' | 'row' | 'exercise' | 'spacer' | 'sessions',
      number
    >
    // Outages: the kindless tail (Cause) holds the slack; Scope, a short text column, fits its content.
    expect(r.cause).toBeGreaterThan(r.table / 2)
    expect(r.scope).toBeLessThan(r.table / 5)
    // A fitted multi-word text cell holds one line: the row stays at the table's row height.
    expect(r.row).toBeLessThanOrEqual(41)
    // Sessions: the name keeps its content width and the trailing spacer takes the rest.
    expect(r.exercise).toBeLessThan(220)
    expect(r.spacer).toBeGreaterThan(r.sessions / 2)
  })

  test('390: the fold button shows the first folded name inside its toggle cell', async () => {
    const p = await openFixture(lists('fold'), PHONE)
    await p.raw.waitForSelector(`${HOST} thead th button[aria-label^="+"]`)
    const r = (await p.raw.evaluate(`(() => {
      const button = document.querySelector('${HOST} thead th button[aria-label^="+"]')
      const hint = button.querySelector('span')
      const th = button.closest('th').getBoundingClientRect()
      const h = hint.getBoundingClientRect()
      return {
        text: hint.textContent,
        inside: h.left >= th.left - 0.5 && h.right <= th.right + 0.5,
        label: button.getAttribute('aria-label'),
      }
    })()`)) as { text: string; inside: boolean; label: string }
    expect(r.text.length).toBeGreaterThan(0)
    expect(r.inside).toBe(true)
    expect(r.label).toContain(r.text)
  })

  test('1440: the time tooltip clears the rows above and below its cell', async () => {
    const p = await openFixture(lists('tooltip'), DESKTOP_1440)
    const row = `${HOST} tbody tr:nth-child(2) time`
    await p.raw.waitForSelector(row)
    await p.raw.hover(row)
    await p.raw.waitForSelector('.mantine-Tooltip-tooltip')
    const r = (await p.raw.evaluate(`(() => {
      const t = document.querySelector('.mantine-Tooltip-tooltip').getBoundingClientRect()
      const hits = [1, 3].map((n) => {
        const b = document.querySelector('${HOST} tbody tr:nth-child(' + n + ') time').getBoundingClientRect()
        return !(t.right <= b.left || t.left >= b.right || t.bottom <= b.top || t.top >= b.bottom)
      })
      return hits
    })()`)) as boolean[]
    expect(r).toEqual([false, false])
  })
})

layout('Wave 52 Board', () => {
  test('1440: a column scroll thumb is thin and a faint tint', async () => {
    const p = await openFixture({ ...base, board: 'columns' }, DESKTOP_1440)
    await p.raw.waitForSelector('[data-testid="board-host"] .mantine-ScrollArea-thumb')
    const r = (await p.raw.evaluate(`(() => {
      const t = document.querySelector('[data-testid="board-host"] .mantine-ScrollArea-thumb')
      return { width: t.getBoundingClientRect().width, bg: getComputedStyle(t).backgroundColor }
    })()`)) as { width: number; bg: string }
    expect(r.width).toBeLessThanOrEqual(6.5)
    // `color-mix` resolves to `color(srgb r g b / a)` or `rgba()`: the alpha is the last number.
    const alpha = Number(/\/\s*([\d.]+)\)|,\s*([\d.]+)\)$/.exec(r.bg)?.slice(1).find(Boolean) ?? 1)
    expect(alpha).toBeLessThanOrEqual(0.5)
  })
})
