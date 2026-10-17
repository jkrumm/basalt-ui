/**
 * The W1 spike's twelve contract tests (docs/waves/evidence/w1/charts.md), ported onto the real
 * modules: SSR to an accessible SVG, the `--vx-*` theme bridge, the basalt-resolved y domain, the
 * dual axis, the engine pin, SSR cursor isolation, and one shared cursor across instances
 * (source-only tooltips, `onFollow`, the portal fallback, basalt resolution and its clear).
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { createChartRuntime } from '@tanstack/charts/runtime'
import { renderChartSvg } from '@tanstack/charts/svg'
import type { StoredChartSpec } from '@tanstack/charts/types/core'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { compileCartesian } from './compile'
import { chartCursor, hasCursorGroup } from './cursor'
import { hoverPlot } from '../../tests/support/hover-plot'
import { Lines } from './Lines'
import type { LinesProps } from './Lines'
import { chartEngineCss } from './theme'
import type { ChartSeries } from './types'

type Row = { day: string; v: number | null }
const rows = (amp: number, gapAt = -1): Row[] =>
  Array.from({ length: 30 }, (_, i) => ({
    day: `2026-09-${String(i + 1).padStart(2, '0')}`,
    v: i === gapAt ? null : 40 + amp * Math.sin(i / 4),
  }))
const day = (d: number): Date => new Date(Date.UTC(2026, 8, d))
const x = (d: Row): Date => new Date(`${d.day}T00:00:00Z`)
const load: ChartSeries<Row> = {
  key: 'load',
  label: 'Load',
  color: 'var(--vx-line)',
  getValue: (d) => d.v,
}
const props: LinesProps<Row, Date> = {
  ariaLabel: 'Load',
  data: rows(30, 12),
  x,
  series: [load],
  zones: [{ from: 60, to: 100, fill: 'var(--vx-bad)' }],
  thresholds: [{ value: 60, side: 'above', fill: 'var(--vx-bad)' }],
  refLines: [{ value: 30, color: 'var(--vx-good-ref)', dashed: true }],
}

// One element per host that painted a tooltip. (`hidden` is no signal: happy-dom has zero geometry,
// so the portal's viewport-collision check marks every tooltip hidden.)
const tooltips = (): Element[] => [...document.querySelectorAll('.ts-chart-tooltip')]

// Whitespace-insensitive: the formatter owns the stylesheet's layout, not its content.
const flat = (css: string): string => css.replaceAll(/\s+/g, '')

const build = (def: ReturnType<typeof compileCartesian>, width = 640): StoredChartSpec =>
  def.chart({ width, height: 240, defaultTheme: {} as never })

describe('SSR', () => {
  test('renderToString emits the complete accessible SVG', () => {
    const html = renderToString(<Lines {...props} />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Load"')
    expect(html).toContain('class="ts-chart__rect"') // zone
    expect(html).toContain('data-ts-key="threshold-0:positive"') // threshold lobe
    expect(html).toContain('class="ts-chart__rule ts-chart__rule-y"') // reference line
    // The null row is a gap: two path elements for one series.
    const line = html.slice(html.indexOf('data-ts-key="load:'))
    expect(line.slice(0, line.indexOf('</g>')).match(/<path /g)?.length).toBe(2)
  })

  test('the framework-free renderer returns a string with no DOM', () => {
    const runtime = createChartRuntime()
    const def = compileCartesian({
      chartId: 'ssr',
      data: props.data,
      x,
      series: [load],
      marks: () => [],
    })
    const scene = runtime.render(def, { width: 720, height: 240 })
    const svg = renderChartSvg(scene, { ariaLabel: 'Load', idPrefix: 'load' })
    runtime.destroy()
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('aria-label="Load"')
  })
})

/** The package.json above a resolved entry (neither package exports `./package.json`). */
function manifestOf(specifier: string): { version: string; dependencies?: Record<string, string> } {
  let dir = dirname(Bun.resolveSync(specifier, import.meta.dir))
  while (!dir.endsWith('/node_modules')) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
      if (pkg.name === specifier) return pkg
    } catch {}
    dir = dirname(dir)
  }
  throw new Error(`no manifest for ${specifier}`)
}

test('version compat: the engine pin, and the d3-scale the engine depends on', () => {
  const engine = manifestOf('@tanstack/charts')
  expect(engine.version).toBe('1.1.0')
  expect(manifestOf('d3-scale').version).toBe(engine.dependencies?.['d3-scale'] ?? 'missing')
  const pkg = JSON.parse(readFileSync(join(import.meta.dir, '../../package.json'), 'utf8'))
  expect(pkg.peerDependencies['@tanstack/charts']).toBe('1.1.0')
  expect(pkg.peerDependencies['d3-scale']).toBe('4.0.2')
})

describe('SSR cursor isolation', () => {
  test('without window no controller is created, read or written', () => {
    const g = globalThis as { window?: unknown }
    const win = g.window
    delete g.window // a server request
    try {
      expect(typeof window).toBe('undefined')
      const html = renderToString(<Lines {...props} cursorGroup="ssr-probe" />)
      expect(html).toContain('role="img"')
      const server = chartCursor('ssr-probe')
      server.setState({
        anchor: 'value',
        value: { x: new Date() },
        source: 'programmatic',
      } as never)
      expect(server.getState()).toBeNull()
      expect(hasCursorGroup('ssr-probe')).toBe(false)
    } finally {
      g.window = win
    }
    expect(hasCursorGroup('ssr-probe')).toBe(false)
    expect(chartCursor('ssr-probe').getState()).toBeNull()
  })
})

describe('theme bridge', () => {
  test('every paint is a --vx-* reference; no TanStack default hex leaks', () => {
    const html = renderToString(<Lines {...props} />)
    expect(html).toContain('stroke="var(--vx-line)"')
    expect(html).toContain('fill="var(--vx-axis)"') // theme.muted → tick labels
    expect(html).not.toContain('--ts-chart-') // engine vars live on :root, never on the host
    for (const hex of ['#2563eb', '#f97316', '#10b981', '#3ca951', '#4269d0', '#64748b'])
      expect(html).not.toContain(hex)
  })

  test('chartEngineCss emits the engine vars as one :root block', () => {
    const css = chartEngineCss()
    expect(css.startsWith(':root{')).toBe(true)
    expect(css.indexOf('{')).toBe(css.lastIndexOf('{'))
    expect(css).toContain('--ts-chart-tooltip-background:var(--vx-tooltip-bg)')
    expect(css).toContain('--ts-chart-tooltip-border:var(--vx-tooltip-border)')
  })

  test('styles.css carries chartEngineCss() verbatim (scripts/gen-chart-css.ts)', () => {
    const styles = readFileSync(join(import.meta.dir, '../styles.css'), 'utf8')
    expect(flat(styles)).toContain(flat(chartEngineCss()).replace(/;?\}$/, ';}'))
  })

  test('the y domain is basalt-resolved: an unbounded zone does not widen it', () => {
    const def = compileCartesian({
      chartId: 'dom',
      data: props.data,
      x,
      series: [load],
      zones: [{ from: 60, to: Infinity, fill: 'var(--vx-good)' }],
      marks: () => [],
    })
    const y = build(def).scales['y']?.scale as unknown as { domain: () => number[] }
    expect(y.domain()[1]).toBeLessThan(100)
  })
})

test('dual axis: a right-axis series renders a named y2 axis', () => {
  const r = [1, 2, 3].map((i) => ({ t: day(i), a: i * 10, b: i / 10 }))
  const html = renderToString(
    <Lines
      ariaLabel="d"
      data={r}
      x={(d) => d.t}
      y2={{}}
      series={[
        { key: 'a', label: 'A', color: 'var(--vx-line)', getValue: (d) => d.a },
        { key: 'b', label: 'B', color: 'var(--vx-accent)', getValue: (d) => d.b, axis: 'right' },
      ]}
    />,
  )
  expect(html).toContain('data-ts-key="y2-tick-label:number:0.1"')
})

describe('shared cursor', () => {
  let root: ReturnType<typeof createRoot> | undefined
  afterEach(() => {
    act(() => root?.unmount())
    root = undefined
    chartCursor().setState(null)
    document.body.innerHTML = ''
  })

  const b: ChartSeries<Row> = { ...load, key: 'b', label: 'B', color: 'var(--vx-accent)' }
  async function hoverAOverB(bTooltip?: { onFollow: boolean }): Promise<HTMLElement> {
    const el = document.createElement('div')
    document.body.append(el)
    root = createRoot(el)
    await act(async () => {
      root?.render(
        <>
          <div id="A">
            <Lines data={rows(30)} x={x} series={[load]} ariaLabel="A" legend={false} />
          </div>
          <div id="B">
            <Lines
              data={rows(10)}
              x={x}
              series={[b]}
              ariaLabel="B"
              legend={false}
              {...(bTooltip && { tooltip: bTooltip })}
            />
          </div>
        </>,
      )
    })
    await hoverPlot(el.querySelector('#A svg'))
    return el
  }

  test('a pointer on chart A paints chart B at the same x; only A shows a tooltip', async () => {
    const el = await hoverAOverB()
    const state = chartCursor().getState()
    expect(state?.source).toBe('pointer')
    expect(state?.anchor).toBe('value')
    const ruleX = (id: string): string | null | undefined =>
      el.querySelector(`#${id} .ts-chart__crosshair-rule--x`)?.getAttribute('x1')
    expect(ruleX('A')).toBeDefined()
    expect(ruleX('B')).toBe(ruleX('A'))
    const tips = tooltips()
    expect(tips.length).toBe(1)
    expect(tips[0]?.getAttribute('role')).toBe('tooltip')
    expect(tips[0]?.textContent).toContain('Load')
    expect(document.querySelectorAll('[aria-live]').length).toBe(1)
  })

  test('a follower draws the same cursor dots as the leader, and still no tooltip', async () => {
    const el = await hoverAOverB()
    const dots = (id: string): number =>
      el.querySelectorAll(`#${id} [data-ts-key^="default-focus"] circle`).length
    expect(dots('A')).toBe(1)
    expect(dots('B')).toBe(dots('A'))
    expect(tooltips().length).toBe(1)
  })

  test('a follower draws its cursorValue dot at the shared x, in the getMarker colour', async () => {
    const el = document.createElement('div')
    document.body.append(el)
    root = createRoot(el)
    const track: ChartSeries<Row> = {
      ...b,
      key: 'track',
      getValue: () => null,
      cursorValue: (d) => d.v,
      getMarker: () => ({ color: 'var(--vx-fill-red)' }),
    }
    await act(async () => {
      root?.render(
        <>
          <div id="A">
            <Lines data={rows(30)} x={x} series={[load]} ariaLabel="A" legend={false} />
          </div>
          <div id="B">
            <Lines data={rows(10)} x={x} series={[track]} ariaLabel="B" legend={false} />
          </div>
        </>,
      )
    })
    await hoverPlot(el.querySelector('#A svg'))
    const shown = [...el.querySelectorAll('#B g[data-ts-key="track-cursor"] circle')].filter(
      (c) => c.getAttribute('fill-opacity') === '1',
    )
    expect(shown.map((c) => c.getAttribute('fill'))).toEqual(['var(--vx-fill-red)'])
  })

  describe('a follower whose x-domain does not contain the cursor', () => {
    const early = rows(30).slice(0, 10) // 09-01 .. 09-10
    const late = rows(10).slice(20) // 09-21 .. 09-30
    const draw = async (xDomain?: readonly [Date, Date]): Promise<HTMLElement> => {
      const el = document.createElement('div')
      document.body.append(el)
      root = createRoot(el)
      await act(async () => {
        root?.render(
          <>
            <div id="A">
              <Lines data={early} x={x} series={[load]} ariaLabel="A" legend={false} />
            </div>
            <div id="B">
              <Lines
                data={late}
                x={x}
                series={[b]}
                ariaLabel="B"
                legend={false}
                xDomain={xDomain}
              />
            </div>
          </>,
        )
      })
      return el
    }
    const at = async (d: number): Promise<void> => {
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
    const dots = (el: Element, id: string): number =>
      el.querySelectorAll(`#${id} [data-ts-key^="default-focus"] circle`).length
    const rule = (el: Element, id: string): boolean =>
      el.querySelector(`#${id} .ts-chart__crosshair-rule--x`) !== null

    test('outside: no crosshair, no dot (not one clamped to the edge datum)', async () => {
      const el = await draw()
      await at(5)
      expect(dots(el, 'A')).toBe(1)
      expect(rule(el, 'A')).toBe(true)
      expect(dots(el, 'B')).toBe(0)
      expect(rule(el, 'B')).toBe(false)
    })

    test('a leader hovering outside the follower domain leaves it without a tooltip', async () => {
      const el = await draw()
      await hoverPlot(el.querySelector('#A svg'))
      expect(chartCursor().getState()?.source).toBe('pointer')
      expect(dots(el, 'A')).toBe(1)
      expect(dots(el, 'B')).toBe(0)
      expect(el.querySelector('#B .ts-chart__crosshair-rule--x')).toBeNull()
      expect(tooltips().length).toBe(1)
      expect(el.querySelector('#B [aria-live]')).toBeNull()
    })

    test('inside, and exactly on the domain edge: it draws', async () => {
      const el = await draw()
      await at(25)
      expect(dots(el, 'B')).toBe(1)
      expect(rule(el, 'B')).toBe(true)
      await at(21)
      expect(dots(el, 'B')).toBe(1)
      await at(30)
      expect(dots(el, 'B')).toBe(1)
    })

    test('an explicit xDomain is the domain: inside it draws, outside it does not', async () => {
      const el = await draw([day(15), day(30)])
      await at(17)
      expect(dots(el, 'B')).toBe(1)
      await at(10)
      expect(dots(el, 'B')).toBe(0)
    })
  })

  test('the follower becomes the leader the moment the pointer moves onto it', async () => {
    const el = await hoverAOverB()
    expect(tooltips().length).toBe(1)
    await hoverPlot(el.querySelector('#B svg'))
    // A's element stays (hidden) once it has painted; B, now the leader, has painted its own.
    expect(
      tooltips()
        .map((t) => t.textContent)
        .join(' '),
    ).toContain('B')
    expect(tooltips().length).toBe(2)
  })

  test('a follower repaints its tooltip once the leader has cleared', async () => {
    const el = await hoverAOverB()
    await act(async () => {
      chartCursor().setState(null)
    })
    await hoverPlot(el.querySelector('#B svg'))
    expect(
      tooltips()
        .map((t) => t.textContent)
        .join(' '),
    ).toContain('B')
  })

  test('an explicit cursorGroup (and the unnamed one) both keep a follower silent', async () => {
    const el = document.createElement('div')
    document.body.append(el)
    root = createRoot(el)
    await act(async () => {
      root?.render(
        <>
          <div id="A">
            <Lines
              data={rows(30)}
              x={x}
              series={[load]}
              ariaLabel="A"
              legend={false}
              cursorGroup="g"
            />
          </div>
          <div id="B">
            <Lines
              data={rows(10)}
              x={x}
              series={[b]}
              ariaLabel="B"
              legend={false}
              cursorGroup="g"
            />
          </div>
          <div id="C">
            <Lines data={rows(10)} x={x} series={[b]} ariaLabel="C" legend={false} />
          </div>
        </>,
      )
    })
    await hoverPlot(el.querySelector('#A svg'))
    expect(chartCursor('g').getState()).not.toBeNull()
    expect(chartCursor().getState()).toBeNull()
    expect(tooltips().length).toBe(1)
    expect(el.querySelectorAll('#B [data-ts-key^="default-focus"] circle').length).toBe(1)
    expect(el.querySelectorAll('#C [data-ts-key^="default-focus"] circle').length).toBe(0)
  })

  test('a follower draws no dot for a series it does not plot (legend-hidden)', async () => {
    const el = document.createElement('div')
    document.body.append(el)
    root = createRoot(el)
    const track = (key: string): ChartSeries<Row> => ({
      ...b,
      key,
      getValue: () => null,
      cursorValue: (d) => d.v,
    })
    await act(async () => {
      root?.render(
        <>
          <div id="A">
            <Lines data={rows(30)} x={x} series={[load]} ariaLabel="A" legend={false} />
          </div>
          <div id="B">
            <Lines data={rows(10)} x={x} series={[track('t1'), track('t2')]} ariaLabel="B" />
          </div>
        </>,
      )
    })
    await act(async () => {
      el.querySelector('#B [data-legend-key="t2"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })
    await hoverPlot(el.querySelector('#A svg'))
    const shown = (key: string): number =>
      [...el.querySelectorAll(`#B g[data-ts-key="${key}-cursor"] circle`)].filter(
        (c) => c.getAttribute('fill-opacity') === '1',
      ).length
    expect(shown('t1')).toBe(1)
    expect(shown('t2')).toBe(0)
  })

  test('a re-render (new series identity) keeps the live cursor state', async () => {
    const el = await hoverAOverB()
    expect(chartCursor().getState()).not.toBeNull()
    await act(async () => {
      root?.render(
        <div id="A">
          <Lines data={rows(30)} x={x} series={[{ ...load }]} ariaLabel="A" legend={false} />
        </div>,
      )
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(el.querySelector('#A svg')).not.toBeNull()
    expect(chartCursor().getState()).not.toBeNull()
  })

  test('tooltip.onFollow opts a follower back into its own tooltip', async () => {
    await hoverAOverB({ onFollow: true })
    const tips = tooltips()
    expect(tips.length).toBe(2)
    expect(tips.map((t) => t.textContent).join(' ')).toContain('B')
  })

  test('the portal fallback reparents the tooltip under <body>, out of the host', async () => {
    await hoverAOverB()
    const [tip] = tooltips()
    if (!tip) throw new Error('no tooltip')
    // happy-dom has no Popover: the fixed fallback moves the tooltip under <body>, where vars set on
    // the host would not reach it — why the engine vars live on :root. The inheritance itself is the
    // layout suite's job, in Chrome.
    expect(tip.parentElement).toBe(document.body)
    expect(tip.closest('.ts-chart-host')).toBeNull()
    expect(tip.getAttribute('data-ts-chart-tooltip-portal')).toBe('fallback')
  })

  test('a weekly chart follows a daily one through basalt resolution, and clears with it', async () => {
    const el = document.createElement('div')
    document.body.append(el)
    root = createRoot(el)
    const daily = Array.from({ length: 28 }, (_, i) => ({ t: day(1 + i), v: i }))
    const weekly = [7, 14, 21, 28].map((d) => ({ t: day(d), v: d }))
    const s: ChartSeries<{ v: number }> = {
      key: 's',
      label: 'S',
      color: 'var(--vx-line)',
      getValue: (d) => d.v,
    }
    await act(async () => {
      root?.render(
        <>
          <div id="D">
            <Lines data={daily} x={(d) => d.t} series={[s]} ariaLabel="D" legend={false} />
          </div>
          <div id="W">
            <Lines
              data={weekly}
              x={(d) => d.t}
              series={[s]}
              ariaLabel="W"
              legend={false}
              cursorResolution="leading"
              formatX={(d) => d.toISOString().slice(0, 10)}
              tooltip={{ onFollow: true }}
            />
          </div>
        </>,
      )
    })
    const svgD = el.querySelector('#D svg')
    if (!svgD) throw new Error('daily chart did not mount')
    await act(async () => {
      svgD.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 260, clientY: 100, bubbles: true }),
      )
      await new Promise((r) => setTimeout(r, 30))
    })
    const published = chartCursor().getState()
    expect(published?.source).toBe('pointer')
    const titles = [...document.querySelectorAll('.ts-chart-tooltip__title')].map(
      (t) => t.textContent,
    )
    const at = published?.anchor === 'value' ? published.value.x : undefined
    if (!(at instanceof Date)) throw new Error('no value-anchored cursor')
    const monday = weekly
      .findLast((w) => w.t <= at)
      ?.t.toISOString()
      .slice(0, 10)
    expect(titles).toContain(monday ?? 'no monday')
    await act(async () => {
      // The DOM host clears transient focus on the container's `mouseleave` (renderer.js:696).
      for (const node of [svgD, svgD.parentElement, svgD.closest('.ts-chart-host')])
        node?.dispatchEvent(new MouseEvent('mouseleave'))
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(chartCursor().getState()).toBeNull()
  })
})
