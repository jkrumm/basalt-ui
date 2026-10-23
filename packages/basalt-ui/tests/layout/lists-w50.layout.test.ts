/**
 * Wave 50 lists in real Chrome:
 * - an EventList row's chips have ONE place, whatever the row's note (row 190);
 * - an EventList uses three font sizes at most (row 191);
 * - a skeleton row keeps the height of a loaded row of the same shape (row 193, list half);
 * - a BarList's delta column is a fixed track: glyphs share an x, figures share a right edge.
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

const HOST = '[data-testid="el-host"]'
const SNAP = 1

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const base: Pick<FixtureSpec, 'sections'> = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
}
const eventList = (mode: NonNullable<FixtureSpec['eventList']>): FixtureSpec => ({
  ...base,
  eventList: mode,
})

type Box = { x: number; y: number; width: number; height: number }

layout('Wave 50 EventList chips, type scale and skeleton', () => {
  for (const [name, viewport] of [
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const) {
    test(`${name}: the chips sit at one place relative to the title, with a note or without`, async () => {
      const p = await openFixture(eventList('wrap'), viewport)
      await p.raw.waitForSelector(`${HOST} ${moduleClass('chips')}`)
      const r = (await p.raw.evaluate(`(() => {
        const row = document.querySelector('${HOST} ${moduleClass('chips')}').closest('${moduleClass('row')}')
        const rel = () => {
          const line = row.querySelector('${moduleClass('line')}').getBoundingClientRect()
          const c = row.querySelector('${moduleClass('chips')}').getBoundingClientRect()
          return { x: c.left - line.left, y: c.top - line.top, width: c.width, height: c.height }
        }
        const meta = row.querySelector('${moduleClass('meta')}')
        const body = meta.getBoundingClientRect()
        const withNote = rel()
        const noteBottom = body.bottom
        const chipTop = row.querySelector('${moduleClass('chips')}').getBoundingClientRect().top
        meta.remove()
        return { withNote, withoutNote: rel(), noteBottom, chipTop }
      })()`)) as { withNote: Box; withoutNote: Box; noteBottom: number; chipTop: number }
      expect(r.withNote.height).toBeGreaterThan(0)
      expect(Math.abs(r.withNote.x - r.withoutNote.x)).toBeLessThanOrEqual(SNAP)
      // The note's own height moves the chips down with it, so the y offset only has to clear the note.
      expect(r.chipTop).toBeGreaterThanOrEqual(r.noteBottom - 1)
      // Without a note the chips sit on the line under the time, directly below the sentence.
      expect(r.withoutNote.y).toBeGreaterThan(0)
    })
  }

  for (const [name, viewport] of [
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const) {
    test(`${name}: a short note and a multi-line note put the chips at one offset below the note`, async () => {
      const p = await openFixture(eventList('wrap'), viewport)
      await p.raw.waitForSelector(`${HOST} ${moduleClass('chips')}`)
      const rows = (await p.raw.evaluate(`(() => {
        const read = (row) => {
          const line = row.querySelector('${moduleClass('line')}').getBoundingClientRect()
          const meta = row.querySelector('${moduleClass('meta')}').getBoundingClientRect()
          const chips = row.querySelector('${moduleClass('chips')}').getBoundingClientRect()
          return { x: chips.left - line.left, belowNote: chips.top - meta.bottom, noteHeight: meta.height }
        }
        const rows = [...document.querySelectorAll('${HOST} ${moduleClass('row')}')].filter((r) => r.querySelector('${moduleClass('chips')}'))
        // Long enough to wrap at 1440 too.
        rows[0].querySelector('${moduleClass('body')}').textContent = 'a long note that wraps '.repeat(40)
        const long = read(rows[0])
        rows[0].querySelector('${moduleClass('body')}').textContent = 'ok'
        return { long, short: read(rows[0]) }
      })()`)) as { long: Record<string, number>; short: Record<string, number> }
      // The note really changed height, and the chips stayed put relative to it.
      expect(rows.long['noteHeight']! - rows.short['noteHeight']!).toBeGreaterThan(0)
      expect(Math.abs(rows.long['x']! - rows.short['x']!)).toBeLessThanOrEqual(SNAP)
      expect(Math.abs(rows.long['belowNote']! - rows.short['belowNote']!)).toBeLessThanOrEqual(SNAP)
    })
  }

  test('a chip Badge asking for size lg still computes to the micro size', async () => {
    const p = await openFixture(eventList('timeline'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} ${moduleClass('chips')}`)
    const r = (await p.raw.evaluate(`(() => {
      const badge = document.querySelector('${HOST} ${moduleClass('chips')} .mantine-Badge-root')
      // What \`<Badge size="lg">\` writes: Mantine's vars resolver sets \`--badge-fz\` inline.
      badge.style.setProperty('--badge-fz', 'var(--badge-fz-lg)')
      return {
        badge: getComputedStyle(badge).fontSize,
        label: getComputedStyle(badge.querySelector('.mantine-Badge-label')).fontSize,
        time: getComputedStyle(document.querySelector('${HOST} time')).fontSize,
      }
    })()`)) as { badge: string; label: string; time: string }
    expect(r.badge).toBe(r.time)
    expect(r.label).toBe(r.time)
  })

  test('1440: every row without a note puts its chips at the same y under its title', async () => {
    const p = await openFixture(eventList('plain'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} ${moduleClass('chips')}`)
    const rows = (await p.raw.evaluate(`(() =>
      [...document.querySelectorAll('${HOST} ${moduleClass('row')}')]
        .filter((row) => row.querySelector('${moduleClass('chips')}'))
        .slice(0, 8)
        .map((row) => {
          const line = row.querySelector('${moduleClass('line')}').getBoundingClientRect()
          const time = row.querySelector('time').getBoundingClientRect()
          const chips = row.querySelector('${moduleClass('chips')}').getBoundingClientRect()
          const meta = row.querySelector('${moduleClass('meta')}')?.getBoundingClientRect()
          return { x: chips.left - line.left, belowTime: chips.top - time.bottom, belowNote: meta ? chips.top - meta.bottom : null }
        }))()`)) as { x: number; belowTime: number; belowNote: number | null }[]
    expect(rows.length).toBeGreaterThan(1)
    const xs = rows.map((r) => r.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(SNAP)
    // Never on the time's line, never on the note's: the chips line starts below both.
    for (const r of rows) {
      expect(r.belowTime).toBeGreaterThanOrEqual(-SNAP)
      if (r.belowNote !== null) expect(r.belowNote).toBeGreaterThanOrEqual(-SNAP)
    }
  })

  test('at most three font sizes in an EventList with a day group, title, note, time and chips', async () => {
    const p = await openFixture(eventList('timeline'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} ${moduleClass('chips')}`)
    const sizes = (await p.raw.evaluate(`(() => {
      const found = new Map()
      const walker = document.createTreeWalker(document.querySelector('${HOST}'), NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim() || !n.parentElement) continue
        const size = getComputedStyle(n.parentElement).fontSize
        found.set(size, (found.get(size) ?? []).concat(n.parentElement.className).slice(0, 3))
      }
      return Object.fromEntries(found)
    })()`)) as Record<string, string[]>
    expect(Object.keys(sizes).length, JSON.stringify(sizes)).toBeLessThanOrEqual(3)
  })

  test('1440: a skeleton row is as tall as a loaded row of the same shape', async () => {
    const p = await openFixture(eventList('plain'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} time`)
    // A loaded row with a time line and no note or chips (every odd fixture row).
    const loaded = (await p.raw.evaluate(`(() => {
      const row = [...document.querySelectorAll('${HOST} ${moduleClass('row')}')].find(
        (r) => !r.querySelector('${moduleClass('meta')}') && !r.querySelector('${moduleClass('chips')}'),
      )
      return row.getBoundingClientRect().height
    })()`)) as number
    await p.raw.evaluate('window.basaltElLoading(true)')
    await p.raw.waitForSelector(`${HOST} [aria-busy="true"]`)
    const skeleton = (await p.raw.evaluate(
      `document.querySelector('${HOST} [aria-busy="true"] ${moduleClass('row')}').getBoundingClientRect().height`,
    )) as number
    expect(Math.abs(skeleton - loaded) / loaded).toBeLessThanOrEqual(0.1)
  })
})

const dash = (): FixtureSpec => ({ ...base, dash: true, chromeW37: true })

layout('Wave 50 BarList delta column', () => {
  for (const [name, viewport] of [
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const) {
    test(`${name}: a zero delta (no glyph) ends on the same right edge as the others`, async () => {
      const p = await openFixture(dash(), viewport)
      await p.settle()
      const rights = (await p.raw.evaluate(`(() => {
        const badges = [...document.querySelectorAll('[data-testid="dash-bar-delta"] [data-delta]')]
        // A zero delta renders no glyph: drop one row's.
        badges[2].querySelector('[data-delta-glyph]').remove()
        return badges.map((b) => {
          const range = document.createRange()
          range.selectNodeContents(b.lastChild)
          return { box: b.getBoundingClientRect().right, fig: range.getBoundingClientRect().right }
        })
      })()`)) as { box: number; fig: number }[]
      const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs)
      expect(spread(rights.map((r) => r.box))).toBeLessThanOrEqual(SNAP)
      expect(spread(rights.map((r) => r.fig))).toBeLessThanOrEqual(SNAP)
    })

    test(`${name}: every delta shares its glyph x and its right edge, one digit or two`, async () => {
      const p = await openFixture(dash(), viewport)
      await p.settle()
      const rows = (await p.raw.evaluate(`(() =>
        [...document.querySelectorAll('[data-testid="dash-bar-delta"] [data-delta]')].map((badge) => {
          const glyph = badge.querySelector('[data-delta-glyph]')
          const text = badge.lastChild
          const range = document.createRange()
          range.selectNodeContents(text)
          return {
            right: badge.getBoundingClientRect().right,
            figRight: range.getBoundingClientRect().right,
            glyphLeft: glyph ? glyph.getBoundingClientRect().left : null,
          }
        }))()`)) as { right: number; figRight: number; glyphLeft: number | null }[]
      expect(rows).toHaveLength(4)
      const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs)
      expect(spread(rows.map((r) => r.right))).toBeLessThanOrEqual(SNAP)
      expect(spread(rows.map((r) => r.figRight))).toBeLessThanOrEqual(SNAP)
      expect(
        spread(rows.flatMap((r) => (r.glyphLeft === null ? [] : [r.glyphLeft]))),
      ).toBeLessThanOrEqual(SNAP)
    })
  }
})
