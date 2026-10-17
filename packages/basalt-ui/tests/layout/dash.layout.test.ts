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
/** Sub-pixel rounding in `getBoundingClientRect` against a layout edge. */
const SUBPIXEL = 0.5
/** Two boxes that should coincide (an edge, a width): allowed to differ by under one device pixel row. */
const SNAP = 1

layout('Meter / BarList geometry', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  let p: LayoutPage
  beforeAll(async () => {
    p = await openFixture(SPEC, DESKTOP_1440)
    await p.settle()
  }, CLOSE_BUDGET_MS)

  test('a BarList bar ends before its value, and the columns align across rows', async () => {
    const rows = await p.raw.evaluate((list) => {
      const need = (root: ParentNode, selector: string, what: string) => {
        const el = root.querySelector(selector)
        if (!el) throw new Error(`LAYOUT: no ${what} (${selector})`)
        return el
      }
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect()
        return { left: r.left, right: r.right }
      }
      return [...document.querySelectorAll(`${list} li`)].map((li) => ({
        track: rect(need(li, '[data-bar-track]', 'BarList track')),
        bar: rect(need(li, '[data-bar-track] > span[aria-hidden]', 'BarList bar')),
        value: rect(need(li, '[data-bar-track] + *', 'BarList value cell')),
      }))
    }, LIST)
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.bar.right).toBeLessThanOrEqual(row.track.right + SUBPIXEL)
      expect(row.track.right).toBeLessThanOrEqual(row.value.left + SUBPIXEL)
    }
    // One shared scale: every row's track and value cell sit in the same columns.
    expect(new Set(rows.map((r) => Math.round(r.track.right))).size).toBe(1)
    expect(new Set(rows.map((r) => Math.round(r.value.left))).size).toBe(1)
  })

  test('the full-scale bar spans exactly its track', async () => {
    const [track, bar] = await p.raw.evaluate((list) => {
      const need = (root: ParentNode, selector: string, what: string) => {
        const el = root.querySelector(selector)
        if (!el) throw new Error(`LAYOUT: no ${what} (${selector})`)
        return el
      }
      const li = need(document, `${list} li`, 'BarList row')
      const t = need(li, '[data-bar-track]', 'BarList track').getBoundingClientRect()
      const b = need(
        li,
        '[data-bar-track] > span[aria-hidden]',
        'BarList bar',
      ).getBoundingClientRect()
      return [t.width, b.width] as const
    }, LIST)
    expect(bar).toBeGreaterThan(0)
    expect(Math.abs(bar - track)).toBeLessThan(SNAP)
  })

  test('skeleton rows and the empty text stack at the list width', async () => {
    const { list, skeletons, empty } = await p.raw.evaluate(() => {
      const root = document.querySelector('[data-testid="dash-barlist-states"]')
      if (!root) throw new Error('LAYOUT: no BarList states probe')
      const [loading, emptyList] = [...root.children]
      if (!loading || !emptyList?.firstElementChild)
        throw new Error('LAYOUT: no loading/empty list')
      const width = (el: Element) => el.getBoundingClientRect().width
      return {
        list: width(loading),
        skeletons: [...loading.querySelectorAll('[data-bar-skeleton]')].map(width),
        empty: { list: width(emptyList), text: width(emptyList.firstElementChild) },
      }
    })
    expect(skeletons.length).toBeGreaterThan(0)
    for (const w of skeletons) expect(Math.abs(w - list)).toBeLessThan(SNAP)
    expect(Math.abs(empty.text - empty.list)).toBeLessThan(SNAP)
  })

  test.each([160, 360])(
    'Meter zone names never overlap or leave the row, at %ipx',
    async (width) => {
      const m = await p.raw.evaluate((root) => {
        const host = document.querySelector<HTMLElement>(`[data-testid="${root}"]`)
        if (!host) throw new Error(`LAYOUT: no ${root}`)
        const visible = [
          ...host.querySelectorAll<HTMLElement>(
            '[data-meter-zone-labels]:not([data-collapsed]) [data-meter-zone-label], [data-meter-zone-labels="list"] [data-meter-zone-label]',
          ),
        ]
        const boxes = visible.map((el) => {
          const r = el.getBoundingClientRect()
          return {
            name: el.textContent,
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
          }
        })
        const box = host.getBoundingClientRect()
        const holding = host.querySelector<HTMLElement>('[data-holding]')
        return {
          boxes,
          rootLeft: box.left,
          rootRight: box.right,
          mode: host.querySelector('[data-meter-zone-labels="list"]') ? 'list' : 'band',
          holdingName: holding?.textContent,
          holdingColor: holding ? getComputedStyle(holding).color : '',
          otherColor: getComputedStyle(
            host.querySelector<HTMLElement>('[data-meter-zone-label]:not([data-holding])') ?? host,
          ).color,
        }
      }, `dash-meter-zones-${width}`)
      expect(m.boxes).toHaveLength(4)
      for (const [i, a] of m.boxes.entries()) {
        expect(a.left).toBeGreaterThanOrEqual(m.rootLeft - SUBPIXEL)
        expect(a.right).toBeLessThanOrEqual(m.rootRight + SUBPIXEL)
        for (const b of m.boxes.slice(i + 1)) {
          const apart =
            a.right <= b.left + SUBPIXEL ||
            b.right <= a.left + SUBPIXEL ||
            a.bottom <= b.top + SUBPIXEL ||
            b.bottom <= a.top + SUBPIXEL
          expect(apart).toBe(true)
        }
      }
      // Whichever mode the width produced, the list keeps zone order.
      if (m.mode === 'list') {
        expect(m.boxes.map((b) => b.name)).toEqual(['Low', 'Optimal', 'High', 'Overreaching'])
      }
      expect(m.holdingName).toBe('Optimal')
      expect(m.holdingColor).not.toBe(m.otherColor)
    },
  )

  test('Meter zone names collapse to a list when the row narrows and return when it widens', async () => {
    const modeAt = (width: number) =>
      p.raw.evaluate(async (w) => {
        const host = document.querySelector<HTMLElement>('[data-testid="dash-meter-zones-360"]')
        if (!host) throw new Error('LAYOUT: no dash-meter-zones-360')
        host.style.width = `${w}px`
        // A ResizeObserver callback lands before the next paint; two frames is enough to see it.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        return host.querySelector('[data-meter-zone-labels="list"]') ? 'list' : 'band'
      }, width)
    expect(await modeAt(120)).toBe('list')
    expect(await modeAt(360)).toBe('band')
  })

  test('a Meter caption row wraps at a narrow width without truncating', async () => {
    const result = await p.raw.evaluate(() => {
      const root = document.querySelector<HTMLElement>('[data-testid="dash-meter-wrap"]')
      const row = root?.querySelector<HTMLElement>('[data-meter-captions]')
      if (!root || !row) throw new Error('LAYOUT: no wrapping Meter caption row')
      const box = root.getBoundingClientRect()
      return {
        caps: ([...row.children] as HTMLElement[]).map((c) => {
          const r = c.getBoundingClientRect()
          return {
            top: r.top,
            left: r.left,
            right: r.right,
            clipped: c.scrollWidth > c.clientWidth,
            ellipsis: getComputedStyle(c).textOverflow,
          }
        }),
        rootLeft: box.left,
        rootRight: box.right,
        rowOverflow: row.scrollWidth > row.clientWidth,
      }
    })
    expect(result.caps.length).toBeGreaterThanOrEqual(2)
    for (const c of result.caps) {
      expect(c.clipped).toBe(false)
      expect(c.ellipsis).toBe('clip')
      expect(c.left).toBeGreaterThanOrEqual(result.rootLeft - SUBPIXEL)
      expect(c.right).toBeLessThanOrEqual(result.rootRight + SUBPIXEL)
    }
    expect(result.rowOverflow).toBe(false)
    // It wrapped (more than one line), and the end caption stays flush to the end.
    expect(new Set(result.caps.map((c) => Math.round(c.top))).size).toBeGreaterThan(1)
    expect(Math.abs((result.caps.at(-1)?.right ?? 0) - result.rootRight)).toBeLessThan(SNAP)
  })

  test.each(['dash-meter-parts', 'dash-meter-long'])(
    'part captions wrap inside a narrow Meter and never overflow it (%s)',
    async (id) => {
      const { items, root, overflow } = await p.raw.evaluate((testId) => {
        const host = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
        const list = host?.querySelector<HTMLElement>('[data-meter-parts]')
        if (!host || !list) throw new Error(`LAYOUT: no part-caption list in ${testId}`)
        const box = host.getBoundingClientRect()
        return {
          items: ([...list.children] as HTMLElement[]).map((li) => {
            const r = li.getBoundingClientRect()
            return { left: r.left, right: r.right, top: Math.round(r.top) }
          }),
          root: { left: box.left, right: box.right },
          overflow: list.scrollWidth > list.clientWidth || host.scrollWidth > host.clientWidth,
        }
      }, id)
      expect(items.length).toBeGreaterThanOrEqual(2)
      expect(overflow).toBe(false)
      for (const i of items) {
        expect(i.left).toBeGreaterThanOrEqual(root.left - SUBPIXEL)
        expect(i.right).toBeLessThanOrEqual(root.right + SUBPIXEL)
      }
      expect(new Set(items.map((i) => i.top)).size).toBeGreaterThan(1)
    },
  )

  test('a ring value of €12,483 stays inside the ring box', async () => {
    const m = await p.raw.evaluate(() => {
      const host = document.querySelector('[data-testid="dash-meter-ring"]')
      const ring = host?.querySelector<HTMLElement>('[role="meter"]')
      const value = ring?.lastElementChild
      if (!ring || !value) throw new Error('LAYOUT: no ring value')
      const r = ring.getBoundingClientRect()
      const v = value.getBoundingClientRect()
      return { text: value.textContent, ring: [r.left, r.right], value: [v.left, v.right] }
    })
    expect(m.text).toBe('€12,483')
    expect(m.value[0]).toBeGreaterThanOrEqual((m.ring[0] ?? 0) - SUBPIXEL)
    expect(m.value[1]).toBeLessThanOrEqual((m.ring[1] ?? 0) + SUBPIXEL)
  })

  test.each([360, 560])(
    'a Meter in a %ipx StatCard keeps the card inline inset and sizes to content',
    async (w) => {
      const m = await p.raw.evaluate((root) => {
        const card = document.querySelector<HTMLElement>(`${root} .mantine-Card-root`)
        const meter = card?.querySelector<HTMLElement>('[data-basalt-meter]')
        const slot = meter?.parentElement
        if (!card || !meter || !slot) throw new Error(`LAYOUT: no Meter slot in ${root}`)
        const c = card.getBoundingClientRect()
        const r = meter.getBoundingClientRect()
        return {
          insetLeft: r.left - c.left,
          insetRight: c.right - r.right,
          padding: parseFloat(getComputedStyle(card).paddingInlineStart),
          slotHeight: slot.getBoundingClientRect().height,
          meterHeight: r.height,
          clipped: meter.scrollWidth > meter.clientWidth,
        }
      }, `[data-testid="dash-card-${w}"]`)
      expect(m.insetLeft).toBeGreaterThanOrEqual(m.padding - SUBPIXEL)
      expect(m.insetRight).toBeGreaterThanOrEqual(m.padding - SUBPIXEL)
      // Track + captions are taller than the sparkline's fixed 22 px.
      expect(m.slotHeight).toBeGreaterThan(22)
      expect(m.slotHeight).toBeGreaterThanOrEqual(m.meterHeight - SUBPIXEL)
      expect(m.clipped).toBe(false)
    },
  )

  test('the over-budget caption is the derived one', async () => {
    const text = await p.raw.evaluate(() => {
      const caps = document.querySelector('[data-testid="dash-meter-wrap"] [data-meter-captions]')
      if (!caps?.lastElementChild) throw new Error('LAYOUT: no end caption')
      return caps.lastElementChild.textContent
    })
    expect(text).toBe('Target €2400 · €250 over')
  })

  test('a sparkline in the bleed slot keeps its fixed height and bleeds to the card edges', async () => {
    const m = await p.raw.evaluate(() => {
      const card = document.querySelector<HTMLElement>(
        '[data-testid="dash-card-spark"] .mantine-Card-root',
      )
      const slot = card?.querySelector('[data-testid="dash-spark"]')?.parentElement
      if (!card || !slot) throw new Error('LAYOUT: no sparkline slot')
      const c = card.getBoundingClientRect()
      const r = slot.getBoundingClientRect()
      return { height: r.height, bleedLeft: r.left - c.left, bleedRight: c.right - r.right }
    })
    expect(Math.round(m.height)).toBe(22)
    expect(m.bleedLeft).toBeLessThan(2)
    expect(m.bleedRight).toBeLessThan(2)
  })

  test.each([360, 560])(
    'a Meter in the right placement fills the row, unclipped (%ipx card)',
    async (w) => {
      const m = await p.raw.evaluate((root) => {
        const card = document.querySelector<HTMLElement>(`${root} .mantine-Card-root`)
        const meter = card?.querySelector<HTMLElement>('[data-basalt-meter]')
        const slot = meter?.parentElement
        const row = slot?.parentElement
        if (!card || !meter || !slot || !row) throw new Error(`LAYOUT: no right slot in ${root}`)
        const s = slot.getBoundingClientRect()
        const r = meter.getBoundingClientRect()
        const rowBox = row.getBoundingClientRect()
        const rowStyle = getComputedStyle(row)
        const prev = slot.previousElementSibling?.getBoundingClientRect()
        const caps = meter.querySelector('[data-meter-captions]')?.getBoundingClientRect()
        return {
          overflow: getComputedStyle(slot).overflow,
          slotHeight: s.height,
          meterHeight: r.height,
          capsBottom: caps?.bottom ?? 0,
          slotBottom: s.bottom,
          slotLeft: s.left,
          slotRight: s.right,
          rowLeft: rowBox.left + parseFloat(rowStyle.paddingLeft),
          rowRight: rowBox.right - parseFloat(rowStyle.paddingRight),
          column: rowStyle.flexDirection === 'column',
          prevRight: prev?.right ?? null,
          gap: parseFloat(rowStyle.columnGap) || 0,
        }
      }, `[data-testid="dash-card-right-${w}"]`)
      expect(m.overflow).toBe('visible')
      expect(m.slotHeight).toBeGreaterThanOrEqual(m.meterHeight - SUBPIXEL)
      expect(m.capsBottom).toBeLessThanOrEqual(m.slotBottom + SUBPIXEL)
      // The slot reaches the row's end and starts where the sibling (plus the gap) leaves off.
      expect(Math.abs(m.slotRight - m.rowRight)).toBeLessThan(SNAP)
      // With no breakdown beside it the slot is the row's only child, so it starts at the row's start.
      const start = m.column || m.prevRight === null ? m.rowLeft : m.prevRight + m.gap
      expect(Math.abs(m.slotLeft - start)).toBeLessThan(SNAP)
    },
  )
})
