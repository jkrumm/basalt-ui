/**
 * Meter / BarList / StatCard-visual-slot geometry in a real browser (SPEC § 6.3, § 6.4). These are
 * layout outcomes happy-dom cannot observe: a bar's right edge against its value cell, a caption row
 * wrapping instead of clipping, and which box a Meter occupies inside StatCard's visual slot.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage } from './harness'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  dash: true,
}

const LIST = '[data-testid="dash-barlist"]'

layout('Meter / BarList geometry', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  let p: LayoutPage
  beforeAll(async () => {
    p = await openFixture(SPEC, DESKTOP_1440)
    await p.settle()
  }, CLOSE_BUDGET_MS)

  test('a BarList bar ends before its value, and the columns align across rows', async () => {
    const rows = await p.raw.evaluate((list) => {
      const rect = (el: Element | null) => {
        if (!el) throw new Error('missing BarList part')
        const r = el.getBoundingClientRect()
        return { left: r.left, right: r.right }
      }
      return [...document.querySelectorAll(`${list} li`)].map((li) => {
        const cells = [...li.children]
        return {
          track: rect(cells[0] ?? null),
          bar: rect(li.querySelector('[data-bar-track] > span[aria-hidden]')),
          value: rect(cells[1] ?? null),
        }
      })
    }, LIST)
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.bar.right).toBeLessThanOrEqual(row.track.right + 0.5)
      expect(row.track.right).toBeLessThanOrEqual(row.value.left + 0.5)
    }
    // One shared scale: every row's track and value cell sit in the same columns.
    expect(new Set(rows.map((r) => Math.round(r.track.right))).size).toBe(1)
    expect(new Set(rows.map((r) => Math.round(r.value.left))).size).toBe(1)
  })

  test('the full-scale bar spans exactly its track', async () => {
    const [track, bar] = await p.raw.evaluate((list) => {
      const li = document.querySelector(`${list} li`)
      const t = li?.querySelector('[data-bar-track]')?.getBoundingClientRect()
      const b = li?.querySelector('[data-bar-track] > span[aria-hidden]')?.getBoundingClientRect()
      if (!t || !b) throw new Error('no BarList row')
      return [t.width, b.width] as const
    }, LIST)
    expect(bar).toBeGreaterThan(0)
    expect(bar).toBeLessThanOrEqual(track + 0.5)
    expect(Math.abs(bar - track)).toBeLessThan(1)
  })

  test('skeleton rows and the empty text stack at the list width', async () => {
    const { list, skeletons, empty } = await p.raw.evaluate(() => {
      const root = document.querySelector('[data-testid="dash-barlist-states"]')
      const [loading, emptyList] = [...(root?.children ?? [])]
      const width = (el: Element | null | undefined) => el?.getBoundingClientRect().width ?? -1
      return {
        list: width(loading),
        skeletons: [...(loading?.querySelectorAll('[data-bar-skeleton]') ?? [])].map(width),
        empty: { list: width(emptyList), text: width(emptyList?.firstElementChild) },
      }
    })
    expect(skeletons.length).toBeGreaterThan(0)
    for (const w of skeletons) expect(Math.abs(w - list)).toBeLessThan(1)
    expect(Math.abs(empty.text - empty.list)).toBeLessThan(1)
  })

  test('a Meter caption row wraps at a narrow width without truncating', async () => {
    const result = await p.raw.evaluate(() => {
      const root = document.querySelector('[data-testid="dash-meter-wrap"]') as HTMLElement
      const rowBox = root.querySelector('[data-meter-captions]') as HTMLElement
      const caps = [...rowBox.children] as HTMLElement[]
      const rootBox = root.getBoundingClientRect()
      return {
        caps: caps.map((c) => {
          const r = c.getBoundingClientRect()
          return {
            top: r.top,
            left: r.left,
            right: r.right,
            clipped: c.scrollWidth > c.clientWidth,
            ellipsis: getComputedStyle(c).textOverflow,
          }
        }),
        rootLeft: rootBox.left,
        rootRight: rootBox.right,
        rowOverflow: rowBox.scrollWidth > rowBox.clientWidth,
      }
    })
    expect(result.caps.length).toBeGreaterThanOrEqual(2)
    for (const c of result.caps) {
      expect(c.clipped).toBe(false)
      expect(c.ellipsis).toBe('clip')
      expect(c.left).toBeGreaterThanOrEqual(result.rootLeft - 0.5)
      expect(c.right).toBeLessThanOrEqual(result.rootRight + 0.5)
    }
    expect(result.rowOverflow).toBe(false)
    // It wrapped (more than one line), and the end caption stays flush to the end.
    expect(new Set(result.caps.map((c) => Math.round(c.top))).size).toBeGreaterThan(1)
    const end = result.caps.at(-1)
    expect(Math.abs((end?.right ?? 0) - result.rootRight)).toBeLessThan(1)
  })

  test('categorical part captions wrap inside a narrow Meter', async () => {
    const { items, tops, overflow } = await p.raw.evaluate(() => {
      const root = document.querySelector('[data-testid="dash-meter-parts"]') as HTMLElement
      const list = root.querySelector('[data-meter-parts]') as HTMLElement
      const lis = [...list.children] as HTMLElement[]
      const rootBox = root.getBoundingClientRect()
      return {
        items: lis.map((li) => {
          const r = li.getBoundingClientRect()
          return { left: r.left, right: r.right }
        }),
        tops: lis.map((li) => Math.round(li.getBoundingClientRect().top)),
        overflow: [rootBox.left, rootBox.right, list.scrollWidth > list.clientWidth] as const,
      }
    })
    expect(items).toHaveLength(3)
    expect(overflow[2]).toBe(false)
    for (const i of items) {
      expect(i.left).toBeGreaterThanOrEqual(overflow[0] - 0.5)
      expect(i.right).toBeLessThanOrEqual(overflow[1] + 0.5)
    }
    expect(new Set(tops).size).toBeGreaterThan(1)
  })

  test.each([360, 560])(
    'a Meter in a %ipx StatCard keeps the card inline inset and sizes to content',
    async (w) => {
      const m = await p.raw.evaluate((root) => {
        const card = document.querySelector(`${root} .mantine-Card-root`) as HTMLElement
        const meter = card.querySelector('[data-basalt-meter]') as HTMLElement
        const slotEl = meter.parentElement as HTMLElement
        const c = card.getBoundingClientRect()
        const r = meter.getBoundingClientRect()
        const inset = parseFloat(getComputedStyle(card).paddingInlineStart)
        return {
          insetLeft: r.left - c.left,
          insetRight: c.right - r.right,
          padding: inset,
          slotHeight: slotEl.getBoundingClientRect().height,
          meterHeight: r.height,
          clipped: meter.scrollWidth > meter.clientWidth,
        }
      }, `[data-testid="dash-card-${w}"]`)
      expect(m.insetLeft).toBeGreaterThanOrEqual(m.padding - 0.5)
      expect(m.insetRight).toBeGreaterThanOrEqual(m.padding - 0.5)
      // Track + captions are taller than the sparkline's fixed 22 px.
      expect(m.slotHeight).toBeGreaterThan(22)
      expect(m.slotHeight).toBeGreaterThanOrEqual(m.meterHeight - 0.5)
      expect(m.clipped).toBe(false)
    },
  )

  test('a sparkline in the bleed slot keeps its fixed height and bleeds to the card edges', async () => {
    const m = await p.raw.evaluate(() => {
      const card = document.querySelector(
        '[data-testid="dash-card-spark"] .mantine-Card-root',
      ) as HTMLElement
      const el = card.querySelector('[data-testid="dash-spark"]')?.parentElement as HTMLElement
      const c = card.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      return { height: r.height, bleedLeft: r.left - c.left, bleedRight: c.right - r.right }
    })
    expect(Math.round(m.height)).toBe(22)
    expect(m.bleedLeft).toBeLessThan(2)
    expect(m.bleedRight).toBeLessThan(2)
  })

  test('a Meter in the right placement is neither clipped nor given the sparkline box', async () => {
    const m = await p.raw.evaluate(() => {
      const card = document.querySelector(
        '[data-testid="dash-card-right"] .mantine-Card-root',
      ) as HTMLElement
      const meter = card.querySelector('[data-basalt-meter]') as HTMLElement
      const slot = meter.parentElement as HTMLElement
      const caps = meter.querySelector('[data-meter-captions]') as HTMLElement | null
      const s = slot.getBoundingClientRect()
      const r = meter.getBoundingClientRect()
      return {
        overflow: getComputedStyle(slot).overflow,
        slotHeight: s.height,
        meterHeight: r.height,
        capsBottom: caps?.getBoundingClientRect().bottom ?? 0,
        slotBottom: s.bottom,
        slotWidth: s.width,
      }
    })
    expect(m.overflow).toBe('visible')
    expect(m.slotHeight).toBeGreaterThanOrEqual(m.meterHeight - 0.5)
    expect(m.capsBottom).toBeLessThanOrEqual(m.slotBottom + 0.5)
    expect(m.slotWidth).toBeGreaterThan(72)
  })
})
