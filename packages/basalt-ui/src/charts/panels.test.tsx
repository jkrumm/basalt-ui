/**
 * `DualPanel` and `MirroredBars` behaviour through their public props: what the rendered DOM says
 * (one host, two composed panes). Everything that knows how the engine names a composed view's
 * nodes lives in the helper block below; the tests read through it.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { act } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { chartCursor } from './cursor'
import { hoverPlot } from '../../tests/support/hover-plot'
import { DualPanel } from './DualPanel'
import { Lines } from './Lines'
import { ChartLegend } from './legend'
import type { DualPanelProps } from './DualPanel'
import { MirroredBars } from './MirroredBars'
import type { MirroredBarsProps } from './MirroredBars'

type Row = {
  t: Date
  a: number
  b: number
  v: number | null
  up: number
  down: number
  gap: number
}
const day = (d: number): Date => new Date(Date.UTC(2026, 8, d))
const data: Row[] = [1, 2, 3, 4].map((d) => ({
  t: day(d),
  a: d * 10,
  b: 40 - d * 3,
  v: d === 3 ? null : d % 2 ? d : -d,
  up: d * 5,
  down: d,
  gap: d === 2 ? 0.5 : 0,
}))

let root: ReturnType<typeof createRoot> | undefined
let hydrated: ReturnType<typeof hydrateRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  act(() => hydrated?.unmount())
  root = undefined
  hydrated = undefined
  chartCursor().setState(null)
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

const ssr = (node: React.ReactNode): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(node)
  return el
}

// ── the engine's naming of a composed view, in one place ────────────────────────────────────────

type Pane = 'top' | 'bottom'
const key = (pane: Pane, rest: string): string => `view-composition-0:${pane}:${rest}`

/** A mark's group (`id` is the mark id the kind gave it, or a prefix of it). */
const markGroup = (el: Element, pane: Pane, id: string): Element | null =>
  el.querySelector(`[data-ts-key^="${key(pane, id)}"]`)

const markRects = (el: Element, pane: Pane, id: string): Element[] => [
  ...el.querySelectorAll(`[data-ts-key^="${key(pane, id)}"] rect`),
]

/** The pane's allocated frame: its offset and size in the chart. */
function frame(el: Element, pane: Pane): { y: number; height: number } {
  const view = el.querySelector(`[data-ts-key="${key(pane, 'view')}"]`)
  const clip = el.querySelector(`[data-ts-key="${key(pane, 'view:clip-defs')}"] rect`)
  const y = view?.getAttribute('transform')?.match(/translate\(\S+ ([\d.]+)\)/)?.[1]
  return { y: Number(y), height: Number(clip?.getAttribute('height')) }
}

/** The pane's plot rectangle (inside its margins). */
function plot(el: Element, pane: Pane): { x: number; y: number; width: number; height: number } {
  const rect = el.querySelector(`[data-ts-key="${key(pane, 'marks:clip-defs')}"] rect`)
  return {
    x: Number(rect?.getAttribute('x')),
    y: Number(rect?.getAttribute('y')),
    width: Number(rect?.getAttribute('width')),
    height: Number(rect?.getAttribute('height')),
  }
}

/** The pane's y tick labels as text. */
const yTicks = (el: Element, pane: Pane): string[] =>
  [...el.querySelectorAll(`[data-ts-key="${key(pane, 'view')}"] text[data-ts-key^="y-tick"]`)].map(
    (n) => n.textContent ?? '',
  )

const yTickValues = (el: Element, pane: Pane): number[] =>
  yTicks(el, pane)
    .map((t) => parseFloat(t))
    .toSorted((p, q) => p - q)

const maxTick = (el: Element, pane: Pane): number => Math.max(...yTickValues(el, pane))

const num = (r: Element | undefined | null, name: string): number => Number(r?.getAttribute(name))

const hover = async (el: HTMLElement, x = 200, y = 40): Promise<void> => {
  const svg = el.querySelector('svg')
  if (!svg) throw new Error('no chart')
  await act(async () => {
    svg.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }))
    await new Promise((r) => setTimeout(r, 30))
  })
}

const tooltips = (): Element[] => [...document.querySelectorAll('.ts-chart-tooltip')]
const tooltipRows = (tip: Element | undefined): (string | null)[] =>
  [...(tip?.querySelectorAll('.ts-chart-tooltip__row > span:nth-child(2)') ?? [])].map(
    (n) => n.textContent,
  )

const legendButton = (el: Element, k: string): HTMLButtonElement => {
  const b = el.querySelector(`button[data-legend-key="${k}"]`)
  if (!(b instanceof HTMLButtonElement)) throw new Error(`no toggleable legend entry "${k}"`)
  return b
}

const mouseOver = (b: HTMLElement): Promise<void> =>
  act(async () => {
    b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  })

// ── DualPanel ───────────────────────────────────────────────────────────────────────────────────

const dualProps: DualPanelProps<Row, Date> = {
  ariaLabel: 'Divergence',
  data,
  x: (d) => d.t,
  series: [
    { key: 'a', label: 'Acute', color: 'var(--vx-line)', getValue: (d) => d.a },
    { key: 'b', label: 'Chronic', color: 'var(--vx-accent)', dash: 'dashed', getValue: (d) => d.b },
  ],
  fillBetween: { from: 'a', to: 'b', fill: 'var(--vx-bad)', aboveFill: 'var(--vx-good)' },
  bar: {
    label: 'Divergence',
    getValue: (d) => d.v,
    positive: 'var(--vx-good)',
    negative: 'var(--vx-bad)',
    format: (v) => `${v}%`,
  },
}

const withBar = (bar: Partial<DualPanelProps<Row, Date>['bar']>): DualPanelProps<Row, Date> => ({
  ...dualProps,
  bar: { ...dualProps.bar, ...bar },
})

const { fillBetween: _fill, ...dualNoFill } = dualProps

const oneLine: DualPanelProps<Row, Date>['series'] = [
  { key: 'a', label: 'A', color: 'var(--vx-line)', getValue: (d) => 1000 + d.a },
]

const heightRatio = (fraction: number): number => {
  const el = ssr(<DualPanel {...dualProps} topFraction={fraction} height={400} />)
  return frame(el, 'top').height / frame(el, 'bottom').height
}

const fillOf = (el: Element, side: 'positive' | 'negative'): string | null | undefined =>
  markGroup(el, 'top', `fill-between:${side}`)?.querySelector('path')?.getAttribute('fill')

/** Vertices across a DualPanel's fill paths. */
const fillPoints = (el: Element): number =>
  [...el.querySelectorAll('[data-ts-key*="fill-between:"] path')].reduce(
    (n, p) => n + (p.getAttribute('d')?.split(/[ML]/).length ?? 0),
    0,
  )

describe('DualPanel as a cursor follower', () => {
  const follow = async (onFollow: boolean): Promise<HTMLElement> => {
    const el = await mount(
      <>
        <div id="L">
          <DualPanel {...dualProps} ariaLabel="Leader" />
        </div>
        <div id="F">
          <DualPanel {...dualProps} ariaLabel="Follower" tooltip={{ onFollow }} />
        </div>
      </>,
    )
    await hoverPlot(el.querySelector('#L svg'))
    return el
  }
  const rings = (el: Element, id: string): number =>
    el.querySelectorAll(`#${id} [data-ts-key^="default-focus"] circle`).length

  test("draws the leader's dots at the shared x and keeps its tooltip silent", async () => {
    const el = await follow(false)
    expect(rings(el, 'L')).toBeGreaterThan(0)
    expect(rings(el, 'F')).toBe(rings(el, 'L'))
    expect(tooltips().length).toBe(1)
    expect(document.querySelectorAll('[aria-live]').length).toBe(1)
  })

  test('draws neither crosshair nor dot when the cursor is outside its x-domain', async () => {
    const el = await mount(
      <div id="F">
        <DualPanel {...dualProps} ariaLabel="Follower" />
      </div>,
    )
    const set = async (d: number): Promise<void> => {
      await act(async () => {
        chartCursor().setState({
          anchor: 'value',
          value: { x: day(d) },
          source: 'programmatic',
          pinned: false,
        })
        await new Promise((r) => setTimeout(r, 30))
      })
    }
    await set(2)
    expect(rings(el, 'F')).toBeGreaterThan(0)
    await act(async () => {
      // Half a day before the first sample: inside the half-step pad the scale renders.
      chartCursor().setState({
        anchor: 'value',
        value: { x: new Date(day(1).getTime() - 6 * 3_600_000) },
        source: 'programmatic',
        pinned: false,
      })
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(rings(el, 'F')).toBeGreaterThan(0)
    await set(1) // the data edge
    expect(rings(el, 'F')).toBeGreaterThan(0)
    await set(20)
    expect(rings(el, 'F')).toBe(0)
  })

  test('a real leader outside the panel domain: no crosshair, no dot, no tooltip; inside: drawn', async () => {
    const leader = (from: number) => data.map((r, i) => ({ ...r, t: day(from + i) }))
    const lead = {
      ariaLabel: 'Leader',
      x: (r: Row) => r.t,
      series: [{ key: 'a', label: 'A', color: 'var(--vx-line)', getValue: (r: Row) => r.a }],
      legend: false as const,
    }
    const el = await mount(
      <>
        <div id="L">
          <Lines {...lead} data={leader(20)} />
        </div>
        <div id="F">
          <DualPanel {...dualProps} ariaLabel="Follower" />
        </div>
      </>,
    )
    await hoverPlot(el.querySelector('#L svg'))
    expect(rings(el, 'L')).toBeGreaterThan(0)
    expect(rings(el, 'F')).toBe(0)
    expect(el.querySelector('#F .ts-chart__crosshair-rule--x')).toBeNull()
    expect(tooltips().length).toBe(1)
    await act(async () =>
      root?.render(
        <>
          <div id="L">
            <Lines {...lead} data={leader(1)} />
          </div>
          <div id="F">
            <DualPanel {...dualProps} ariaLabel="Follower" />
          </div>
        </>,
      ),
    )
    await hoverPlot(el.querySelector('#L svg'))
    expect(rings(el, 'F')).toBeGreaterThan(0)
    expect(tooltips().length).toBe(1)
  })

  test('a cursor first seen outside its x-domain draws no crosshair either', async () => {
    const el = await mount(
      <div id="F">
        <DualPanel {...dualProps} ariaLabel="Follower" />
      </div>,
    )
    await act(async () => {
      chartCursor().setState({
        anchor: 'value',
        value: { x: day(20) },
        source: 'programmatic',
        pinned: false,
      })
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(rings(el, 'F')).toBe(0)
    expect(el.querySelector('#F .ts-chart__crosshair-rule--x')).toBeNull()
  })

  test("tooltip.onFollow shows the follower's own tooltip as well", async () => {
    await follow(true)
    expect(tooltips().length).toBe(2)
  })
})

describe('DualPanel', () => {
  test('one host, one label, two composed panes', async () => {
    const el = await mount(<DualPanel {...dualProps} />)
    expect(el.querySelectorAll('svg[role="img"]').length).toBe(1)
    expect(el.querySelector('svg')?.getAttribute('aria-label')).toBe('Divergence')
    expect(markGroup(el, 'top', 'a:')).not.toBeNull()
    expect(markGroup(el, 'bottom', 'bars')).not.toBeNull()
  })

  test('top pane: both lines and the fill between them; bottom pane: the signed bars', () => {
    const el = ssr(<DualPanel {...dualProps} />)
    expect(el.innerHTML).toContain('stroke-dasharray="6 4"')
    // The fill takes `aboveFill` where `to` runs above `from`, `fill` elsewhere.
    expect(fillOf(el, 'positive')).toBe('var(--vx-good)')
    expect(fillOf(el, 'negative')).toBe('var(--vx-bad)')
    // A null bar is a gap, not a zero: 3 of 4 samples are drawn, each coloured by its sign.
    expect(markRects(el, 'bottom', 'bars').map((r) => r.getAttribute('fill'))).toEqual([
      'color-mix(in srgb, var(--vx-good) 70%, transparent)',
      'color-mix(in srgb, var(--vx-bad) 70%, transparent)',
      'color-mix(in srgb, var(--vx-bad) 70%, transparent)',
    ])
  })

  describe('a dense series (8000 rows, past the fill thinning threshold)', () => {
    const dense: Row[] = Array.from({ length: 8000 }, (_, i) => ({
      t: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000),
      a: 50 + Math.sin(i / 250) * 30,
      b: 50 + Math.cos(i / 400) * 30,
      v: Math.sin(i / 9) * 10,
      up: 0,
      down: 0,
      gap: 0,
    }))
    const denseProps = { ...dualProps, data: dense }

    test('the lines and bars keep every row; only the decorative fill is thinned', () => {
      const el = ssr(<DualPanel {...denseProps} />)
      expect(markRects(el, 'bottom', 'bars').length).toBe(8000)
      // An unthinned fill is two edges of 8000 vertices; thinned it is at most 8 rows per pixel
      // column (first, last, six extremes), two edges each, plus a point per crossing.
      // Floor: every pixel column keeps a first and last row, so the silhouette is not lost.
      expect(fillPoints(el)).toBeGreaterThan(2 * 640)
      expect(fillPoints(el)).toBeLessThan(2 * 8 * 640)
    })

    test('hydration adopts the server markup with no mismatch', async () => {
      const errors: unknown[] = []
      const el = document.createElement('div')
      document.body.append(el)
      el.innerHTML = renderToString(<DualPanel {...denseProps} />)
      const spy = spyOn(console, 'error').mockImplementation((...args) => void errors.push(args))
      await act(async () => {
        hydrated = hydrateRoot(el, <DualPanel {...denseProps} />, {
          onRecoverableError: (e) => void errors.push(e),
        })
      })
      spy.mockRestore()
      expect(errors).toEqual([])
    })

    test('the cursor still resolves a real datum of the full series', async () => {
      const seen: Row[] = []
      const el = await mount(
        <DualPanel
          {...denseProps}
          legend={false}
          tooltip={{
            rows: (d) => {
              seen.push(d)
              return [{ label: 'Day', value: String(d.t.getTime()) }]
            },
          }}
        />,
      )
      await hover(el)
      expect(seen.length).toBeGreaterThan(0)
      expect(seen.every((d) => dense.includes(d))).toBe(true)
    })
  })

  test('without aboveFill both sides take fill', () => {
    const { aboveFill: _, ...plain } = dualProps.fillBetween ?? { from: 'a', to: 'b', fill: '' }
    const el = ssr(<DualPanel {...dualProps} fillBetween={plain} />)
    expect(fillOf(el, 'positive')).toBe('var(--vx-bad)')
    expect(fillOf(el, 'negative')).toBe('var(--vx-bad)')
  })

  test('the bottom pane is symmetric around zero; maxAbsFloor floors it', () => {
    const auto = yTickValues(ssr(<DualPanel {...dualProps} />), 'bottom')
    expect(Math.min(...auto)).toBe(-Math.max(...auto))
    expect(Math.max(...auto)).toBeLessThan(10)
    const floored = yTickValues(ssr(<DualPanel {...withBar({ maxAbsFloor: 20 })} />), 'bottom')
    expect(Math.max(...floored)).toBeGreaterThanOrEqual(20)
    expect(Math.min(...floored)).toBe(-Math.max(...floored))
  })

  test('a fixed bar.domain is used verbatim, asymmetric included', () => {
    const el = ssr(<DualPanel {...withBar({ domain: [-10, 40] })} />)
    // Zero sits 40 of the 50 units down the pane.
    const box = plot(el, 'bottom')
    const zero = num(markGroup(el, 'bottom', 'zero')?.querySelector('line'), 'y1')
    expect((zero - box.y) / box.height).toBeCloseTo(0.8, 2)
    expect(maxTick(el, 'bottom')).toBeLessThanOrEqual(40)
  })

  test('each pane keeps its own domain; a fixed top domain is used verbatim', () => {
    const el = ssr(<DualPanel {...dualProps} top={{ domain: [0, 100] }} />)
    expect(maxTick(el, 'top')).toBe(100)
    expect(maxTick(el, 'bottom')).toBeLessThan(10)
  })

  test('the auto top domain follows the visible lines, not zero', () => {
    const el = ssr(<DualPanel {...dualNoFill} series={oneLine} top={{ format: String }} />)
    expect(Math.min(...yTickValues(el, 'top'))).toBeGreaterThan(900)
  })

  test('topFraction splits the height between the panes', () => {
    expect(heightRatio(0.7)).toBeGreaterThan(heightRatio(0.5))
    expect(heightRatio(0.7)).toBeGreaterThan(2)
  })

  test('a topFraction outside 0..1 or NaN still renders, clamped', () => {
    for (const f of [-1, 5, Number.NaN]) {
      const el = ssr(<DualPanel {...dualProps} topFraction={f} height={400} />)
      expect(el.querySelector('svg')).not.toBeNull()
      expect(frame(el, 'top').height).toBeGreaterThanOrEqual(0)
      expect(frame(el, 'bottom').height).toBeGreaterThanOrEqual(0)
    }
    // Clamped to 1 the top pane takes everything.
    const all = ssr(<DualPanel {...dualProps} topFraction={5} height={400} />)
    const half = ssr(<DualPanel {...dualProps} topFraction={0.5} height={400} />)
    expect(frame(all, 'bottom').height).toBeLessThan(frame(half, 'bottom').height)
  })

  test('the panes share one plot range: alignX lines up the x axis', () => {
    const el = ssr(<DualPanel {...dualProps} />)
    expect(plot(el, 'top').x).toBe(plot(el, 'bottom').x)
    expect(plot(el, 'top').width).toBe(plot(el, 'bottom').width)
  })

  test('a legend toggle hides the line, the fill and the bar together', async () => {
    const el = await mount(<DualPanel {...dualProps} />)
    expect(markGroup(el, 'top', 'a:')).not.toBeNull()
    await act(async () => legendButton(el, 'a').click())
    expect(markGroup(el, 'top', 'a:')).toBeNull()
    expect(markGroup(el, 'top', 'fill-between')).toBeNull()
    expect(markGroup(el, 'top', 'b:')).not.toBeNull()
    await act(async () => legendButton(el, '__bar').click())
    expect(markRects(el, 'bottom', 'bars').length).toBe(0)
    expect(legendButton(el, '__bar').textContent).toContain('Divergence')
  })

  const SPLIT = 'linear-gradient(90deg, var(--vx-good) 50%, var(--vx-bad) 50%)'
  const swatches = (entry: Element): HTMLElement[] => [
    ...entry.querySelectorAll<HTMLElement>('span[aria-hidden]'),
  ]

  test('the bar legend entry is one toggle with an exact split swatch per mode', async () => {
    const el = await mount(<DualPanel {...dualProps} />)
    const entry = legendButton(el, '__bar')
    // `auto` renders the dot and the chip; both split.
    expect(swatches(entry).map((n) => n.style.background)).toEqual([SPLIT, SPLIT])
    expect(el.querySelectorAll('button[data-legend-key="__bar"]').length).toBe(1)
  })

  test('the split swatch takes the mode shape: a circle in dots, a square in chips', async () => {
    const noop = (): void => undefined
    const bar = { key: 'b', label: 'B', color: 'var(--vx-good)', colorNegative: 'var(--vx-bad)' }
    const shape = async (mode: 'dots' | 'chips'): Promise<[string, string, string]> => {
      const el = await mount(
        <ChartLegend
          series={[{ ...bar, mark: 'bar' as const, getValue: () => 1 }]}
          hidden={new Set()}
          mode={mode}
          groups={false}
          toggle
          onToggle={noop}
          onHighlight={noop}
        />,
      )
      const sw = el.querySelectorAll<HTMLElement>('span[aria-hidden]')
      expect(sw.length).toBe(1)
      return [sw[0]!.style.background, sw[0]!.style.borderRadius, sw[0]!.style.width]
    }
    expect(await shape('dots')).toEqual([SPLIT, '50%', '8px'])
    expect(await shape('chips')).toEqual([SPLIT, '2px', '10px'])
  })

  test('a non-signed series keeps a solid swatch in dots, chips and line modes', async () => {
    const noop = (): void => undefined
    const lineS = { key: 'l', label: 'L', color: 'var(--vx-line)', getValue: () => 1 }
    const barS = { ...lineS, key: 'b', label: 'B', mark: 'bar' as const, colorNegative: '' }
    const el = await mount(
      <>
        {(['dots', 'chips', 'auto'] as const).map((mode) => (
          <ChartLegend
            key={mode}
            series={[lineS, barS]}
            hidden={new Set()}
            mode={mode}
            groups={false}
            toggle
            onToggle={noop}
            onHighlight={noop}
          />
        ))}
      </>,
    )
    const fills = [...el.querySelectorAll<HTMLElement>('span[aria-hidden]')].map(
      (n) => n.style.background,
    )
    expect(fills.length).toBeGreaterThan(0)
    for (const f of fills) expect(f).not.toContain('linear-gradient')
    // The line chip is an svg stroke, untouched.
    expect(el.querySelector('svg line')?.getAttribute('stroke')).toBe('var(--vx-line)')
  })

  test('toggling the bar entry hides both halves; hovering another entry dims them', async () => {
    const el = await mount(<DualPanel {...dualProps} />)
    expect(markRects(el, 'bottom', 'bars').length).toBeGreaterThan(0)
    await mouseOver(legendButton(el, 'a'))
    for (const r of markRects(el, 'bottom', 'bars')) expect(r.getAttribute('fill')).toContain('18%')
    await act(async () => legendButton(el, '__bar').click())
    expect(markRects(el, 'bottom', 'bars').length).toBe(0)
    expect(legendButton(el, '__bar').getAttribute('aria-pressed')).toBe('false')
    expect(swatches(legendButton(el, '__bar')).map((n) => n.style.background)).toEqual([
      SPLIT,
      SPLIT,
    ])
  })

  test('rerendering with only the negative colour changed updates the swatch', async () => {
    const el = await mount(<DualPanel {...dualProps} />)
    await act(async () => {
      root?.render(<DualPanel {...withBar({ negative: 'var(--vx-warn)' })} />)
    })
    expect(swatches(legendButton(el, '__bar')).map((n) => n.style.background)).toEqual([
      'linear-gradient(90deg, var(--vx-good) 50%, var(--vx-warn) 50%)',
      'linear-gradient(90deg, var(--vx-good) 50%, var(--vx-warn) 50%)',
    ])
  })

  test('hovering a legend entry dims the others, bars included', async () => {
    const el = await mount(<DualPanel {...dualProps} />)
    const strokeOf = (k: string): string | null | undefined =>
      markGroup(el, 'top', `${k}:`)?.querySelector('path')?.getAttribute('stroke-opacity')
    expect(strokeOf('b')).toBe('1')
    await mouseOver(legendButton(el, 'a'))
    expect(strokeOf('a')).toBe('1')
    expect(strokeOf('b')).toBe('0.25')
    expect(markRects(el, 'bottom', 'bars')[0]?.getAttribute('fill')).toBe(
      'color-mix(in srgb, var(--vx-good) 18%, transparent)',
    )
  })

  test('markers draw as dots on a line', () => {
    const [first] = dualProps.series
    if (!first) throw new Error('no series')
    const el = ssr(
      <DualPanel
        {...dualProps}
        series={[{ ...first, getMarker: (d) => (d.a === 20 ? { color: 'var(--vx-warn)' } : null) }]}
      />,
    )
    expect(markGroup(el, 'top', 'a-marker-0')?.querySelector('circle')?.getAttribute('fill')).toBe(
      'var(--vx-warn)',
    )
  })

  test('state replaces the plot with its placeholder', () => {
    const el = ssr(<DualPanel {...dualProps} state={{ pending: true }} />)
    expect(el.querySelector('[aria-busy]')).not.toBeNull()
    expect(el.querySelector('svg[role="img"]')).toBeNull()
  })

  test('one tooltip for both panes: line rows, the bar row, then consumer rows', async () => {
    const el = await mount(
      <DualPanel
        {...dualProps}
        tooltip={{ rows: (d) => [{ label: 'Day', value: String(d.t.getUTCDate()) }] }}
        legend={false}
      />,
    )
    await hover(el)
    expect(tooltips().length).toBe(1)
    expect(tooltipRows(tooltips()[0])).toEqual(['Acute', 'Chronic', 'Divergence', 'Day'])
  })

  test('the bar row reads bar.formatValue, falling back to bar.format', async () => {
    const el = await mount(
      <DualPanel
        {...withBar({ formatValue: (v, d) => `${v} on ${d.t.getUTCDate()}` })}
        legend={false}
      />,
    )
    await hover(el)
    expect(tooltips()[0]?.textContent).toMatch(/-?\d+ on \d/)
  })

  test('tooltipFormat formats the tooltip rows while format keeps the axis', async () => {
    const el = await mount(
      <DualPanel
        {...withBar({ tooltipFormat: (v) => `${v} pts` })}
        top={{ format: (v) => `${v}u`, tooltipFormat: (v) => `${v} top` }}
        legend={false}
      />,
    )
    await hover(el)
    const text = tooltips()[0]?.textContent ?? ''
    expect(text).toMatch(/-?\d+ pts/)
    expect(text).toMatch(/\d+ top/)
    expect(text).not.toMatch(/-?\d+%/)
    expect(yTicks(el, 'bottom').every((t) => t.endsWith('%'))).toBe(true)
  })

  test('a dashed line gets a dashed tooltip swatch, a solid one the plain color', async () => {
    const el = await mount(<DualPanel {...dualProps} legend={false} />)
    await hover(el)
    const swatches = [...document.querySelectorAll('.ts-chart-tooltip__swatch')].map(
      (n) => (n as HTMLElement).style.background,
    )
    expect(swatches[0]).not.toContain('gradient')
    expect(swatches[1]).toContain('repeating-linear-gradient')
  })

  test('tooltip={false} paints no tooltip', async () => {
    const el = await mount(<DualPanel {...dualProps} tooltip={false} legend={false} />)
    await hover(el)
    expect(tooltips().length).toBe(0)
  })

  test('degenerate data renders: empty, one sample, all-null', () => {
    expect(ssr(<DualPanel {...dualProps} data={[]} />).querySelector('svg')).not.toBeNull()
    expect(
      ssr(<DualPanel {...dualProps} data={data.slice(0, 1)} />).querySelector('svg'),
    ).not.toBeNull()
    const nulls = ssr(
      <DualPanel
        {...dualNoFill}
        data={data.map((d) => ({ ...d, v: null }))}
        series={[{ key: 'a', label: 'A', color: 'var(--vx-line)', getValue: () => null }]}
      />,
    )
    expect(nulls.innerHTML).not.toContain('NaN')
    expect(maxTick(nulls, 'bottom')).toBeGreaterThan(0)
  })

  test('the bar key is reserved', () => {
    expect(() =>
      renderToString(
        <DualPanel
          {...dualProps}
          series={[{ key: '__bar', label: 'x', color: 'var(--vx-line)', getValue: () => 1 }]}
        />,
      ),
    ).toThrow('"__bar" is reserved')
  })
})

// ── MirroredBars ────────────────────────────────────────────────────────────────────────────────

const mirrored: MirroredBarsProps<Row, Date> = {
  ariaLabel: 'Throughput',
  data,
  x: (d) => d.t,
  series: [
    { key: 'down', label: 'Download', color: 'var(--vx-line)', getValue: (d) => d.down },
    { key: 'up', label: 'Upload', color: 'var(--vx-accent)', getValue: (d) => d.up },
    { key: 'gap', label: 'No data', color: 'var(--vx-neutral)', getValue: () => null },
  ],
  up: { key: 'up', format: (v) => `${v} kB` },
  down: { key: 'down', format: (v) => `${v} MB` },
}

const withUp = (up: Partial<MirroredBarsProps<Row, Date>['up']>): MirroredBarsProps<Row, Date> => ({
  ...mirrored,
  up: { ...mirrored.up, ...up },
})

/** `n` five-minute slots; slot 7 spikes upload to 99. */
const slots = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    t: new Date(Date.UTC(2026, 8, 1, 0, i * 5)),
    a: 0,
    b: 0,
    v: 0,
    up: i === 7 ? 99 : 1,
    down: 1,
    gap: 0,
  }))
const keepSpike = (g: Row[]): Row => ({ ...(g[0] as Row), up: Math.max(...g.map((r) => r.up)) })
const upBars = (el: Element): Element[] => markRects(el, 'top', 'up-bars')
const downBars = (el: Element): Element[] => markRects(el, 'bottom', 'down-bars')
const baselineY = (el: Element, pane: Pane): number =>
  num(markGroup(el, pane, 'baseline')?.querySelector('line'), 'y1')

/** How many measured and absent rects a first-datum absent fraction of `f` draws. */
const absentCounts = (f: number): { measured: number; absent: number } => {
  const el = ssr(<MirroredBars {...mirrored} getAbsentFraction={(d) => (d.up === 10 ? f : 0)} />)
  return {
    measured: markRects(el, 'top', 'up-measured-').length,
    absent: markRects(el, 'top', 'up-absent').length,
  }
}

describe('MirroredBars', () => {
  test('one host; the up pane grows up, the down pane grows down from one baseline', () => {
    const el = ssr(<MirroredBars {...mirrored} />)
    expect(el.querySelectorAll('svg[role="img"]').length).toBe(1)
    const up = upBars(el)[0]
    const down = downBars(el)[0]
    expect(num(up, 'y') + num(up, 'height')).toBeCloseTo(baselineY(el, 'top'), 1)
    expect(num(down, 'y')).toBeCloseTo(baselineY(el, 'bottom'), 1)
  })

  test('each pane resolves its own domain, in its own units', () => {
    const el = ssr(<MirroredBars {...mirrored} />)
    expect(yTicks(el, 'top').every((t) => t.endsWith(' kB'))).toBe(true)
    expect(yTicks(el, 'bottom').every((t) => t.endsWith(' MB'))).toBe(true)
    // up peaks at 20, down at 4: shared, the download would be a sliver.
    expect(maxTick(el, 'top')).toBeGreaterThanOrEqual(20)
    expect(maxTick(el, 'bottom')).toBeLessThan(10)
  })

  test('a pinned max wins; autoMaxFloor floors the auto max', () => {
    expect(maxTick(ssr(<MirroredBars {...withUp({ max: 100 })} />), 'top')).toBe(100)
    expect(
      maxTick(ssr(<MirroredBars {...withUp({ autoMaxFloor: 80 })} />), 'top'),
    ).toBeGreaterThanOrEqual(80)
    // A floor below the data changes nothing.
    expect(maxTick(ssr(<MirroredBars {...withUp({ autoMaxFloor: 1 })} />), 'top')).toBe(
      maxTick(ssr(<MirroredBars {...mirrored} />), 'top'),
    )
  })

  test('a window with no traffic keeps a drawable domain; a hidden pane falls back to one', async () => {
    const quiet = ssr(
      <MirroredBars {...mirrored} data={data.map((d) => ({ ...d, up: 0, down: 0 }))} />,
    )
    expect(quiet.innerHTML).not.toContain('NaN')
    expect(maxTick(quiet, 'top')).toBeGreaterThan(0)
    const el = await mount(<MirroredBars {...mirrored} />)
    await act(async () => legendButton(el, 'up').click())
    expect(maxTick(el, 'top')).toBeLessThanOrEqual(1)
    expect(maxTick(el, 'bottom')).toBeGreaterThan(1)
  })

  test('upFraction splits the height; the panes meet at one baseline (no gap)', () => {
    const el = ssr(<MirroredBars {...mirrored} upFraction={0.25} height={400} />)
    expect(frame(el, 'bottom').height / frame(el, 'top').height).toBeCloseTo(3, 0)
    expect(frame(el, 'bottom').y).toBeCloseTo(frame(el, 'top').height, 1)
  })

  test('an upFraction outside 0..1 still renders, clamped', () => {
    for (const f of [-1, 5, Number.NaN])
      expect(ssr(<MirroredBars {...mirrored} upFraction={f} />).querySelector('svg')).not.toBeNull()
  })

  test('an absent fraction is a flat neutral slice at the bar edge, across the full pane', () => {
    const el = ssr(<MirroredBars {...mirrored} getAbsentFraction={(d) => d.gap} />)
    expect(markRects(el, 'top', 'up-absent')[0]?.getAttribute('fill')).toBe('var(--vx-neutral)')
    expect(markRects(el, 'bottom', 'down-absent')[0]?.getAttribute('fill')).toBe(
      'var(--vx-neutral)',
    )
    // The 2nd of 4 samples is half absent: measured + slice tile the band the engine draws.
    const band = upBars(el)[1]
    const measured = markRects(el, 'top', 'up-measured-')[0]
    const slice = markRects(el, 'top', 'up-absent')[0]
    expect(num(measured, 'x')).toBeCloseTo(num(band, 'x'), 1)
    expect(num(measured, 'width')).toBeCloseTo(num(band, 'width') / 2, 1)
    expect(num(slice, 'x')).toBeCloseTo(num(band, 'x') + num(band, 'width') / 2, 1)
    expect(num(slice, 'width')).toBeCloseTo(num(band, 'width') / 2, 1)
    // The bar itself stays as the (invisible) hover target.
    expect(band?.getAttribute('fill')).toBe('transparent')
  })

  test('a fully absent bar is all neutral; out-of-range fractions clamp', () => {
    expect(absentCounts(1)).toEqual({ measured: 0, absent: 1 })
    expect(absentCounts(1.5)).toEqual({ measured: 0, absent: 1 })
    expect(absentCounts(-0.5)).toEqual({ measured: 0, absent: 0 })
    expect(absentCounts(Number.NaN)).toEqual({ measured: 0, absent: 0 })
    expect(absentCounts(0.3)).toEqual({ measured: 1, absent: 1 })
  })

  test('getBarOpacity dims a bar; partly absent bars of two opacities are two marks', () => {
    const dim = ssr(<MirroredBars {...mirrored} getBarOpacity={(d) => (d.up === 5 ? 0.4 : 1)} />)
    expect(upBars(dim)[0]?.getAttribute('fill')).toBe(
      'color-mix(in srgb, var(--vx-accent) 40%, transparent)',
    )
    const two = ssr(
      <MirroredBars
        {...mirrored}
        getAbsentFraction={(d) => (d.up <= 10 ? 0.5 : 0)}
        getBarOpacity={(d) => (d.up === 5 ? 0.4 : 1)}
      />,
    )
    expect(markRects(two, 'top', 'up-measured-').map((r) => r.getAttribute('fill'))).toEqual([
      'color-mix(in srgb, var(--vx-accent) 40%, transparent)',
      'color-mix(in srgb, var(--vx-accent) 100%, transparent)',
    ])
  })

  test('fold collapses adjacent data to fit the width, merging by the consumer', () => {
    const many = slots(400)
    expect(upBars(ssr(<MirroredBars {...mirrored} data={many} />)).length).toBe(400)
    const folded = ssr(<MirroredBars {...mirrored} data={many} fold={{ merge: keepSpike }} />)
    // The default width is 640 and the default pitch 3px.
    expect(upBars(folded).length).toBeLessThanOrEqual(Math.floor(640 / 3))
    expect(upBars(folded).length).toBeGreaterThan(100)
    // The merge kept the spike: a max, not a mean.
    const tallest = Math.min(...upBars(folded).map((r) => num(r, 'y')))
    expect(tallest).toBeCloseTo(plot(folded, 'top').y, 0)
    const wide = ssr(
      <MirroredBars {...mirrored} data={many} fold={{ merge: keepSpike, minBandPx: 20 }} />,
    )
    expect(upBars(wide).length).toBeLessThanOrEqual(Math.floor(640 / 20))
  })

  test('fold leaves data that already fits untouched', () => {
    const el = ssr(<MirroredBars {...mirrored} fold={{ merge: () => data[0] as Row }} />)
    expect(upBars(el).length).toBe(4)
  })

  test('a pane key naming no series throws, naming the key', () => {
    expect(() =>
      renderToString(<MirroredBars {...mirrored} up={{ key: 'nope', format: String }} />),
    ).toThrow('up.key "nope"')
    expect(() =>
      renderToString(<MirroredBars {...mirrored} down={{ key: 'nope', format: String }} />),
    ).toThrow('down.key "nope"')
  })

  test('a legend toggle hides a pane; the legend-only entry has nothing to hide', async () => {
    const el = await mount(<MirroredBars {...mirrored} />)
    expect(downBars(el).length).toBe(4)
    await act(async () => legendButton(el, 'down').click())
    expect(downBars(el).length).toBe(0)
    expect(upBars(el).length).toBe(4)
    expect(el.querySelector('[data-legend-key="gap"]')).not.toBeNull()
  })

  test('hovering a legend entry dims the other pane', async () => {
    const el = await mount(<MirroredBars {...mirrored} />)
    await mouseOver(legendButton(el, 'down'))
    expect(downBars(el)[0]?.getAttribute('fill')).toBe(
      'color-mix(in srgb, var(--vx-line) 100%, transparent)',
    )
    expect(upBars(el)[0]?.getAttribute('fill')).toBe(
      'color-mix(in srgb, var(--vx-accent) 25%, transparent)',
    )
  })

  test('one tooltip: each pane row in its own format, a legend-only entry has no row', async () => {
    const el = await mount(<MirroredBars {...mirrored} legend={false} />)
    await hover(el)
    expect(tooltips().length).toBe(1)
    const text = tooltips()[0]?.textContent ?? ''
    expect(text).toMatch(/Download.*\d MB/)
    expect(text).toMatch(/Upload.*\d kB/)
    expect(text).not.toContain('No data')
  })

  test('tooltip={false} paints no tooltip', async () => {
    const el = await mount(<MirroredBars {...mirrored} tooltip={false} legend={false} />)
    await hover(el)
    expect(tooltips().length).toBe(0)
  })

  test('a series outside both panes falls back to the default number format', async () => {
    const extra = { key: 'x', label: 'Extra', color: 'var(--vx-bad)', getValue: () => 1234 }
    const el = await mount(
      <MirroredBars {...mirrored} series={[...mirrored.series, extra]} legend={false} />,
    )
    await hover(el)
    expect(tooltips()[0]?.textContent).toContain('1.2k')
  })

  test('degenerate data renders: empty and one sample', () => {
    expect(ssr(<MirroredBars {...mirrored} data={[]} />).querySelector('svg')).not.toBeNull()
    const one = ssr(<MirroredBars {...mirrored} data={data.slice(0, 1)} />)
    expect(one.innerHTML).not.toContain('NaN')
    expect(upBars(one).length).toBe(1)
  })
})
