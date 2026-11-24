/**
 * `IntervalTrack` (Issue 2306): rows of spans on one x axis. The track is one tab stop whose arrow
 * keys step along a row and across rows; a pointer or a key focuses a span, lifts it alone (no veil
 * over the rest) and drives the readout; a `DataTable` on the same focus links both ways; lanes take overlaps; a `back`
 * series takes no lane; and the phase draws the placeholder instead of the plot.
 */
import { fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { act, useEffect } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { col } from '../../table/core/kinds'
import { DataTable } from '../../table/parts/data-table'
import { useDataTable } from '../../table/use-data-table'
import { useChartFocus } from '../focus'
import type { ChartFocus } from '../focus'
import { IntervalTrack, stepTrack } from './interval-track'
import type { IntervalSeries } from './interval-track'

type Span = {
  id: string
  day: string
  start: number
  end: number | null
  title: string
  kind: 'meeting' | 'free'
}
const SPANS: readonly Span[] = [
  { id: 'a', day: 'Mon', start: 540, end: 600, title: 'Standup', kind: 'meeting' },
  { id: 'b', day: 'Mon', start: 570, end: 660, title: 'Design review', kind: 'meeting' },
  { id: 'c', day: 'Mon', start: 720, end: null, title: 'Deploy', kind: 'meeting' },
  { id: 'd', day: 'Tue', start: 600, end: 720, title: 'Planning', kind: 'meeting' },
  { id: 'e', day: 'Tue', start: 720, end: 1020, title: '5 h free', kind: 'free' },
]
const SERIES: readonly IntervalSeries<Span['kind']>[] = [
  { key: 'meeting', label: 'Meeting', color: { light: '#2871c7', dark: '#5190f7' } },
  {
    key: 'free',
    label: 'Free',
    color: { light: '#0077bd', dark: '#5fb4f0' },
    fill: 'outline',
    layer: 'back',
  },
]

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

const readout = (el: HTMLElement) => el.querySelector('[data-readout]')?.textContent
const live = (el: HTMLElement) => el.querySelector('[data-chart-focus-live]')?.textContent
const press = (target: Element, key: string) =>
  act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
const bodyRows = (el: HTMLElement) => [
  ...el.querySelectorAll<HTMLElement>('[data-slot="table-body"] [role="row"]'),
]
/** The spans drawn under a dimming veil: the track draws none (Issue 2451). */
const dimmed = (el: HTMLElement) => el.querySelectorAll('rect[data-ts-key^="dim"]').length
/** The lifted (focused) span's overlay. */
const lifted = (el: HTMLElement) => [...el.querySelectorAll('rect[data-ts-key^="lift"]')]
/** Every span's and every label's paint, in drawing order. */
const paint = (el: HTMLElement) =>
  [...el.querySelectorAll('rect[data-ts-key^="span:"], text[data-ts-key^="labels:"]')].map((n) =>
    ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity']
      .map((a) => n.getAttribute(a))
      .join('|'),
  )
const pointAt = (el: HTMLElement, x: number) =>
  act(async () => {
    el.querySelector('svg')?.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: x,
        clientY: 30,
        pointerType: 'mouse',
      }),
    )
  })

let handle: ChartFocus<Span> | undefined
const c = col<Span>()

function Week({ phase }: { phase?: 'loading' }) {
  const focus = useChartFocus(SPANS, { announce: (s) => `${s.day} ${s.title}` })
  useEffect(() => {
    handle = focus
  })
  const table = useDataTable<Span>({
    id: 'spans',
    label: 'Spans',
    columns: [c.entity('title', { header: 'Span' })],
    data: SPANS,
    getRowId: (s) => s.id,
    mode: { kind: 'client' },
  })
  return (
    <div>
      <output data-readout="">{focus.readout('the week', (s) => s.title)}</output>
      <IntervalTrack
        label="The week"
        data={SPANS}
        rows={['Mon', 'Tue', 'Wed']}
        getRow={(s) => s.day}
        getStart={(s) => s.start}
        getEnd={(s) => s.end}
        series={SERIES}
        getSeries={(s) => s.kind}
        getLabel={(s) => s.title}
        xDomain={[540, 1080]}
        focus={focus}
        {...(phase !== undefined && { phase })}
      />
      <DataTable table={table} focus={focus} />
    </div>
  )
}

describe('IntervalTrack focus', () => {
  test('the track is one tab stop; at rest nothing lifts or dims', async () => {
    const el = await mount(<Week />)
    const stops = el.querySelectorAll('[data-chart-focus][tabindex="0"]')
    expect(stops.length).toBe(1)
    expect(readout(el)).toBe('the week')
    expect(dimmed(el)).toBe(0)
    expect(lifted(el).length).toBe(0)
  })

  test('arrow keys step along a row and across rows, lift the span and drive the readout', async () => {
    const el = await mount(<Week />)
    const wrap = el.querySelector('[data-chart-focus]') as Element
    await press(wrap, 'ArrowRight')
    expect(readout(el)).toBe('Standup')
    await press(wrap, 'ArrowRight')
    expect(readout(el)).toBe('Design review')
    await press(wrap, 'ArrowDown')
    expect(readout(el)).toBe('Planning')
    expect(live(el)).toBe('Tue Planning')
    expect(lifted(el).length).toBe(1)
    expect(dimmed(el)).toBe(0)
    await press(wrap, 'Escape')
    expect(readout(el)).toBe('the week')
  })

  test('a span focused on the track marks its table row, and a table row focuses its span', async () => {
    const el = await mount(<Week />)
    await act(async () => handle?.set(3))
    const rows = bodyRows(el)
    expect(rows[3]?.hasAttribute('data-focused')).toBe(true)
    expect(rows[0]?.hasAttribute('data-dimmed')).toBe(true)
    await act(async () => fireEvent.pointerEnter(rows[1] as Element))
    expect(readout(el)).toBe('Design review')
    expect(lifted(el).length).toBe(1)
  })
})

describe('IntervalTrack pointer', () => {
  test('a hover changes paint on the hovered span only: it lifts, every other span and label keeps its paint', async () => {
    const el = await mount(<Week />)
    const rest = paint(el)
    await pointAt(el, 120)
    expect(readout(el)).toBe('Standup')
    expect(paint(el)).toEqual(rest)
    expect(dimmed(el)).toBe(0)
    const [lift] = lifted(el)
    const standup = el.querySelector('rect[data-ts-key^="span:meeting"][data-ts-key$=":0"]')
    expect(lifted(el).length).toBe(1)
    expect(lift?.getAttribute('x')).toBe(standup?.getAttribute('x') ?? null)
    expect(lift?.getAttribute('width')).toBe(standup?.getAttribute('width') ?? null)
  })

  test('pointing at a span focuses it and the track settles (no update loop)', async () => {
    const el = await mount(<Week />)
    const svg = el.querySelector('svg') as Element
    const move = (x: number) =>
      act(async () => {
        svg.dispatchEvent(
          new PointerEvent('pointermove', {
            bubbles: true,
            clientX: x,
            clientY: 30,
            pointerType: 'mouse',
          }),
        )
      })
    await move(120)
    const first = readout(el)
    await move(300)
    await move(500)
    expect(first).toBe('Standup')
    expect(el.querySelectorAll('[data-basalt-chart]').length).toBe(1)
  })
})

const spanFills = (el: HTMLElement) =>
  [...el.querySelectorAll('rect[data-ts-key^="span:meeting"]')].map((r) => r.getAttribute('fill'))

describe('IntervalTrack color', () => {
  const brand = 'var(--basalt-brand)'
  test('a one-series track paints neutral at rest, no brand; the accent is the focused span', async () => {
    const el = await mount(<Week />)
    const all = [...el.querySelectorAll('rect')].map(
      (r) => `${r.getAttribute('fill')} ${r.getAttribute('stroke')}`,
    )
    expect(all.some((p) => p.includes(brand))).toBe(false)
    expect(spanFills(el).every((f) => f?.includes('var(--basalt-line)'))).toBe(true)
    expect(spanFills(el).some((f) => f?.includes('#2871c7'))).toBe(false)
    await pointAt(el, 120)
    expect(lifted(el)[0]?.getAttribute('stroke')).toBe(brand)
  })

  test('with two lane series, color names the category as a tint of the series color', async () => {
    const two: readonly IntervalSeries<Span['kind']>[] = [
      SERIES[0] as IntervalSeries<Span['kind']>,
      { key: 'free', label: 'Free', color: { light: '#4a4a4a', dark: '#c4c4c4' } },
    ]
    const el = await mount(
      <IntervalTrack
        label="Two"
        data={SPANS}
        getRow={(s) => s.day}
        getStart={(s) => s.start}
        getEnd={(s) => s.end}
        series={two}
        getSeries={(s) => s.kind}
        xDomain={[540, 1080]}
      />,
    )
    const fills = spanFills(el)
    expect(fills.length).toBeGreaterThan(0)
    expect(fills.every((f) => f?.includes('#2871c7') && f.includes('var(--basalt-card)'))).toBe(
      true,
    )
  })
})

describe('IntervalTrack marks', () => {
  test('overlaps take a second lane, a back span takes none, a point draws, an empty row still has a label', async () => {
    const el = await mount(<Week />)
    const spans = [...el.querySelectorAll('rect[data-ts-key^="span:"]')]
    // Five data, five rects (the free span on the back layer included).
    expect(spans.length).toBe(5)
    const ticks = [...el.querySelectorAll('text')].map((t) => t.textContent)
    expect(ticks).toContain('Wed')
  })

  test('a loading phase draws the placeholder and no plot', async () => {
    const el = await mount(<Week phase="loading" />)
    expect(el.querySelector('rect[data-ts-key^="span:"]')).toBeNull()
    expect(el.querySelector('[data-chart-focus]')).toBeNull()
  })
})

const at = (d: string): number => ['a', 'b', 'c', 'e'].indexOf(d)

describe('stepTrack', () => {
  const items = [
    { d: 'a', row: 0, start: 0 },
    { d: 'b', row: 0, start: 30 },
    { d: 'c', row: 1, start: 25 },
    { d: 'e', row: 2, start: 90 },
  ]
  test('Left and Right stay in the row and stop at its end', () => {
    expect(stepTrack(items, 'ArrowRight', 'a', at)).toBe(at('b'))
    expect(stepTrack(items, 'ArrowRight', 'b', at)).toBe(at('b'))
    expect(stepTrack(items, 'ArrowLeft', 'a', at)).toBe(at('a'))
  })
  test('Up and Down land on the nearest start in the next row with spans', () => {
    expect(stepTrack(items, 'ArrowDown', 'b', at)).toBe(at('c'))
    expect(stepTrack(items, 'ArrowDown', 'c', at)).toBe(at('e'))
    expect(stepTrack(items, 'ArrowUp', 'c', at)).toBe(at('b'))
    expect(stepTrack(items, 'ArrowDown', 'e', at)).toBe(at('e'))
  })
  test('enters at the first or the last span, Escape clears, other keys are not ours', () => {
    expect(stepTrack(items, 'ArrowRight', undefined, at)).toBe(at('a'))
    expect(stepTrack(items, 'End', 'a', at)).toBe(at('e'))
    expect(stepTrack(items, 'Escape', 'a', at)).toBeNull()
    expect(stepTrack(items, 'Tab', 'a', at)).toBeUndefined()
  })
})
