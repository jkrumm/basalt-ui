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
  PHONE,
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

  // Similar-length names hold the 120px law. Varied names (a short one beside a ~75 character one)
  // are bounded by the label column, which the 14rem cap limits; measured worst gaps are 191px (528)
  // and 216px (1400), asserted with a few px of headroom. The truncated row measures ~12px, the gap.
  test.each([
    ['dash-bar-wide-528', 120],
    ['dash-bar-wide-1400', 120],
    ['dash-bar-varied-528', 195],
    ['dash-bar-varied-1400', 220],
  ] as const)(
    'a wide BarList keeps each name beside its value and aligns the columns (%s, gap <= %ipx)',
    async (id, maxGap) => {
      const m = await p.raw.evaluate((testId) => {
        const host = document.querySelector(`[data-testid="${testId}"]`)
        if (!host) throw new Error(`LAYOUT: no ${testId}`)
        const textRect = (el: Element) => {
          const range = document.createRange()
          range.selectNodeContents(el)
          const r = range.getBoundingClientRect()
          return { left: r.left, right: r.right }
        }
        const need = (root: Element, selector: string) => {
          const el = root.querySelector(selector)
          if (!el) throw new Error(`LAYOUT: no ${selector}`)
          return el
        }
        const box = getComputedStyle(host)
        const inner = host.getBoundingClientRect().right - Number.parseFloat(box.paddingRight)
        return {
          inner,
          rows: [...host.querySelectorAll('li')].map((li) => {
            const spans = [...li.children]
            const [, value, secondary] = spans
            return {
              // The visible edge: a truncated name's text range runs past its box.
              label: {
                right: Math.min(
                  textRect(need(li, 'span')).right,
                  need(li, 'span').getBoundingClientRect().right,
                ),
              },
              value: textRect(value ?? li),
              secondary: secondary?.textContent ? textRect(secondary) : null,
              trackRight: need(li, '[data-bar-track]').getBoundingClientRect().right,
              fillRight: need(li, '[data-bar-fill]').getBoundingClientRect().right,
              order: spans.map((s) => (s.hasAttribute('data-bar-track') ? 'track' : 'cell')),
            }
          }),
        }
      }, id)
      expect(m.rows).toHaveLength(6)
      for (const row of m.rows) {
        expect(row.order.at(-1)).toBe('track')
        expect(row.value.left - row.label.right).toBeLessThanOrEqual(maxGap)
        expect(row.trackRight).toBeLessThanOrEqual(m.inner + SUBPIXEL)
        expect(row.fillRight).toBeLessThanOrEqual(row.trackRight + SUBPIXEL)
      }
      const valueRights = m.rows.map((r) => r.value.right)
      expect(Math.max(...valueRights) - Math.min(...valueRights)).toBeLessThanOrEqual(SNAP)
      const secondaryRights = m.rows.flatMap((r) => (r.secondary ? [r.secondary.right] : []))
      expect(secondaryRights.length).toBeGreaterThan(1)
      expect(Math.max(...secondaryRights) - Math.min(...secondaryRights)).toBeLessThanOrEqual(SNAP)
    },
  )

  test('a BarList in a flex row keeps its width and the wide layout', async () => {
    const m = await p.raw.evaluate(() => {
      const host = document.querySelector('[data-testid="dash-bar-flex"]')
      const frame = host?.firstElementChild
      const track = frame?.querySelector('[data-bar-track]')
      const label = frame?.querySelector('li > span')
      if (!frame || !track || !label) throw new Error('LAYOUT: no flex-row BarList')
      return {
        frame: frame.getBoundingClientRect().width,
        track: track.getBoundingClientRect().width,
        sameLine:
          Math.abs(track.getBoundingClientRect().top - label.getBoundingClientRect().top) < 12,
      }
    })
    expect(m.frame).toBeGreaterThanOrEqual(480)
    expect(m.track).toBeGreaterThan(0)
    expect(m.sameLine).toBe(true)
  })

  test('a compact BarList keeps its label above the bar (no regression)', async () => {
    const { labelBottom, trackTop } = await p.raw.evaluate(() => {
      const li = document.querySelector('[data-testid="dash-bar-thin"] li')
      const label = li?.firstElementChild
      const track = li?.querySelector('[data-bar-track]')
      if (!label || !track) throw new Error('LAYOUT: no compact BarList row')
      return {
        labelBottom: label.getBoundingClientRect().bottom,
        trackTop: track.getBoundingClientRect().top,
      }
    })
    expect(trackTop).toBeGreaterThanOrEqual(labelBottom - SUBPIXEL)
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
    'Meter zone names that show never overlap or leave the row, at %ipx',
    async (width) => {
      const m = await p.raw.evaluate((root) => {
        const host = document.querySelector<HTMLElement>(`[data-testid="${root}"]`)
        if (!host) throw new Error(`LAYOUT: no ${root}`)
        const visible = [
          ...host.querySelectorAll<HTMLElement>('[data-meter-zone-label]:not([data-hidden])'),
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
          hidden: host.querySelectorAll('[data-meter-zone-label][data-hidden]').length,
          holdingName: holding?.textContent,
          holdingColor: holding ? getComputedStyle(holding).color : '',
          otherColor: getComputedStyle(
            host.querySelector<HTMLElement>('[data-meter-zone-label]:not([data-holding])') ?? host,
          ).color,
        }
      }, `dash-meter-zones-${width}`)
      // 'Overreaching' is wider than its 40px span at 160px and hides.
      expect(m.boxes).toHaveLength(4 - m.hidden)
      expect(m.hidden).toBe(width === 160 ? 1 : 0)
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
      expect(m.holdingName).toBe('Optimal')
      expect(m.holdingColor).not.toBe(m.otherColor)
    },
  )

  test.each(
    (['ltr', 'rtl'] as const).flatMap((dir) =>
      [160, 360].flatMap((w) => [0, 500, 1000].map((v) => [dir, w, v] as const)),
    ),
  )(
    'the zoned reading sits under its marker, inside the track, off the zone names (%s, %ipx, %i)',
    async (dir, width, value) => {
      const m = await p.raw.evaluate((root) => {
        const host = document.querySelector<HTMLElement>(`[data-testid="${root}"]`)
        const reading = host?.querySelector<HTMLElement>('[data-meter-reading-row] > span')
        const marker = host?.querySelector<HTMLElement>('[data-meter-tick="marker"]')
        const track = host?.querySelector<HTMLElement>('[data-meter-track]')
        if (!host || !reading || !marker || !track) throw new Error(`LAYOUT: no reading in ${root}`)
        const r = reading.getBoundingClientRect()
        const k = marker.getBoundingClientRect()
        const t = track.getBoundingClientRect()
        const names = [...host.querySelectorAll<HTMLElement>('[data-meter-zone-label]')].map((el) =>
          el.getBoundingClientRect(),
        )
        return {
          readingLeft: r.left,
          readingRight: r.right,
          readingTop: r.top,
          centre: (r.left + r.right) / 2,
          markerCentre: (k.left + k.right) / 2,
          trackLeft: t.left,
          trackRight: t.right,
          nameCount: names.length,
          nameBottom: Math.max(...names.map((n) => n.bottom)),
          captionsInReadingRow: host.querySelector('[data-meter-captions]') !== null,
        }
      }, `dash-meter-reading-${dir}-${width}-${value}`)
      // The names were found (an empty list would make `nameBottom` -Infinity and pass vacuously).
      expect(m.nameCount).toBe(4)
      expect(m.readingLeft).toBeGreaterThanOrEqual(m.trackLeft - SUBPIXEL)
      expect(m.readingRight).toBeLessThanOrEqual(m.trackRight + SUBPIXEL)
      expect(m.readingTop).toBeGreaterThanOrEqual(m.nameBottom - SUBPIXEL)
      expect(m.captionsInReadingRow).toBe(false)
      if (value === 500) {
        expect(Math.abs(m.centre - m.markerCentre)).toBeLessThan(SNAP)
        return
      }
      // At an end the label is clamped: it touches the track edge the marker is on.
      const nearLeft = m.markerCentre < (m.trackLeft + m.trackRight) / 2
      const gap = nearLeft ? m.readingLeft - m.trackLeft : m.trackRight - m.readingRight
      expect(Math.abs(gap)).toBeLessThanOrEqual(SUBPIXEL)
    },
  )

  test.each([
    'dash-card-loading-spark',
    'dash-card-loading-meter',
    'dash-card-slot-meter-loading',
    // Breakdown + sparkline below the 480 px container: the narrow `right` slot must not bleed it.
    'dash-card-loading-right',
  ])(
    'a loading visual-slot skeleton keeps the card inline inset on both sides (%s)',
    async (testId) => {
      const m = await p.raw.evaluate((root) => {
        const card = document.querySelector<HTMLElement>(`${root} .mantine-Card-root`)
        // The card's visual skeleton, or a Meter's own track skeleton sitting in the slot.
        const sk = card?.querySelector<HTMLElement>(
          '[class*="skeletonVisual"], [data-meter-loading] [data-meter-track]',
        )
        if (!card || !sk) throw new Error(`LAYOUT: no skeleton in ${root}`)
        const c = card.getBoundingClientRect()
        const r = sk.getBoundingClientRect()
        return {
          left: r.left - c.left,
          right: c.right - r.right,
          inset: parseFloat(getComputedStyle(card).paddingInlineStart),
        }
      }, `[data-testid="${testId}"]`)
      expect(Math.abs(m.left - m.inset)).toBeLessThanOrEqual(SUBPIXEL)
      expect(Math.abs(m.right - m.inset)).toBeLessThanOrEqual(SUBPIXEL)
    },
  )

  test('Meter zone names hide when the row narrows and return when it widens', async () => {
    const hiddenAt = (width: number) =>
      p.raw.evaluate(async (w) => {
        const host = document.querySelector<HTMLElement>('[data-testid="dash-meter-zones-360"]')
        if (!host) throw new Error('LAYOUT: no dash-meter-zones-360')
        host.style.width = `${w}px`
        // A ResizeObserver callback lands before the next paint; two frames is enough to see it.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        return host.querySelectorAll('[data-meter-zone-label][data-hidden]').length
      }, width)
    expect(await hiddenAt(120)).toBeGreaterThan(0)
    expect(await hiddenAt(360)).toBe(0)
  })

  test('no Meter caption leaves a lone short word on its last line (strip width, 96px)', async () => {
    const lines = await p.raw.evaluate(() => {
      const row = document.querySelector('[data-testid="dash-meter-orphans"] [data-meter-captions]')
      if (!row) throw new Error('LAYOUT: no orphan probe')
      return ([...row.children] as HTMLElement[]).map((c) => {
        const node = c.firstChild
        const text = node?.textContent ?? ''
        // Chunks are split on the ordinary space only: a no-break space is one unbreakable chunk.
        const chunks: { text: string; top: number }[] = []
        let at = 0
        for (const part of text.split(' ')) {
          const range = document.createRange()
          if (node) range.setStart(node, at)
          if (node) range.setEnd(node, at + part.length)
          chunks.push({ text: part, top: Math.round(range.getBoundingClientRect().top) })
          at += part.length + 1
        }
        const byLine = new Map<number, string[]>()
        for (const k of chunks) byLine.set(k.top, [...(byLine.get(k.top) ?? []), k.text])
        return [...byLine.values()].map((l) => l.join(' '))
      })
    })
    expect(lines.length).toBeGreaterThanOrEqual(2)
    for (const caption of lines) {
      if (caption.length < 2) continue
      for (const line of caption) expect(line.length).toBeGreaterThan(6)
    }
  })

  test('a BarList with no variant (thin) keeps its titles readable at a phone width, and its secondary is the sans', async () => {
    const m = await p.raw.evaluate(() => {
      const root = document.querySelector('[data-testid="dash-bar-thin"]')
      const label = root?.querySelector<HTMLElement>('li [title]')
      const short = root?.querySelector<HTMLElement>('li [title="Sleep"]')
      const word = root?.querySelector<HTMLElement>('[data-verdict-word]')
      if (!root || !label || !word || !short) throw new Error('LAYOUT: no thin BarList probe')
      const probe = document.createElement('span')
      probe.style.fontFamily = 'var(--basalt-font-mono)'
      root.append(probe)
      const monoFont = getComputedStyle(probe).fontFamily
      probe.remove()
      const style = getComputedStyle(label)
      return {
        labelWidth: label.getBoundingClientRect().width,
        lineHeight: Number.parseFloat(style.lineHeight),
        labelHeight: label.getBoundingClientRect().height,
        clamp: style.getPropertyValue('-webkit-line-clamp'),
        truncated: label.scrollHeight > label.clientHeight + 1,
        shortTruncated:
          short.scrollWidth > short.clientWidth + 1 || short.scrollHeight > short.clientHeight + 1,
        thin: root.querySelector('ul')?.getAttribute('data-variant'),
        title: label.getAttribute('title'),
        secondaryFont: getComputedStyle(word).fontFamily,
        monoFont,
      }
    })
    expect(m.labelWidth).toBeGreaterThanOrEqual(110)
    expect(m.clamp).toBe('2')
    expect(m.thin).toBe('thin')
    expect(m.shortTruncated).toBe(false)
    expect(m.labelHeight).toBeLessThanOrEqual(2 * m.lineHeight + 1)
    expect(m.title).not.toBeNull()
    expect(m.secondaryFont).not.toBe(m.monoFont)
  })

  test("a ChartCard error is StatCard's anatomy and the card grows to hold its action", async () => {
    const m = await p.raw.evaluate(() => {
      const root = document.querySelector('[data-testid="dash-chart-error"]')
      const alert = root?.querySelector<HTMLElement>('[role="alert"]')
      const action = root?.querySelector<HTMLElement>('button')
      if (!root || !alert || !action) throw new Error('LAYOUT: no chart error probe')
      const a = action.getBoundingClientRect()
      const c = root.getBoundingClientRect()
      return {
        text: alert.textContent ?? '',
        align: getComputedStyle(alert).alignItems,
        textAlign: getComputedStyle(alert).textAlign,
        actionInside:
          a.top >= c.top && a.bottom <= c.bottom && a.left >= c.left && a.right <= c.right,
      }
    })
    expect(m.text).toContain('Could not load')
    expect(m.textAlign).not.toBe('center')
    expect(m.align).toBe('flex-start')
    expect(m.actionInside).toBe(true)
  })

  test('at 390 on a coarse pointer the ChartCard error still holds its action inside the card', async () => {
    const phone = await openFixture(SPEC, PHONE)
    await phone.settle()
    const m = await phone.raw.evaluate(() => {
      const root = document.querySelector('[data-testid="dash-chart-error"]')
      const action = root?.querySelector<HTMLElement>('button')
      const body = action?.closest<HTMLElement>('[role="alert"]')?.parentElement?.parentElement
      if (!root || !action || !body) throw new Error('LAYOUT: no phone chart error probe')
      const a = action.getBoundingClientRect()
      const c = root.getBoundingClientRect()
      return {
        coarse: matchMedia('(pointer: coarse)').matches,
        inside: a.top >= c.top && a.bottom <= c.bottom && a.left >= c.left && a.right <= c.right,
        // Not clipped by the body either: the body is at least as tall as its content.
        bodyHolds: body.scrollHeight <= body.clientHeight + 1,
      }
    })
    expect(m).toEqual({ coarse: true, inside: true, bodyHolds: true })
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

  test('a zoned Meter with the reading off has no label row under the marker (300px cell)', async () => {
    const m = await p.raw.evaluate(() => {
      const host = document.querySelector<HTMLElement>('[data-testid="dash-w37-reading-off"]')
      const marker = host?.querySelector<HTMLElement>('[data-meter-tick="marker"]')
      const names = host?.querySelector<HTMLElement>('[data-meter-zone-band]')
      if (!host || !marker || !names) throw new Error('LAYOUT: no reading-off Meter')
      return {
        readingRows: host.querySelectorAll('[data-meter-reading-row]').length,
        below: host.getBoundingClientRect().bottom - names.getBoundingClientRect().bottom,
        valuenow: host.querySelector('[role="meter"]')?.getAttribute('aria-valuenow'),
      }
    })
    expect(m.readingRows).toBe(0)
    // Nothing sits under the zone-name row: the Meter ends where the names end.
    expect(Math.abs(m.below)).toBeLessThanOrEqual(SNAP)
    expect(m.valuenow).toBe('76')
  })

  test('a ring target draws its tick inside the ring box, value still centred', async () => {
    const m = await p.raw.evaluate(() => {
      const host = document.querySelector<HTMLElement>('[data-testid="dash-w37-ring-target"]')
      const ring = host?.querySelector<HTMLElement>('[role="meter"]')
      const tick = host?.querySelector<SVGGElement>('[data-meter-ring-tick]')
      const value = ring?.lastElementChild
      if (!ring || !tick || !value) throw new Error('LAYOUT: no ring tick')
      const r = ring.getBoundingClientRect()
      const t = tick.getBoundingClientRect()
      const v = value.getBoundingClientRect()
      return {
        ring: [r.left, r.top, r.right, r.bottom],
        tick: [t.left, t.top, t.right, t.bottom],
        centre: [
          (v.left + v.right) / 2 - (r.left + r.right) / 2,
          (v.top + v.bottom) / 2 - (r.top + r.bottom) / 2,
        ],
      }
    })
    expect(m.tick[0]).toBeGreaterThanOrEqual((m.ring[0] ?? 0) - SUBPIXEL)
    expect(m.tick[1]).toBeGreaterThanOrEqual((m.ring[1] ?? 0) - SUBPIXEL)
    expect(m.tick[2]).toBeLessThanOrEqual((m.ring[2] ?? 0) + SUBPIXEL)
    expect(m.tick[3]).toBeLessThanOrEqual((m.ring[3] ?? 0) + SUBPIXEL)
    expect(Math.abs(m.centre[0] ?? 9)).toBeLessThanOrEqual(SNAP)
    expect(Math.abs(m.centre[1] ?? 9)).toBeLessThanOrEqual(SNAP)
  })

  test.each([
    ['dash-w37-forecast', 'boundary', 'by 16'],
    ['dash-w37-target', 'target', 'Target'],
  ])('%s: the caption sits at its tick, not at the track end', async (id, kind, text) => {
    const m = await p.raw.evaluate(
      ({ id, kind }) => {
        const host = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
        const tick = host?.querySelector<HTMLElement>(`[data-meter-tick="${kind}"]`)
        const track = host?.querySelector<HTMLElement>('[data-meter-track]')
        const caps = [
          ...(host?.querySelectorAll<HTMLElement>('[data-meter-captions] > span') ?? []),
        ]
        if (!host || !tick || !track) throw new Error(`LAYOUT: no ${kind} tick in ${id}`)
        const t = tick.getBoundingClientRect()
        const k = track.getBoundingClientRect()
        return {
          anchored: host.querySelector('[data-meter-captions]')?.hasAttribute('data-anchored'),
          tick: (t.left + t.right) / 2,
          track: [k.left, k.right],
          caps: caps.map((c) => {
            const r = c.getBoundingClientRect()
            const lh = Number.parseFloat(getComputedStyle(c).lineHeight) || r.height
            return {
              text: c.textContent,
              left: r.left,
              right: r.right,
              hidden: c.hasAttribute('data-hidden'),
              lines: Math.round(r.height / lh),
            }
          }),
        }
      },
      { id, kind },
    )
    expect(m.anchored).toBe(true)
    const cap = m.caps.find((c) => c.text?.includes(text))
    if (!cap) throw new Error(`LAYOUT: no ${text} caption in ${id}`)
    // The target's caption is centred on its tick. The forecast's ends at its fill end (Wave 38): this
    // one is too long to clear the reading there, so it drops (the existing priority) instead of wrapping.
    if (kind === 'boundary') {
      expect(cap.hidden).toBe(true)
    } else {
      expect(Math.abs((cap.left + cap.right) / 2 - m.tick)).toBeLessThanOrEqual(SNAP)
    }
    expect(cap.left).toBeGreaterThanOrEqual((m.track[0] ?? 0) - SUBPIXEL)
    expect(cap.right).toBeLessThanOrEqual((m.track[1] ?? 0) + SUBPIXEL)
    for (const c of m.caps) expect(c.lines).toBe(1)
  })

  test('categorical part captions sit under their own segment when they fit', async () => {
    const m = await p.raw.evaluate(() => {
      const host = document.querySelector<HTMLElement>('[data-testid="dash-w37-parts-wide"]')
      const list = host?.querySelector<HTMLElement>('[data-meter-parts]')
      const fills = [...(host?.querySelectorAll<HTMLElement>('[data-meter-fill]') ?? [])]
      if (!host || !list) throw new Error('LAYOUT: no part captions')
      return {
        anchored: list.hasAttribute('data-anchored'),
        fills: fills.map((f) => f.getBoundingClientRect().left),
        items: ([...list.children] as HTMLElement[]).map((li) => li.getBoundingClientRect().left),
      }
    })
    expect(m.anchored).toBe(true)
    for (const [i, left] of m.items.entries())
      expect(Math.abs(left - (m.fills[i] ?? 0))).toBeLessThanOrEqual(SNAP)
  })

  test('part captions that do not fit under their segments fall back to a list, none wrapped (390)', async () => {
    const m = await p.raw.evaluate(() => {
      const host = document.querySelector<HTMLElement>('[data-testid="dash-w37-parts-narrow"]')
      const list = host?.querySelector<HTMLElement>('[data-meter-parts]')
      if (!host || !list) throw new Error('LAYOUT: no part captions')
      return {
        anchored: list.hasAttribute('data-anchored'),
        overflow: host.scrollWidth > host.clientWidth,
        items: ([...list.children] as HTMLElement[]).map((li) => {
          const r = li.getBoundingClientRect()
          const lh = Number.parseFloat(getComputedStyle(li).lineHeight) || r.height
          return { text: li.textContent, lines: Math.round(r.height / lh) }
        }),
      }
    })
    expect(m.anchored).toBe(false)
    expect(m.overflow).toBe(false)
    expect(m.items.map((i) => i.text)).toContain('Mobility 4 sessions')
    for (const i of m.items) expect(i.lines).toBe(1)
  })

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
    expect(text).toBe('Target €2400 · €250\u00a0over')
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
