/**
 * Wave 38, the chart chrome: the `Sparkline` readout clears the plotted line and its siblings, an
 * hourly point reads as an hour, a bar tooltip stays under the card's headline, a compact y axis keeps
 * the top tick (and the unit on it), shade-only bars tell themselves apart, and a zero band is skipped.
 */
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Bars } from './Bars'
import { HOSTED, VisualSlotContext } from '../dashboard/visual-slot'
import { Sparkline } from './Sparkline'
import { StackedArea } from './StackedArea'
import { compileCartesian, yGuide } from './compile'
import type { ChartSeries } from './types'

const css = readFileSync(new URL('./sparkline.module.css', import.meta.url), 'utf8')
const rule = (selector: string): string =>
  css.match(new RegExp(`${selector}[^{]*\\{([^}]*)\\}`))?.[1] ?? ''

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})
async function mount(node: React.ReactNode): Promise<HTMLElement> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => {
    root?.render(node)
  })
  return el
}
const focusIn = async (el: HTMLElement): Promise<HTMLElement | null> => {
  await act(async () => {
    el.querySelector('svg')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  })
  return el.querySelector<HTMLElement>('[data-basalt-sparkline-readout]')
}
const text = (el: Element | null): string => el?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

const hostedBy = (node: React.ReactNode): React.ReactNode => (
  <VisualSlotContext.Provider value={HOSTED}>{node}</VisualSlotContext.Provider>
)

describe('the Sparkline readout is off the line in a host that reserves a line (item 1)', () => {
  test('it slides with the point: the same fraction as left and as the self-offset', async () => {
    const el = await mount(hostedBy(<Sparkline ariaLabel="S" height={30} data={[1, 5, 2, 4, 3]} />))
    const style = (await focusIn(el))?.style
    // The focused point is the last, near the right edge: the chip's own width offsets it by the same share.
    const left = Number.parseFloat(style?.left ?? '')
    expect(left).toBeGreaterThan(90)
    expect(style?.translate).toBe(`${-left}% 0`)
  })
  test('hosted (StatCard slot, strip visual): no inline top or bottom, the host attribute is set', async () => {
    for (const data of [
      [1, 2, 3],
      [3, 2, 1],
    ]) {
      const el = await mount(hostedBy(<Sparkline ariaLabel="S" height={30} data={data} />))
      const style = (await focusIn(el))?.style
      expect(style?.top).toBe('')
      expect(style?.bottom).toBe('')
      expect(el.querySelector('[data-basalt-sparkline]')?.hasAttribute('data-basalt-hosted')).toBe(
        true,
      )
      act(() => root?.unmount())
      document.body.innerHTML = ''
    }
  })
  test('bare: the chip stays inside its own box, beside the point, on the half away from it', async () => {
    const high = await mount(<Sparkline ariaLabel="S" height={48} data={[1, 2, 3]} />)
    const chip = await focusIn(high)
    expect(chip?.style.bottom).toBe('0px')
    expect(chip?.style.right).toMatch(/%/)
    expect(high.querySelector('[data-basalt-sparkline]')?.hasAttribute('data-basalt-hosted')).toBe(
      false,
    )
  })
  test('the lift is the hosted rule alone, with an opt-out', () => {
    const base = rule('\\.readout').replace(/\s+/g, ' ')
    expect(base).not.toContain('top:')
    expect(base).toContain('max-height: 100%')
    const hosted = css.match(/\[data-basalt-hosted\] \.readout\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(hosted.replace(/\s+/g, ' ')).toContain(
      'top: calc( var(--basalt-spark-readout-lift, 1) * -1 *',
    )
  })
  test('a hosted bar sparkline reads out the same way', async () => {
    const el = await mount(
      hostedBy(<Sparkline ariaLabel="S" height={24} mark="bar" data={[2, 0, 3]} />),
    )
    expect((await focusIn(el))?.style.top).toBe('')
  })
})

describe('the Sparkline readout names an hour for hourly points (item 2)', () => {
  const HOUR = 3_600_000
  const hourly = (from: number, n: number): { at: number; value: number }[] =>
    Array.from({ length: n }, (_, i) => ({ at: from + i * HOUR, value: i % 3 }))
  const readoutOf = async (data: { at: number; value: number }[]): Promise<string> =>
    text(await focusIn(await mount(<Sparkline ariaLabel="S" height={24} mark="bar" data={data} />)))
  test('hourly points inside one day read as a clock time, with no day', async () => {
    const label = await readoutOf(hourly(Date.UTC(2026, 9, 15, 0), 24))
    expect(label).toMatch(/· 23[:.]00$/)
    expect(label).not.toMatch(/Oct/)
  })
  test('24 hourly points from 12:00 cross midnight: day with the hour, so no clock repeats bare', async () => {
    expect(await readoutOf(hourly(Date.UTC(2026, 9, 15, 12), 24))).toMatch(/Oct 16 11[:.]00$/)
  })
  test('25 points 12:00 to 12:00 read day and hour on both ends', async () => {
    const el = await mount(
      <Sparkline
        ariaLabel="S"
        height={24}
        mark="bar"
        data={hourly(Date.UTC(2026, 9, 15, 12), 25)}
      />,
    )
    // The last point is focused first; Home moves to the first.
    expect(text(await focusIn(el))).toMatch(/Oct 16 12[:.]00$/)
    await act(async () => {
      el.querySelector('[data-basalt-sparkline]')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
      )
    })
    expect(text(el.querySelector('[data-basalt-sparkline-readout]'))).toMatch(/Oct 15 12[:.]00$/)
  })
  test('daily points still read as a day', async () => {
    const data = Array.from({ length: 5 }, (_, i) => ({
      at: Date.UTC(2026, 9, 15, 12) + i * 24 * HOUR,
      value: i,
    }))
    const el = await mount(<Sparkline ariaLabel="S" height={24} data={data} />)
    expect(text(await focusIn(el))).toMatch(/Oct 19$/)
  })
})

describe('the Sparkline readout clears a sibling end figure (item 3)', () => {
  test('bare, a 12 px Sparkline above a figure keeps the chip in its box; hosted, it takes the line above', async () => {
    const el = await mount(
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Sparkline ariaLabel="S" height={12} data={[40, 52, 48, 60, 100]} />
        <span data-end-figure="">100</span>
      </div>,
    )
    const chip = await focusIn(el)
    // The chip is capped to the box (`max-height: 100%`) and slid with the point, one line. Where it
    // sits in the box (off the line, never out of it) needs layout: `charts-w39-readout.layout`.
    expect(chip?.style.bottom).toBe('')
    expect(chip?.style.maxWidth).toBe('100%')
    expect(rule('\\.readout')).toContain('max-height: 100%')
  })
})

describe('a bar tooltip stays under the headline (item 4)', () => {
  type R = { x: string; v: number }
  const bar: ChartSeries<R> = {
    key: 'v',
    label: 'Days',
    color: 'red',
    getValue: (d) => d.v,
    mark: 'bar',
  }
  const line: ChartSeries<R> = { ...bar, mark: 'line' }
  type Anchor = (points: never, ctx: never) => { x: number; y: number }
  const anchorOf = (series: ChartSeries<R>): Anchor | 'group-center' | undefined => {
    const def = compileCartesian({
      chartId: 't',
      data: [{ x: 'a', v: 25 }],
      x: (d) => d.x,
      series: [series],
      marks: () => [],
      band: true,
    })
    const tip = def.tooltip as { anchor?: Anchor | 'group-center' } | false | undefined
    return tip === false ? undefined : tip?.anchor
  }
  const plot = { x: 0, y: 0, width: 300, height: 200 }
  test('a tall bar (point at the plot top) anchors lower and to the side, so its tooltip stays in the plot', () => {
    const anchor = anchorOf(bar)
    expect(typeof anchor).toBe('function')
    if (typeof anchor !== 'function') return
    const at = anchor([{ x: 50, y: 4 }] as never, { plot } as never)
    expect(at.y).toBeGreaterThanOrEqual(48)
    expect(at.y).toBeLessThanOrEqual(plot.height)
    // Beside the bar, towards the roomier side, so it does not sit on the bar's top.
    expect(at.x).toBeGreaterThan(50)
    expect(anchor([{ x: 250, y: 4 }] as never, { plot } as never).x).toBeLessThan(250)
    // At either end the anchor stays in the plot.
    expect(anchor([{ x: -20, y: 4 }] as never, { plot } as never).x).toBeGreaterThanOrEqual(0)
    expect(anchor([{ x: 330, y: 4 }] as never, { plot } as never).x).toBeLessThanOrEqual(300)
  })
  test('a short bar keeps its own height; a line chart keeps the group centre', () => {
    const anchor = anchorOf(bar)
    if (typeof anchor !== 'function') throw new Error('expected a function anchor')
    expect(anchor([{ x: 10, y: 180 }] as never, { plot } as never)).toEqual({ x: 10, y: 180 })
    expect(anchorOf(line)).toBe('group-center')
  })
})

describe('a compact y axis keeps the top tick of a fixed domain (item 5)', () => {
  const fmt = (v: number): string => (v === 25 ? '25 days' : String(v))
  const axis = { domain: [0, 25] as const, format: fmt }
  const ticksOf = (
    cls: 'compact' | 'regular',
    domain: readonly [number, number] | 'auto' | undefined,
  ) => {
    const guide = yGuide({
      cfg: { domain, format: fmt },
      axis: { ...axis, domain: domain === 'auto' || domain === undefined ? axis.domain : domain },
      cls,
      side: 'left',
      grid: true,
    })
    const ticks = typeof guide.axis === 'object' ? guide.axis.ticks : undefined
    return ticks && 'values' in ticks ? ticks.values : null
  }
  test('[0, 25] at compact ticks 0, 10, 20 and the end (the uneven last step is intended), so the unit on the top tick survives', () => {
    expect(ticksOf('compact', [0, 25])).toEqual([0, 10, 20, 25])
  })
  test('a domain that already ends on a tick, an auto domain and the regular ladder are untouched', () => {
    expect(ticksOf('compact', [0, 20])).toBeNull()
    expect(ticksOf('compact', 'auto')).toBeNull()
    expect(ticksOf('regular', [0, 25])).toBeNull()
  })
  test('an end that sits just above a tick is left (it would crowd the label)', () => {
    expect(ticksOf('compact', [0, 21])).toBeNull()
  })
})

describe('shade-only bars tell themselves apart (item 6)', () => {
  type Row = { t: Date; a: number; b: number; c: number }
  const data: Row[] = [1, 2, 3].map((d) => ({
    t: new Date(Date.UTC(2026, 8, d)),
    a: d,
    b: d,
    c: d,
  }))
  const bar = (key: 'a' | 'b' | 'c', color: string, fillOpacity?: number) => ({
    key,
    label: key.toUpperCase(),
    color,
    getValue: (d: Row) => d[key],
    ...(fillOpacity !== undefined && { fillOpacity }),
  })
  const swatches = async (node: React.ReactNode): Promise<string[]> => {
    const el = await mount(node)
    return [...el.querySelectorAll<HTMLElement>('[data-legend-key]')].map(
      (e) => e.querySelector<HTMLElement>('span[aria-hidden]')?.style.opacity ?? '',
    )
  }
  const chart = (bars: ReturnType<typeof bar>[]) => (
    <Bars ariaLabel="b" data={data} height={200} x={(d) => d.t} bars={bars} />
  )
  test('three bars of one colour step down from full strength', async () => {
    expect(await swatches(chart([bar('a', 'teal'), bar('b', 'teal'), bar('c', 'teal')]))).toEqual([
      '1',
      '0.7',
      '0.4',
    ])
  })
  test('a stack of same-colour bars draws the surface hairline, even with explicit shades; distinct colours do not', async () => {
    const strokes = async (bars: ReturnType<typeof bar>[]): Promise<number> => {
      const el = await mount(chart(bars))
      return [...el.querySelectorAll('g[data-ts-key^="bars"] rect')].filter(
        (r) => (r.getAttribute('stroke') ?? '') !== '' && r.getAttribute('stroke') !== 'none',
      ).length
    }
    expect(await strokes([bar('a', 'teal', 0.5), bar('b', 'teal', 0.9)])).toBeGreaterThan(0)
    expect(await strokes([bar('a', 'teal'), bar('b', 'red')])).toBe(0)
  })
  test('distinct colours, and an explicit fillOpacity, keep their shades', async () => {
    expect(await swatches(chart([bar('a', 'teal'), bar('b', 'red'), bar('c', 'blue')]))).toEqual([
      '0.85',
      '0.85',
      '0.85',
    ])
    expect(await swatches(chart([bar('a', 'teal', 0.5), bar('b', 'teal')]))).toEqual([
      '0.5',
      '0.85',
    ])
  })
})

describe('StackedArea skips a band of zeros (item 6)', () => {
  type Row = { t: Date; a: number | null; b: number | null }
  const data: Row[] = [1, 2, 3].map((d) => ({ t: new Date(Date.UTC(2026, 8, d)), a: d, b: 0 }))
  const keys = async (rows: Row[]): Promise<string[]> => {
    const el = await mount(
      <StackedArea
        ariaLabel="s"
        data={rows}
        height={200}
        x={(d) => d.t}
        series={[
          { key: 'a', label: 'A', color: 'teal', getValue: (d) => d.a },
          { key: 'b', label: 'B', color: 'red', getValue: (d) => d.b },
          { key: 'c', label: 'C', color: 'blue', getValue: (d) => (d.a ?? 0) + 1 },
        ]}
      />,
    )
    return [...el.querySelectorAll('[data-legend-key]')].map(
      (e) => e.getAttribute('data-legend-key') ?? '',
    )
  }
  test('an all-zero band has no legend entry; a band with a value, or only nulls, stays', async () => {
    expect(await keys(data)).toEqual(['a', 'c'])
    expect(await keys(data.map((d) => ({ ...d, b: null })))).toEqual(['a', 'b', 'c'])
    expect(await keys(data.map((d, i) => ({ ...d, b: i === 1 ? 2 : 0 })))).toEqual(['a', 'b', 'c'])
  })
})
