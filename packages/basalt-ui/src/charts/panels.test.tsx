/**
 * `DualPanel` and `MirroredBars` behaviour through their public props: what the rendered DOM says
 * (one host, two composed panes), never the engine's internals.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { chartCursor } from './cursor'
import { DualPanel } from './DualPanel'
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
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
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

const keys = (el: Element, pane: string): string[] =>
  [...el.querySelectorAll(`[data-ts-key^="view-composition-0:${pane}:"]`)].map(
    (n) => n.getAttribute('data-ts-key') ?? '',
  )

const yDomainLabels = (el: Element, pane: string): number[] =>
  [
    ...el.querySelectorAll(
      `[data-ts-key="view-composition-0:${pane}:view"] text[data-ts-key^="y-tick"]`,
    ),
  ]
    .map((n) => Number(n.textContent?.replace('%', '')))
    .toSorted((p, q) => p - q)

const bottomLabels = (floor?: number): number[] => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(
    <DualPanel {...dualProps} bar={{ ...dualProps.bar, ...(floor && { maxAbsFloor: floor }) }} />,
  )
  return yDomainLabels(el, 'bottom')
}

const heightRatio = (f: number): number => paneHeight(f, 'top') / paneHeight(f, 'bottom')

const paneHeight = (fraction: number, pane: string): number => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(<DualPanel {...dualProps} topFraction={fraction} height={400} />)
  const rect = el.querySelector(`[data-ts-key="view-composition-0:${pane}:view:clip-defs"] rect`)
  return Number(rect?.getAttribute('height'))
}

describe('DualPanel', () => {
  test('one host, one label, two composed panes', async () => {
    const el = await mount(<DualPanel {...dualProps} />)
    expect(el.querySelectorAll('svg[role="img"]').length).toBe(1)
    expect(el.querySelector('svg')?.getAttribute('aria-label')).toBe('Divergence')
    expect(keys(el, 'top').length).toBeGreaterThan(0)
    expect(keys(el, 'bottom').length).toBeGreaterThan(0)
  })

  test('top pane: both lines and the fill between them; bottom pane: the signed bars', () => {
    const html = renderToString(<DualPanel {...dualProps} />)
    expect(html).toContain('view-composition-0:top:fill-between:positive')
    expect(html).toContain('view-composition-0:top:fill-between:negative')
    expect(html).toContain('stroke-dasharray="6 4"')
    // The fill takes `aboveFill` where `to` runs above `from`, `fill` elsewhere.
    expect(html).toContain('fill="var(--vx-good)"')
    expect(html).toContain('fill="var(--vx-bad)"')
    // A null bar is a gap, not a zero: 3 of 4 samples are drawn.
    expect(html.match(/view-composition-0:bottom:bars:object/g)?.length).toBe(3)
    // Positive and negative bars take their own colour, dimmed.
    expect(html).toContain('color-mix(in srgb, var(--vx-good) 70%, transparent)')
    expect(html).toContain('color-mix(in srgb, var(--vx-bad) 70%, transparent)')
  })

  test('the bottom pane is symmetric around zero; maxAbsFloor floors it', () => {
    const auto = bottomLabels()
    expect(Math.min(...auto)).toBe(-Math.max(...auto))
    expect(Math.max(...auto)).toBeLessThan(10)
    const floored = bottomLabels(20)
    expect(Math.max(...floored)).toBeGreaterThanOrEqual(20)
    expect(Math.min(...floored)).toBe(-Math.max(...floored))
  })

  test('each pane keeps its own domain; a fixed top domain is used verbatim', () => {
    const el = document.createElement('div')
    el.innerHTML = renderToString(<DualPanel {...dualProps} top={{ domain: [0, 100] }} />)
    expect(Math.max(...yDomainLabels(el, 'top'))).toBe(100)
    expect(Math.max(...yDomainLabels(el, 'bottom'))).toBeLessThan(10)
  })

  test('topFraction splits the height between the panes', () => {
    expect(heightRatio(0.7)).toBeGreaterThan(heightRatio(0.5))
    expect(heightRatio(0.7)).toBeGreaterThan(2)
  })

  test('the panes share one plot range: alignX lines up the x axis', () => {
    const el = document.createElement('div')
    el.innerHTML = renderToString(<DualPanel {...dualProps} />)
    const plotRect = (pane: string): [string | null, string | null] => {
      const rect = el.querySelector(
        `[data-ts-key="view-composition-0:${pane}:marks:clip-defs"] rect`,
      )
      return [rect?.getAttribute('x') ?? null, rect?.getAttribute('width') ?? null]
    }
    expect(plotRect('top')).toEqual(plotRect('bottom'))
  })

  test('a legend toggle hides the line, the fill and the bar together', async () => {
    const el = await mount(<DualPanel {...dualProps} />)
    const toggle = (key: string): Promise<void> =>
      act(async () =>
        (el.querySelector(`button[data-legend-key="${key}"]`) as HTMLButtonElement).click(),
      )
    expect(el.querySelector('[data-ts-key^="view-composition-0:top:a:"]')).not.toBeNull()
    await toggle('a')
    expect(el.querySelector('[data-ts-key^="view-composition-0:top:a:"]')).toBeNull()
    expect(el.querySelector('[data-ts-key*=":fill-between:"]')).toBeNull()
    expect(el.querySelector('[data-ts-key^="view-composition-0:top:b:"]')).not.toBeNull()
    await toggle('__bar')
    expect(el.querySelector('[data-ts-key*=":bottom:bars"] rect')).toBeNull()
    expect(el.querySelector('[data-legend-key="__bar"]')?.textContent).toContain('Divergence')
  })

  test('markers draw as dots on a line', () => {
    const html = renderToString(
      <DualPanel
        {...dualProps}
        series={[
          {
            ...(dualProps.series[0] as NonNullable<DualPanelProps<Row, Date>['series']>[number]),
            getMarker: (d) => (d.a === 20 ? { color: 'var(--vx-warn)' } : null),
          },
        ]}
      />,
    )
    expect(html).toContain('a-marker-0')
    expect(html).toContain('fill="var(--vx-warn)"')
  })

  test('state replaces the plot with its placeholder', () => {
    expect(renderToString(<DualPanel {...dualProps} state={{ pending: true }} />)).toContain(
      'aria-busy="true"',
    )
  })

  test('one tooltip for both panes: line rows, the bar row, then consumer rows', async () => {
    const el = await mount(
      <DualPanel
        {...dualProps}
        tooltip={{ rows: (d) => [{ label: 'Day', value: String(d.t.getUTCDate()) }] }}
        legend={false}
      />,
    )
    const svg = el.querySelector('svg')
    if (!svg) throw new Error('no chart')
    await act(async () => {
      svg.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 200, clientY: 40, bubbles: true }),
      )
      await new Promise((r) => setTimeout(r, 30))
    })
    const tips = [...document.querySelectorAll('.ts-chart-tooltip')]
    expect(tips.length).toBe(1)
    const labels = [
      ...(tips[0]?.querySelectorAll('.ts-chart-tooltip__row > span:nth-child(2)') ?? []),
    ].map((n) => n.textContent)
    expect(labels).toEqual(['Acute', 'Chronic', 'Divergence', 'Day'])
  })
})

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

const attr = (el: Element, selector: string, name: string): number =>
  Number(el.querySelector(selector)?.getAttribute(name))

const maxTopTick = (pane: Partial<MirroredBarsProps<Row, Date>['up']>): number => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(<MirroredBars {...mirrored} up={{ ...mirrored.up, ...pane }} />)
  return Math.max(
    ...[
      ...el.querySelectorAll(
        '[data-ts-key="view-composition-0:top:view"] text[data-ts-key^="y-tick"]',
      ),
    ].map((n) => parseFloat(n.textContent ?? '')),
  )
}

describe('MirroredBars', () => {
  test('one host; the up pane grows up, the down pane grows down from one baseline', () => {
    const el = document.createElement('div')
    el.innerHTML = renderToString(<MirroredBars {...mirrored} />)
    expect(el.querySelectorAll('svg[role="img"]').length).toBe(1)
    const up = el.querySelector('[data-ts-key$=":top:up-bars"] rect')
    const down = el.querySelector('[data-ts-key$=":bottom:down-bars"] rect')
    const upBase = Number(up?.getAttribute('y')) + Number(up?.getAttribute('height'))
    const upLine = attr(el, '[data-ts-key$=":top:baseline"] line', 'y1')
    const downLine = attr(el, '[data-ts-key$=":bottom:baseline"] line', 'y1')
    expect(upBase).toBeCloseTo(upLine, 1)
    // The down bar hangs from the top of its pane, which is the baseline.
    expect(Number(down?.getAttribute('y'))).toBeCloseTo(downLine, 1)
  })

  test('each pane resolves its own domain, in its own units', () => {
    const el = document.createElement('div')
    el.innerHTML = renderToString(<MirroredBars {...mirrored} />)
    const ticks = (pane: string): string[] =>
      [
        ...el.querySelectorAll(
          `[data-ts-key="view-composition-0:${pane}:view"] text[data-ts-key^="y-tick"]`,
        ),
      ].map((n) => n.textContent ?? '')
    expect(ticks('top').every((t) => t.endsWith(' kB'))).toBe(true)
    expect(ticks('bottom').every((t) => t.endsWith(' MB'))).toBe(true)
    // up peaks at 20, down at 4: shared, the download would be a sliver.
    expect(Math.max(...ticks('top').map((t) => parseFloat(t)))).toBeGreaterThanOrEqual(20)
    expect(Math.max(...ticks('bottom').map((t) => parseFloat(t)))).toBeLessThan(10)
  })

  test('a pinned max and autoMaxFloor bound the pane', () => {
    expect(maxTopTick({ max: 100 })).toBe(100)
    expect(maxTopTick({ autoMaxFloor: 80 })).toBeGreaterThanOrEqual(80)
  })

  test('upFraction splits the height; the panes meet at one baseline (no gap)', () => {
    const el = document.createElement('div')
    el.innerHTML = renderToString(<MirroredBars {...mirrored} upFraction={0.25} height={400} />)
    const clip = (pane: string): number =>
      attr(el, `[data-ts-key="view-composition-0:${pane}:view:clip-defs"] rect`, 'height')
    expect(clip('bottom') / clip('top')).toBeCloseTo(3, 0)
    const offset = (pane: string): number =>
      Number(
        el
          .querySelector(`[data-ts-key="view-composition-0:${pane}:view"]`)
          ?.getAttribute('transform')
          ?.match(/translate\(0 ([\d.]+)\)/)?.[1],
      )
    expect(offset('bottom')).toBeCloseTo(clip('top'), 1)
  })

  test('an absent fraction is a flat neutral slice at the bar edge, across the full pane', () => {
    const el = document.createElement('div')
    el.innerHTML = renderToString(<MirroredBars {...mirrored} getAbsentFraction={(d) => d.gap} />)
    for (const pane of ['top', 'bottom']) {
      const slice = el.querySelector(
        `[data-ts-key$=":${pane}:${pane === 'top' ? 'up' : 'down'}-absent"] rect`,
      )
      expect(slice?.getAttribute('fill')).toBe('var(--vx-neutral)')
      expect(slice?.getAttribute('fill')).not.toContain('url(')
    }
    // The 2nd of 4 samples is half absent: measured + slice exactly tile the band the engine draws
    // for its neighbours (same x, same width).
    const bar = (i: number): [number, number] => {
      const r = el.querySelectorAll('[data-ts-key$=":top:up-bars"] rect')[i]
      return [Number(r?.getAttribute('x')), Number(r?.getAttribute('width'))]
    }
    const [bandX, bandW] = bar(1)
    const measured = el.querySelector('[data-ts-key*=":top:up-measured-"] rect')
    const slice = el.querySelector('[data-ts-key$=":top:up-absent"] rect')
    expect(Number(measured?.getAttribute('x'))).toBeCloseTo(bandX, 1)
    expect(Number(measured?.getAttribute('width'))).toBeCloseTo(bandW / 2, 1)
    expect(Number(slice?.getAttribute('x'))).toBeCloseTo(bandX + bandW / 2, 1)
    expect(Number(slice?.getAttribute('width'))).toBeCloseTo(bandW / 2, 1)
    // The bar itself stays as the (invisible) hover target.
    expect(bar(1)[1]).toBeCloseTo(bandW, 1)
    expect(el.querySelectorAll('[data-ts-key$=":top:up-bars"] rect')[1]?.getAttribute('fill')).toBe(
      'transparent',
    )
  })

  test('getBarOpacity dims a bar', () => {
    const html = renderToString(
      <MirroredBars {...mirrored} getBarOpacity={(d) => (d.up === 5 ? 0.4 : 1)} />,
    )
    expect(html).toContain('color-mix(in srgb, var(--vx-accent) 40%, transparent)')
  })

  test('fold collapses adjacent data to fit the width, merging by the consumer', () => {
    const many: Row[] = Array.from({ length: 400 }, (_, i) => ({
      t: new Date(Date.UTC(2026, 8, 1, 0, i * 5)),
      a: 0,
      b: 0,
      v: 0,
      up: i === 7 ? 99 : 1,
      down: 1,
      gap: 0,
    }))
    const merge = (g: Row[]): Row => ({
      ...(g[0] as Row),
      up: Math.max(...g.map((r) => r.up)),
    })
    const bars = (fold: boolean): number => {
      const el = document.createElement('div')
      el.innerHTML = renderToString(
        <MirroredBars {...mirrored} data={many} {...(fold && { fold: { merge } })} />,
      )
      return el.querySelectorAll('[data-ts-key$=":top:up-bars"] rect').length
    }
    expect(bars(false)).toBe(400)
    expect(bars(true)).toBeLessThanOrEqual(Math.floor(640 / 3))
  })

  test('a pane key naming no series throws, naming the key', () => {
    expect(() =>
      renderToString(<MirroredBars {...mirrored} up={{ key: 'nope', format: String }} />),
    ).toThrow('up.key "nope"')
  })

  test('a legend toggle hides a pane', async () => {
    const el = await mount(<MirroredBars {...mirrored} />)
    expect(el.querySelector('[data-ts-key$=":bottom:down-bars"] rect')).not.toBeNull()
    await act(async () =>
      (el.querySelector('button[data-legend-key="down"]') as HTMLButtonElement).click(),
    )
    expect(el.querySelector('[data-ts-key$=":bottom:down-bars"] rect')).toBeNull()
    expect(el.querySelector('[data-ts-key$=":top:up-bars"] rect')).not.toBeNull()
    // The legend-only entry names absence and has nothing to hide.
    expect(el.querySelector('[data-legend-key="gap"]')).not.toBeNull()
  })

  test('one tooltip: each pane row in its own format, a legend-only entry has no row', async () => {
    const el = await mount(<MirroredBars {...mirrored} legend={false} />)
    const svg = el.querySelector('svg')
    if (!svg) throw new Error('no chart')
    await act(async () => {
      svg.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 200, clientY: 40, bubbles: true }),
      )
      await new Promise((r) => setTimeout(r, 30))
    })
    const tips = [...document.querySelectorAll('.ts-chart-tooltip')]
    expect(tips.length).toBe(1)
    const text = tips[0]?.textContent ?? ''
    expect(text).toContain('Download')
    expect(text).toMatch(/\d MB/)
    expect(text).toContain('Upload')
    expect(text).toMatch(/\d kB/)
    expect(text).not.toContain('No data')
  })
})
