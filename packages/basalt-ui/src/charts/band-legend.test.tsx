/**
 * The legend of a chart with nothing to draw, and what a swatch promises: a pending / empty /
 * errored chart keeps the legend's box but shows no entries; a swatch mirrors its state's
 * `fillOpacity`; `MirroredBars` names its absent share like `BandStrip` does.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { BandStrip } from './BandStrip'
import { ChartLegend } from './legend'
import type { LegendMode } from './legend'
import { Lines } from './Lines'
import { MirroredBars } from './MirroredBars'
import type { MirroredBarsProps } from './MirroredBars'
import type { ChartState } from './types'

type Slot = { t: string; v: number }
const data: Slot[] = ['a', 'b', 'c', 'd'].map((t, v) => ({ t, v }))
const x = (d: Slot): string => d.t
const ok = { key: 'ok', label: 'OK', color: 'var(--vx-good)' }
const faint = { key: 'faint', label: 'No loss', color: 'var(--vx-neutral)', fillOpacity: 0.14 }

const NOTHING_TO_DRAW: [string, ChartState][] = [
  ['pending', { pending: true }],
  ['empty', { empty: 'Nothing yet' }],
  ['error', { error: 'Boom' }],
]

const strip = (state?: ChartState): ReactElement => (
  <BandStrip
    ariaLabel="S"
    data={data}
    x={x}
    states={[ok, faint]}
    getBand={() => ({ state: 'ok' })}
    {...(state && { state })}
  />
)

const PANES = [
  { key: 'dn', label: 'Down', color: 'var(--vx-line)', getValue: (d: Slot) => d.v },
  { key: 'up', label: 'Up', color: 'var(--vx-line-2)', getValue: (d: Slot) => d.v },
]
const ABSENT = {
  key: 'gap',
  label: 'Not measured',
  color: 'var(--vx-accent)',
  fillOpacity: 0.5,
  getValue: () => null,
}
const mirrored = (extra: Partial<MirroredBarsProps<Slot, string>> = {}): ReactElement => (
  <MirroredBars
    ariaLabel="M"
    data={data}
    x={x}
    series={PANES}
    up={{ key: 'up', format: String }}
    down={{ key: 'dn', format: String }}
    {...extra}
  />
)
const lines = (state: ChartState): ReactElement => (
  <Lines
    ariaLabel="L"
    data={data}
    x={x}
    series={[
      { key: 'a', label: 'A', color: 'var(--vx-line)', getValue: (d: Slot) => d.v },
      { key: 'b', label: 'B', color: 'var(--vx-line-2)', getValue: (d: Slot) => d.v },
    ]}
    state={state}
  />
)

const dom = (node: ReactElement): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(node)
  return el
}
const legend = (el: Element): HTMLElement | null =>
  el.querySelector<HTMLElement>('fieldset[data-basalt-chart-legend]')

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
  await act(async () => {
    root?.render(node)
  })
  return el
}

describe('a chart with nothing to draw names nothing', () => {
  const kinds: [string, (s: ChartState) => ReactElement][] = [
    ['Lines', lines],
    ['BandStrip', strip],
    ['MirroredBars', (state) => mirrored({ state })],
  ]
  for (const [kind, render] of kinds)
    for (const [label, state] of NOTHING_TO_DRAW)
      test(`${kind} ${label}: the legend is concealed, its box kept`, () => {
        const el = legend(dom(render(state)))
        expect(el).not.toBeNull()
        expect(el?.style.visibility).toBe('hidden')
        expect(el?.getAttribute('aria-hidden')).toBe('true')
      })

  test('a loaded chart shows its legend', () => {
    const el = legend(dom(strip()))
    expect(el?.style.visibility).toBe('')
    expect(el?.hasAttribute('aria-hidden')).toBe(false)
  })

  test('the placeholder still says why: the error alert and the empty message', () => {
    expect(dom(strip({ error: 'Boom' })).querySelector('[role="alert"]')?.textContent).toContain(
      'Boom',
    )
    expect(dom(strip({ empty: 'Nothing yet' })).textContent).toContain('Nothing yet')
  })

  test('a concealed legend offers no toggle a keyboard could reach', () => {
    const el = legend(dom(strip({ pending: true })))
    // The buttons stay in the markup (the row keeps its height); their ancestor hides them.
    expect(el?.querySelectorAll('button').length).toBeGreaterThan(0)
    expect(el?.style.visibility).toBe('hidden')
  })
})

describe('legend swatch opacity', () => {
  test('a BandStrip state with fillOpacity draws its swatch at that opacity', () => {
    const entry = dom(strip()).querySelector('[data-legend-key="faint"]')
    const swatches = [...(entry?.querySelectorAll<HTMLElement>('span[aria-hidden]') ?? [])]
    expect(swatches.length).toBeGreaterThan(0)
    for (const s of swatches) expect(s.style.opacity).toBe('0.14')
  })

  for (const mode of ['dots', 'chips'] as LegendMode[])
    test(`${mode} mode mirrors fillOpacity`, () => {
      const el = dom(
        <ChartLegend
          series={[{ ...faint, mark: 'bar', getValue: () => null }]}
          hidden={new Set()}
          mode={mode}
          groups={false}
          toggle={false}
          onToggle={() => {}}
          onHighlight={() => {}}
        />,
      )
      const swatch = el.querySelector<HTMLElement>('[data-legend-key="faint"] span[aria-hidden]')
      expect(swatch?.style.opacity).toBe('0.14')
    })
})

// The engine names a composed view's marks `view-composition-0:<pane>:<mark id>`; there is no
// public attribute for a mark, so the selector is coupled to that naming (as panels.test.tsx is).
const absentRects = (el: Element): Element[] => [
  ...el.querySelectorAll('[data-ts-key^="view-composition-0:top:up-absent"] rect'),
]
const measuredRects = (el: Element): Element[] => [
  ...el.querySelectorAll('[data-ts-key^="view-composition-0:top:up-measured-"] rect'),
]
const upBars = (el: Element): Element[] => [
  ...el.querySelectorAll('[data-ts-key^="view-composition-0:top:up-bars"] rect'),
]
const labels = (el: Element): string[] =>
  [...el.querySelectorAll('[data-legend-key]')].map((n) => n.getAttribute('data-legend-key') ?? '')

describe('MirroredBars absentState', () => {
  const absent = (extra: Partial<MirroredBarsProps<Slot, string>> = {}) =>
    mirrored({
      series: [...PANES, ABSENT],
      absentState: 'gap',
      getAbsentFraction: () => 1,
      ...extra,
    })

  test('the absent share takes the named entry colour and opacity; unset stays neutral', () => {
    const fill = (node: ReactElement) => absentRects(dom(node))[0]?.getAttribute('fill')
    expect(fill(mirrored({ getAbsentFraction: () => 1 }))).toBe('var(--vx-neutral)')
    expect(fill(absent())).toBe('color-mix(in srgb, var(--vx-accent) 50%, transparent)')
  })

  test('the entry is in the legend, with its label; unset adds none', () => {
    const el = dom(absent())
    expect(labels(el)).toContain('gap')
    expect(el.querySelector('[data-legend-key="gap"]')?.textContent).toContain('Not measured')
    expect(labels(dom(mirrored({ getAbsentFraction: () => 1 })))).not.toContain('gap')
  })

  test('an unknown key throws in dev', () => {
    expect(() => renderToString(mirrored({ absentState: 'nope' }))).toThrow(/absentState/)
  })

  test('in production an unknown key falls back to neutral, no throw, no entry', () => {
    const env = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const el = dom(mirrored({ absentState: 'nope', getAbsentFraction: () => 1 }))
      expect(absentRects(el)[0]?.getAttribute('fill')).toBe('var(--vx-neutral)')
      expect(labels(el)).not.toContain('nope')
    } finally {
      process.env.NODE_ENV = env ?? 'test'
    }
  })

  test('toggling the absent entry off gives the share back to the measured bar', async () => {
    const half = absent({ getAbsentFraction: () => 0.5 })
    const el = await mount(half)
    const button = (): HTMLButtonElement => {
      const b = el.querySelector<HTMLButtonElement>('button[data-legend-key="gap"]')
      if (!b) throw new Error('no toggle for the absent entry')
      return b
    }
    const width = (r: Element | undefined): number => Number(r?.getAttribute('width'))
    expect(absentRects(el).length).toBeGreaterThan(0)
    const cell = width(measuredRects(el)[0]) * 2

    await act(async () => button().click())
    expect(absentRects(el)).toHaveLength(0)
    // No partial rect remains: the bar itself is the measured fill, at its full cell.
    expect(measuredRects(el)).toHaveLength(0)
    expect(upBars(el)[0]?.getAttribute('fill')).not.toBe('transparent')
    expect(width(upBars(el)[0])).toBeCloseTo(cell, 1)

    await act(async () => button().click())
    expect(absentRects(el).length).toBeGreaterThan(0)
    expect(width(measuredRects(el)[0])).toBeCloseTo(cell / 2, 1)
  })

  test('a fully absent bar is drawn measured when the entry is hidden', async () => {
    const el = await mount(absent())
    expect(upBars(el)[0]?.getAttribute('fill')).toBe('transparent')
    await act(async () =>
      el.querySelector<HTMLButtonElement>('button[data-legend-key="gap"]')?.click(),
    )
    expect(upBars(el)[0]?.getAttribute('fill')).not.toBe('transparent')
  })
})
