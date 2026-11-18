/**
 * Expression cycle 10 kit fixes (`v3-expr-10-kit-fixes` 7, 8, 9, 11): a zone on a band axis covers
 * whole bands, a focused empty bin keeps a mark, a clamped bar shows its true value, and a held
 * span reaches the end of its last item.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act, useEffect } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { Series } from './contract'
import { xScaleFor, xZoneFractions } from './core/scales'
import { useChartFocus } from './focus'
import type { ChartFocus } from './focus'
import { Bars } from './parts/bars'
import { CartesianChart } from './parts/cartesian'
import { HOSTED, VisualSlotContext } from './visual-slot'

const COLOR = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})
async function mount(node: ReactElement): Promise<HTMLElement> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => root?.render(node))
  await act(async () => new Promise((r) => setTimeout(r, 20)))
  return el
}

describe('a zone on a band axis covers whole bands (7)', () => {
  const n = 5
  // Five bands of one fifth, the first starting a tenth of a step in: bands 1 to 3 span 1/5 to 4/5.
  const WHOLE = [1 / n, 4 / n]
  const fill = 'var(--basalt-bad)'
  const keys = {
    string: ['a', 'b', 'c', 'd', 'e'],
    number: [10, 11, 12, 13, 14],
    date: [10, 11, 12, 13, 14].map((d) => new Date(Date.UTC(2026, 0, d))),
  }

  test.each(['string', 'number', 'date'] as const)(
    '%s keys: from the first to the last key',
    (kind) => {
      const k = keys[kind] as (string | number | Date)[]
      const model = xScaleFor<string | number | Date>(k, true)
      const f = xZoneFractions({ from: k[1], to: k[3], fill }, model)
      expect(f?.[0]).toBeCloseTo(WHOLE[0] as number, 10)
      expect(f?.[1]).toBeCloseTo(WHOLE[1] as number, 10)
    },
  )

  test('a zone on one key draws its band, where it drew nothing', () => {
    for (const kind of ['number', 'date'] as const) {
      const k = keys[kind] as (number | Date)[]
      const f = xZoneFractions({ from: k[2], to: k[2], fill }, xScaleFor<number | Date>(k, true))
      expect(f).not.toBeNull()
      expect((f?.[1] ?? 0) - (f?.[0] ?? 0)).toBeCloseTo(1 / n, 10)
    }
  })

  test('a Date between two bands snaps inward to the bands inside the zone', () => {
    const k = keys.date
    const noon = (d: number) => new Date(Date.UTC(2026, 0, d, 12))
    const f = xZoneFractions({ from: noon(10), to: noon(13), fill }, xScaleFor<Date>(k, true))
    expect(f?.[0]).toBeCloseTo(1 / n, 10)
    expect(f?.[1]).toBeCloseTo(4 / n, 10)
    // A window that holds no band covers none.
    expect(
      xZoneFractions({ from: noon(10), to: noon(10), fill }, xScaleFor<Date>(k, true)),
    ).toBeNull()
  })

  test('a continuous axis keeps its exact bounds', () => {
    const k = keys.date
    const f = xZoneFractions({ from: k[1], to: k[3], fill }, xScaleFor<Date>(k, false))
    expect(f).toEqual([0.25, 0.75])
  })

  test('a Bars chart with Date keys draws a one-key zone', () => {
    const data = keys.date.map((t, i) => ({ t, v: i + 1 }))
    const html = renderToString(
      <Bars
        label="V"
        data={data}
        x={{ value: (d) => d.t }}
        zones={[{ axis: 'x', from: keys.date[2] as Date, to: keys.date[2] as Date, fill }]}
        series={[{ mark: 'bar', key: 'v', label: 'V', color: COLOR, y: (d) => d.v }]}
      />,
    )
    expect(html).toContain('data-ts-key="xzone-0"')
  })
})

describe('a focused empty bin keeps a mark (8)', () => {
  type Hour = { h: string; a: number; b: number }
  const HOURS: readonly Hour[] = [
    { h: '00', a: 2, b: 1 },
    { h: '01', a: 0, b: 0 },
    { h: '02', a: 3, b: 2 },
  ]
  let handle: ChartFocus<Hour> | undefined
  function Slot() {
    const focus = useChartFocus(HOURS, { announce: (d) => d.h })
    useEffect(() => {
      handle = focus
    })
    return (
      <VisualSlotContext.Provider value={HOSTED}>
        <Bars<Hour>
          label="Hours"
          data={HOURS}
          x={{ value: (d) => d.h }}
          layout="stacked"
          focus={focus}
          tooltip={false}
          series={[
            { mark: 'bar', key: 'a', label: 'A', color: COLOR, y: (d) => d.a },
            { mark: 'bar', key: 'b', label: 'B', color: COLOR, y: (d) => d.b },
          ]}
        />
      </VisualSlotContext.Provider>
    )
  }
  const lit = (el: HTMLElement) => el.querySelector('[data-ts-key="empty-bins:focused"]')

  test('the stack of zeros the focus holds is lit, and none is before', async () => {
    const el = await mount(<Slot />)
    expect(lit(el)).toBeNull()
    await act(async () => handle?.set(1))
    expect(lit(el)).not.toBeNull()
    expect(el.querySelector('[data-ts-key="empty-bins"]')).toBeNull()
  })

  test('a focus on a bin with bars lights no tick, and the empty bin stays hover-only', async () => {
    const el = await mount(<Slot />)
    await act(async () => handle?.set(0))
    expect(lit(el)).toBeNull()
    expect(el.querySelector('[data-ts-key="empty-bins"]')).not.toBeNull()
  })
})

describe('a clamped bar shows its true value (9)', () => {
  type Row = { k: string; a: number }
  const rows = (n: number): Row[] =>
    Array.from({ length: n }, (_, i) => ({ k: 'k' + i, a: i === 1 ? 35 : 3 }))
  type BarSeries = Extract<Series<Row>, { mark: 'bar' }>
  const bar = (extra: Partial<BarSeries> = {}): BarSeries => ({
    mark: 'bar',
    key: 'a',
    label: 'A',
    color: COLOR,
    y: (d) => d.a,
    ...extra,
  })
  const texts = (html: string, id: string): string[] =>
    [...html.matchAll(/<text data-ts-key="([^"]*)"[^>]*>([^<]*)<\/text>/g)].flatMap((m) =>
      m[1]?.startsWith(id) ? [m[2] ?? ''] : [],
    )
  const render = (n: number, series: BarSeries[]): string =>
    renderToString(
      <Bars<Row>
        label="V"
        data={rows(n)}
        x={{ value: (d) => d.k }}
        y={{ domain: [0, 20] }}
        layout="grouped"
        series={series}
      />,
    )

  test('a bar without value labels carries its true value beside the caret', () => {
    const html = render(3, [bar()])
    expect(texts(html, 'off-scale-a-top')).toEqual(['▲'])
    expect(texts(html, 'off-scale-a-value')).toEqual(['35'])
  })

  test('a bar whose own label landed is not written twice', () => {
    const html = render(3, [bar({ values: true })])
    expect(texts(html, 'bar-values-y')).toContain('35')
    expect(texts(html, 'off-scale-a-value')).toEqual([])
  })

  test('a bar whose own label found no room still shows its value', () => {
    const html = render(40, [
      bar({ values: (v) => (v > 20 ? `${v} ${'millimetres '.repeat(20)}` : '') }),
    ])
    expect(texts(html, 'bar-values-y')).not.toContain(`35 ${'millimetres '.repeat(20)}`)
    expect(texts(html, 'off-scale-a-value')).toEqual(['35'])
  })
})

describe('a held span reaches the end of its last item (11)', () => {
  type Hour = { t: Date; v: number }
  const HOUR = 3_600_000
  const START = Date.UTC(2026, 0, 10)
  const HOURS: readonly Hour[] = Array.from({ length: 12 }, (_, i) => ({
    t: new Date(START + i * HOUR),
    v: 1 + (i % 4),
  }))
  let handle: ChartFocus<Hour> | undefined
  const series = [
    { key: 'v', label: 'V', color: COLOR, mark: 'line' as const, y: (d: Hour) => d.v },
  ]

  function Held({ extra }: { extra?: { from: Date; to: Date } }) {
    const focus = useChartFocus(HOURS, { announce: (d) => String(d.v) })
    useEffect(() => {
      handle = focus
    })
    return (
      <CartesianChart
        label="Hours"
        data={HOURS}
        x={{ value: (d) => d.t }}
        series={series}
        cursor="expr10-held"
        focus={focus}
        {...(extra !== undefined && {
          zones: [{ axis: 'x', from: extra.from, to: extra.to, fill: 'var(--basalt-selected)' }],
        })}
      />
    )
  }
  const band = (el: HTMLElement) => el.querySelector('[data-ts-key="xzone-0"]')?.outerHTML

  test('the band runs one step past the last held hour, as the same zone does', async () => {
    const held = await mount(<Held />)
    await act(async () => handle?.hold([2, 3, 4, 5]))
    const drawn = band(held)
    expect(drawn).toBeDefined()
    act(() => root?.unmount())
    document.body.innerHTML = ''
    const fixed = await mount(
      <Held extra={{ from: HOURS[2]?.t as Date, to: new Date(START + 6 * HOUR) }} />,
    )
    expect(band(fixed)).toBe(drawn as string)
    // And it is not the band that stops at the last hour's start.
    act(() => root?.unmount())
    document.body.innerHTML = ''
    const short = await mount(
      <Held extra={{ from: HOURS[2]?.t as Date, to: HOURS[5]?.t as Date }} />,
    )
    expect(band(short)).not.toBe(drawn as string)
  })

  test('readout hands the held span to `read`', async () => {
    await mount(<Held />)
    const read = (d: Hour, span: readonly Hour[]) => `${d.v}:${span.length}`
    const total = 'total'
    // `read` takes the span as a second argument (not yet in the contract's type).
    type SpanReadout = (rest: string, read: (d: Hour, span: readonly Hour[]) => string) => string
    const readout = (rest: string): string => {
      const call = handle?.readout as unknown as SpanReadout | undefined
      return call === undefined ? '' : call(rest, read)
    }
    expect(readout(total)).toBe(total)
    await act(async () => handle?.hold([2, 3, 4, 5]))
    expect(readout(total)).toBe('3:4')
    await act(async () => handle?.set(7))
    expect(readout(total)).toBe('4:1')
  })
})
