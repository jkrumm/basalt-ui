/**
 * Wave 37 round r2, the chart half: the `Sparkline` readout names its point and sits inside its
 * own box, a bar sparkline reads out too, a `Bars` hover is bar chrome only, a reference caption
 * clears a bar, ticks and header share one locale, and an errored card is compact.
 */
import { render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { defineFormat } from '../format'
import { resetFormatDefaults } from '../format/shared'
import { Bars } from './Bars'
import { ChartCard } from './ChartCard'
import { Sparkline } from './Sparkline'
import { compileCartesian, utcHeaderDate } from './compile'
import { dateTickFormat, utcAxisDate } from './date-tick-format'
import type { ChartSeries } from './types'

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
  resetFormatDefaults()
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
const ssr = (node: React.ReactNode): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(node)
  return el
}

const utc = (d: number, h = 0): number => Date.UTC(2026, 9, d, h)
const intl = (locale: string, opts: Intl.DateTimeFormatOptions, at: number | Date): string =>
  new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...opts }).format(at)

describe('Sparkline names its point (item 1)', () => {
  test('{ at, value } data: the readout reads the value, then the day in the page locale', async () => {
    defineFormat({ locale: 'en-GB' })
    const el = await mount(
      <Sparkline
        ariaLabel="S"
        height={30}
        data={[
          { at: utc(10), value: 1 },
          { at: utc(11), value: 2 },
          { at: new Date(utc(12)), value: 3 },
        ]}
        format={(v) => `${v} items`}
      />,
    )
    const day = intl('en-GB', { day: 'numeric', month: 'short' }, utc(12))
    expect(text(await focusIn(el))).toBe(`3 items · ${day}`)
  })
  test('points inside one day read their hour', async () => {
    defineFormat({ locale: 'en-GB' })
    const el = await mount(
      <Sparkline
        ariaLabel="S"
        height={30}
        data={[10, 11, 12].map((h) => ({ at: utc(12, h), value: h }))}
      />,
    )
    const clock = intl(
      'en-GB',
      { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
      utc(12, 12),
    )
    expect(text(await focusIn(el))).toBe(`12 · ${clock}`)
  })
  test('explicit labels still win over the derived moment', async () => {
    const el = await mount(
      <Sparkline
        ariaLabel="S"
        height={30}
        data={[{ at: utc(10), value: 1 }]}
        labels={['custom']}
      />,
    )
    expect(text(await focusIn(el))).toBe('1 · custom')
  })
  test('a bar sparkline answers focus with a readout too', async () => {
    const el = await mount(<Sparkline ariaLabel="S" height={30} mark="bar" data={[0, 2, 0, 3]} />)
    expect(text(await focusIn(el))).toBe('3')
  })
})

// Wave 38 moved the chip above the plot, into the line hosts reserve (the W37 in-box placement sat on
// the plotted line); the placement tests live in `w38-chart-chrome.test.tsx`.
describe('the Sparkline readout names its point (item 1)', () => {
  test('a high last point and a low one both read out', async () => {
    for (const data of [
      [1, 2, 3],
      [3, 2, 1],
    ]) {
      const el = await mount(<Sparkline ariaLabel="S" height={30} data={data} />)
      expect(await focusIn(el)).not.toBeNull()
    }
  })
})

describe('a Bars hover is bar chrome only (item 2)', () => {
  type R = { t: Date; v: number }
  const s: ChartSeries<R> = { key: 'v', label: 'V', color: 'red', getValue: (d) => d.v }
  const data: R[] = [1, 2, 3].map((d) => ({ t: new Date(utc(d)), v: d }))
  test('the compiled definition can drop the engine focus ring (definition only; the rendered hover is pinned in the layout suite)', () => {
    const def = compileCartesian({
      chartId: 'f',
      data,
      x: (d) => d.t,
      series: [s],
      marks: () => [],
      focusRing: false,
    })
    expect(def.focusRing).toBe(false)
    const plain = compileCartesian({
      chartId: 'f',
      data,
      x: (d) => d.t,
      series: [s],
      marks: () => [],
    })
    expect(plain.focusRing).toBeUndefined()
  })
})

describe('a reference caption never sits on a bar (item 3)', () => {
  type R = { m: string; v: number }
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
  const render = (values: number[]): HTMLElement =>
    ssr(
      <Bars
        ariaLabel="B"
        height={240}
        data={months.map((m, i) => ({ m, v: values[i] as number }))}
        x={(d: R) => d.m}
        y={{ domain: [0, 80] }}
        bars={[{ key: 'v', label: 'V', color: 'red', getValue: (d: R) => d.v }]}
        refLines={[{ value: 25, color: 'blue', dashed: true, label: 'Goal 25' }]}
      />,
    )
  const anchorOf = (el: HTMLElement): string | null =>
    el.querySelector('g[data-ts-key="ref-0-label"] text')?.getAttribute('text-anchor') ?? null
  test('a tall last bar under the line end moves the caption to the start', () => {
    expect(anchorOf(render([10, 10, 10, 10, 10, 60]))).toBe('start')
  })
  test('a low last bar keeps the caption at the end', () => {
    expect(anchorOf(render([10, 10, 10, 10, 10, 12]))).toBe('end')
  })
})

describe('one date locale for ticks and tooltip header (item 4)', () => {
  const at = new Date(utc(4))
  test.each(['en-US', 'en-GB', 'de-DE'])('configured %s: both come from that locale', (locale) => {
    defineFormat({ locale })
    expect(utcAxisDate(at)).toBe(intl(locale, { day: 'numeric', month: 'short' }, at))
    expect(utcHeaderDate(at)).toBe(
      intl(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }, at),
    )
    // The header carries the tick's own text, in the same order.
    expect(utcHeaderDate(at)).toContain(utcAxisDate(at))
  })
  test('with no locale configured both read the runtime locale, and still agree', () => {
    const runtime = (opts: Intl.DateTimeFormatOptions): string =>
      new Intl.DateTimeFormat(undefined, { timeZone: 'UTC', ...opts }).format(at)
    expect(utcAxisDate(at)).toBe(runtime({ day: 'numeric', month: 'short' }))
    expect(utcHeaderDate(at)).toContain(utcAxisDate(at))
  })
  test('a tick set labels through the same locale', () => {
    defineFormat({ locale: 'en-US' })
    const ticks = [4, 5, 6].map((d) => new Date(utc(d)))
    expect(dateTickFormat(ticks)(ticks[1] as Date)).toBe(
      intl('en-US', { day: 'numeric', month: 'short' }, ticks[1] as Date),
    )
  })
})

describe('the errored ChartCard anatomy is top-aligned (item 6)', () => {
  test('dot, title, message and Retry start at the top of the body, never centred in it', () => {
    const { container } = render(
      <ChartCard title="T" state={{ error: new Error('boom') }} onRetry={() => {}} />,
    )
    const body = container.querySelector<HTMLElement>('[data-basalt-chart-state="error"]')
    expect(body?.style.justifyContent).toBe('flex-start')
  })
})

describe('Bars tooltip rows name their own series and carry the unit (item 7)', () => {
  type Bin = { label: string; days: number; median: boolean }
  const bins: Bin[] = [
    { label: '€70–80', days: 23, median: true },
    { label: '€80–90', days: 9, median: false },
  ]
  const tooltipRows = (index: number) => {
    const def = compileCartesian({
      chartId: 'h',
      data: bins,
      x: (d: Bin) => d.label,
      band: true,
      marks: () => [],
      series: [
        {
          key: 'days',
          label: 'Days',
          color: 'gray',
          getValue: (d: Bin) => (d.median ? null : d.days),
          formatValue: (v: number) => `${v} days`,
        },
        {
          key: 'median',
          label: 'Median day',
          color: 'black',
          getValue: (d: Bin) => (d.median ? d.days : null),
          formatValue: (v: number) => `${v} days`,
        },
      ],
    })
    const tooltip = def.tooltip
    if (!tooltip || !('content' in tooltip) || !tooltip.content) throw new Error('no tooltip')
    const datum = bins[index]
    return tooltip.content(
      [{ datum: { x: datum?.label, y: 0, series: 'days', datum }, xValue: datum?.label } as never],
      {} as never,
    ).rows
  }
  test('the median bin lists the median series alone, with its unit', () => {
    expect(tooltipRows(0).map((r) => [r.label, r.value])).toEqual([['Median day', '23 days']])
  })
  test('another bin lists the days series alone', () => {
    expect(tooltipRows(1).map((r) => [r.label, r.value])).toEqual([['Days', '9 days']])
  })
})
