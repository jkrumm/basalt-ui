/**
 * The chart kit fixes of expression cycle 4 (`v3-expr-4-kit-fixes`) a happy-dom page can show:
 * arrow order, group announcements, tooltips at a gap and the money delta. The geometry ones live
 * in `tests/layout/charts-expr4.layout.test.ts`.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { rect } from '@tanstack/charts/rect'
import { compileCartesian } from './core/compile'
import { useChartFocus } from './focus'
import type { ChartSeries } from './types'
import { CartesianChart } from './parts/cartesian'

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
const press = (target: Element, key: string) =>
  act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })

const COLOR = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }

type Pt = { name: string; x: number; y: number }
/** Sorted by descending x: the data order is not the x order. */
const DESCENDING: readonly Pt[] = [
  { name: 'c', x: 30, y: 3 },
  { name: 'b', x: 20, y: 2 },
  { name: 'a', x: 10, y: 1 },
]

function Scatter({ data }: { data: readonly Pt[] }) {
  const focus = useChartFocus(data, { announce: (d) => d.name })
  return (
    <div>
      <output data-readout="">{focus.readout('none', (d) => d.name)}</output>
      <CartesianChart<Pt>
        label="Scatter"
        data={data}
        x={{ value: (d) => d.x }}
        series={[{ key: 'y', label: 'Y', color: COLOR, mark: 'dot', y: (d) => d.y }]}
        cursor="expr4-scatter"
        focus={focus}
      />
    </div>
  )
}

describe('arrow order', () => {
  test('ArrowRight steps through a chart whose data is sorted by descending x', async () => {
    const el = await mount(<Scatter data={DESCENDING} />)
    const wrap = el.querySelector('[data-chart-focus]') as Element
    const seen: (string | null | undefined)[] = []
    for (let i = 0; i < 3; i++) {
      await press(wrap, 'ArrowRight')
      seen.push(readout(el))
    }
    expect(seen).toEqual(['a', 'b', 'c'])
    await press(wrap, 'ArrowLeft')
    expect(readout(el)).toBe('b')
  })
})

type Sample = { id: string; at: string }
const SAMPLES: readonly Sample[] = [
  { id: 'skip-0', at: 'Mon 14:00' },
  { id: 'skip-0', at: 'Mon 15:00' },
  { id: 'skip-1', at: 'Tue 09:00' },
]

describe('group announcements', () => {
  test('a group is announced by its first item, never by its key', async () => {
    function Probe() {
      const focus = useChartFocus(SAMPLES, { announce: (s) => s.at, group: (s) => s.id })
      return (
        <div>
          {focus.live}
          <button type="button" data-set="1" aria-label="set 1" onClick={() => focus.set(1)} />
          <button type="button" data-set="0" aria-label="set 0" onClick={() => focus.set(0)} />
          <button type="button" data-set="2" aria-label="set 2" onClick={() => focus.set(2)} />
          <button type="button" data-clear="" aria-label="clear" onClick={() => focus.set(null)} />
        </div>
      )
    }
    const el = await mount(<Probe />)
    const click = (sel: string) =>
      act(async () =>
        (el.querySelector(sel) as HTMLElement).dispatchEvent(
          new MouseEvent('click', { bubbles: true }),
        ),
      )
    const said = () => el.querySelector('[data-chart-focus-live]')?.textContent
    await click('[data-set="0"]')
    expect(said()).toBe('Mon 14:00')
    await click('[data-clear]')
    await click('[data-set="1"]')
    expect(said()).toBe('Mon 14:00: Mon 15:00')
    expect(said()).not.toContain('skip')
    await click('[data-set="2"]')
    expect(said()).toBe('Tue 09:00')
  })
})

describe('a custom rect beside bars', () => {
  type Hour = { at: Date; v: number }
  const T0 = Date.UTC(2026, 0, 1)
  const hour = (i: number): Date => new Date(T0 + i * 3_600_000)
  const hours: Hour[] = Array.from({ length: 6 }, (_, i) => ({ at: hour(i), v: i + 1 }))

  function html(mark: 'bar' | 'line'): HTMLElement {
    const host = document.createElement('div')
    host.innerHTML = renderToString(
      <CartesianChart<Hour>
        label="Hours"
        data={hours}
        x={{ value: (d) => d.at }}
        series={[{ mark, key: 'v', label: 'V', color: COLOR, y: (d) => d.v }]}
        marks={CartesianChart.custom<Hour>(() => [
          rect([1], {
            id: 'window',
            x1: () => hour(1.5),
            x2: () => hour(3.5),
            y1: () => 0,
            y2: () => 5,
            fill: '#f00',
          }),
        ])}
      />,
    )
    return host
  }
  const num = (el: Element, name: string) => Number(el.getAttribute(name))

  test('draws on an axis a bar series also uses, on the edges between bands', () => {
    const host = html('bar')
    const window = host.querySelector('rect[data-ts-key^="window"]') as Element
    expect(Number.isFinite(num(window, 'x'))).toBe(true)
    expect(num(window, 'width')).toBeGreaterThan(0)
    const bars = [...host.querySelectorAll('[data-ts-key^="bars"]:not(g)')]
    const xs = bars.map((b) => [num(b, 'x'), num(b, 'x') + num(b, 'width')] as const)
    // From the gap after bar 1 to the gap after bar 3: bars 2 and 3 sit inside, 1 and 4 outside.
    const left = num(window, 'x')
    const right = left + num(window, 'width')
    const inside = xs.map(([a, b]) => a >= left - 0.5 && b <= right + 0.5)
    expect(inside).toEqual([false, false, true, true, false, false])
  })
})

describe('dimmed bars in dark', () => {
  type Stage = { stage: string; behind: number }
  const STAGES: readonly Stage[] = [
    { stage: 'Build', behind: 12 },
    { stage: 'Test', behind: 94 },
    { stage: 'Deploy', behind: 8 },
  ]
  function Bars3() {
    const focus = useChartFocus(STAGES, { announce: (d) => d.stage })
    return (
      <CartesianChart<Stage>
        label="Pace"
        data={STAGES}
        x={{ value: (d) => d.stage }}
        series={[{ key: 'behind', label: 'Behind', color: COLOR, mark: 'bar', y: (d) => d.behind }]}
        cursor="expr4-dim"
        focus={focus}
      />
    )
  }
  const fills = (el: HTMLElement) =>
    [...el.querySelectorAll('[data-ts-key^="bars"]:not(g)')].map(
      (b) => b.getAttribute('fill') ?? '',
    )

  test('a dimmed bar is half strength in light and 70% of its strength in dark', async () => {
    const el = await mount(<Bars3 />)
    const wrap = el.querySelector('[data-chart-focus]') as Element
    await press(wrap, 'ArrowRight')
    await press(wrap, 'ArrowRight')
    const dimmed = fills(el).filter((f) => f.startsWith('light-dark(color-mix'))
    expect(dimmed.length).toBe(2)
    for (const fill of dimmed) {
      // The default bar shade is 85%: 43% of it in light, 60% in dark.
      expect(fill).toContain(' 43%')
      expect(fill).toContain(' 60%')
    }
  })
})

describe('the tooltip names the held focus', () => {
  type Sender = { name: string; mails: number; opened: number }
  // Two senders share 8.5 mails a week: the cursor carries only that x.
  const senders: Sender[] = [
    { name: 'buildstatus', mails: 8.5, opened: 26 },
    { name: 'pizzaclub', mails: 8.5, opened: 6 },
    { name: 'devnotes', mails: 4, opened: 61 },
  ]
  const opened: ChartSeries<Sender> = {
    key: 'opened',
    label: 'Opened',
    color: 'var(--basalt-line)',
    mark: 'dot',
    getValue: (d) => d.opened,
  }
  const titleOf = (focused: Sender | null, hovered: Sender): string => {
    const definition = compileCartesian<Sender, number>({
      chartId: 'held',
      data: senders,
      x: (d) => d.mails,
      series: [opened],
      focused,
      tooltip: { formatHeader: (_x, d) => (d as Sender).name },
      marks: () => [],
    })
    const row = (d: Sender) => ({ series: 'opened', x: d.mails, datum: d, y: d.opened })
    const content = (
      definition.tooltip as unknown as {
        content: (p: unknown[]) => { title: string; rows: { value: string }[] }
      }
    ).content([{ xValue: hovered.mails, datum: row(hovered) }])
    return `${content.title}:${content.rows[0]?.value}`
  }

  test('without a held focus the nearest point names it', () => {
    expect(titleOf(null, senders[0]!)).toStartWith('buildstatus:')
  })

  test('with a held focus the focused datum names it, though the engine found another at that x', () => {
    expect(titleOf(senders[1]!, senders[0]!)).toBe('pizzaclub:6')
  })
})
