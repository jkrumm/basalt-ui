/**
 * W1 chart-contract spike (docs/waves/evidence/w1/charts.md). Proves, on @tanstack/charts@1.1.0:
 * SSR to an SVG string, the --vx-* theme bridge, and one shared cursor across two instances.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import {
  createChartRuntime,
  createChartScene,
  defineChart,
  lineY,
  renderChartSvg,
} from '@tanstack/charts'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleUtc } from 'd3-scale'
import type { StoredChartSpec } from '@tanstack/charts/types/core'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { cursorController, getServerCursorSnapshot, hasCursorGroup } from './cursor'
import { chartEngineCss } from './theme-bridge'
import { ZonedLine, zonedLine } from './ZonedLine'

type Row = { day: string; v: number | null }
const rows = (amp: number, gapAt = -1): Row[] =>
  Array.from({ length: 30 }, (_, i) => ({
    day: `2026-09-${String(i + 1).padStart(2, '0')}`,
    v: i === gapAt ? null : 40 + amp * Math.sin(i / 4),
  }))
const day = (d: number) => new Date(Date.UTC(2026, 8, d))
const x = (d: Row) => new Date(`${d.day}T00:00:00Z`)
const load = { key: 'load', label: 'Load', color: 'var(--vx-line)', getValue: (d: Row) => d.v }
const props = {
  data: rows(30, 12),
  x,
  series: load,
  zones: [{ from: 60, to: 100, fill: 'var(--vx-bad)' }],
  thresholds: [{ value: 60, side: 'above' as const, fill: 'var(--vx-bad)' }],
  refLines: [{ value: 30, color: 'var(--vx-good-ref)', dashed: true }],
}

// One element per host that painted a tooltip. (`hidden` is no signal here: happy-dom has zero
// geometry, so the portal's viewport-collision check marks every tooltip hidden.)
const tooltips = () => [...document.querySelectorAll('.ts-chart-tooltip')]

describe('SSR', () => {
  test('React renderToString emits the complete accessible SVG', () => {
    const html = renderToString(<ZonedLine {...props} ariaLabel="Load" />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Load"')
    expect(html).toContain('class="ts-chart__rect"') // zone
    expect(html).toContain('data-ts-key="threshold-0:positive"') // threshold lobe
    expect(html).toContain('class="ts-chart__rule ts-chart__rule-y"') // ref line
    // The null row is a gap: two path elements for one series.
    const line = html.slice(html.indexOf('data-ts-key="load:'))
    expect(line.slice(0, line.indexOf('</g>')).match(/<path /g)?.length).toBe(2)
  })

  test('framework-free renderChartSvg returns a string with no DOM', () => {
    const runtime = createChartRuntime()
    const scene = runtime.render(zonedLine(props, 'ssr'), { width: 720, height: 240 })
    const svg = renderChartSvg(scene, { ariaLabel: 'Load', idPrefix: 'load' })
    runtime.destroy()
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('stroke="var(--vx-line)"')
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

test('version compat: basalt resolves the engine pin and the d3-scale the engine depends on', () => {
  const engine = manifestOf('@tanstack/charts')
  expect(engine.version).toBe('1.1.0')
  expect(manifestOf('d3-scale').version).toBe(engine.dependencies?.['d3-scale'] ?? 'missing')
})

describe('SSR cursor isolation', () => {
  test('without window no controller is created, read or written', () => {
    const g = globalThis as { window?: unknown }
    const win = g.window
    delete g.window // simulate a server request
    try {
      expect(typeof window).toBe('undefined')
      const html = renderToString(<ZonedLine {...props} ariaLabel="Load" cursorGroup="ssr-probe" />)
      expect(html).toContain('role="img"')
      const server = cursorController('ssr-probe')
      server.setState({
        anchor: 'value',
        value: { x: new Date() },
        source: 'programmatic',
      } as never)
      expect(server.getState()).toBeNull()
      expect(getServerCursorSnapshot()).toBeNull()
      expect(hasCursorGroup('ssr-probe')).toBe(false)
    } finally {
      g.window = win
    }
    // Nothing the "server" did reached the client's (lazily created) controller.
    expect(hasCursorGroup('ssr-probe')).toBe(false)
    expect(cursorController('ssr-probe').getState()).toBeNull()
  })
})

describe('theme bridge', () => {
  test('every paint is a --vx-* reference; no TanStack default hex leaks', () => {
    const html = renderToString(<ZonedLine {...props} ariaLabel="Load" />)
    expect(html).toContain('stroke="var(--vx-grid)"') // theme.grid
    expect(html).toContain('fill="var(--vx-axis)"') // theme.muted → tick labels
    expect(html).not.toContain('--ts-chart-') // engine vars live on :root, never on the host
    for (const hex of ['#2563eb', '#f97316', '#10b981', '#3ca951', '#4269d0', '#64748b'])
      expect(html).not.toContain(hex)
  })

  test('chartEngineCss emits the engine vars as one :root block', () => {
    const css = chartEngineCss()
    expect(css.startsWith(':root{')).toBe(true)
    expect(css).toContain('--ts-chart-tooltip-background:var(--vx-tooltip-bg)')
    expect(css).toContain('--ts-chart-tooltip-border:var(--vx-tooltip-border)')
  })

  test('y domain is basalt-resolved: a zone does not widen it', () => {
    const spec = zonedLine(
      { ...props, zones: [{ from: 0, to: 500, fill: 'var(--vx-good)' }] },
      'dom',
    )
    const built = spec.chart({
      width: 640,
      height: 240,
      defaultTheme: {} as never,
    }) as StoredChartSpec
    const y = built.scales['y']?.scale as unknown as { domain: () => number[] }
    expect(y.domain()[1]).toBeLessThan(100)
  })
})

test('dual axis: a named y scale on the right side is native', () => {
  const r = [1, 2, 3].map((i) => ({ t: new Date(Date.UTC(2026, 8, i)), a: i * 10, b: i / 10 }))
  const def = defineChart({
    marks: [lineY(r, { x: 't', y: 'a' }), lineY(r, { x: 't', y: 'b', yScale: 'y2' })],
    scales: {
      x: { scale: scaleUtc },
      y: { scale: scaleLinear },
      y2: { channel: 'y', scale: scaleLinear, side: 'right' },
    },
  })
  const svg = renderChartSvg(createChartScene(def, { width: 600, height: 200 }), { ariaLabel: 'd' })
  expect(svg).toContain('data-ts-key="y2-axis"')
})

describe('shared cursor', () => {
  let root: ReturnType<typeof createRoot> | undefined
  afterEach(() => {
    act(() => root?.unmount())
    cursorController().setState(null)
    document.body.innerHTML = ''
  })

  const b = { ...load, key: 'b', label: 'B', color: 'var(--vx-accent)' }
  async function hoverAOverB(bTooltip?: { onFollow: boolean }) {
    const el = document.createElement('div')
    document.body.append(el)
    root = createRoot(el)
    await act(async () => {
      root?.render(
        <>
          <div id="A">
            <ZonedLine data={rows(30)} x={x} series={load} ariaLabel="A" />
          </div>
          <div id="B">
            <ZonedLine
              data={rows(10)}
              x={x}
              series={b}
              ariaLabel="B"
              {...(bTooltip && { tooltip: bTooltip })}
            />
          </div>
        </>,
      )
    })
    const svgA = el.querySelector('#A svg')
    if (!svgA) throw new Error('chart A did not mount')
    await act(async () => {
      svgA.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 300, clientY: 100, bubbles: true }),
      )
      await new Promise((r) => setTimeout(r, 30))
    })
    return el
  }

  test('a pointer on chart A paints chart B at the same semantic x; only A shows a tooltip', async () => {
    const el = await hoverAOverB()
    const state = cursorController().getState()
    expect(state?.source).toBe('pointer')
    expect(state?.anchor).toBe('value')
    const ruleX = (id: string) =>
      el.querySelector(`#${id} .ts-chart__crosshair-rule--x`)?.getAttribute('x1')
    expect(ruleX('A')).toBeDefined()
    expect(ruleX('B')).toBe(ruleX('A'))
    // Source-only: one tooltip, one live region, and it is A's (series "Load", not "B").
    const tips = tooltips()
    expect(tips.length).toBe(1)
    expect(tips[0]?.getAttribute('role')).toBe('status')
    expect(tips[0]?.textContent).toContain('Load')
    expect(document.querySelectorAll('[aria-live]').length).toBe(1)
  })

  test('tooltip.onFollow opts a follower back into its own tooltip (the 1.x opt-in)', async () => {
    await hoverAOverB({ onFollow: true })
    const tips = tooltips()
    expect(tips.length).toBe(2)
    expect(tips.map((t) => t.textContent).join(' ')).toContain('B')
  })

  test('the portal fallback reparents the tooltip under <body>, out of the host', async () => {
    await hoverAOverB()
    const [tip] = tooltips()
    if (!tip) throw new Error('no tooltip')
    // happy-dom has no Popover, so the portal took its fixed fallback: the tooltip is a child of
    // <body>, and vars set on the host would not reach it. That is why the engine vars live on
    // :root (`chartEngineCss`). happy-dom does not cascade custom properties at all, so the
    // inheritance itself is the W4 layout suite's job, in Chrome.
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
    const s = { key: 's', label: 'S', color: 'var(--vx-line)', getValue: (d: { v: number }) => d.v }
    await act(async () => {
      root?.render(
        <>
          <div id="D">
            <ZonedLine data={daily} x={(d) => d.t} series={s} ariaLabel="D" />
          </div>
          <div id="W">
            <ZonedLine
              data={weekly}
              x={(d) => d.t}
              series={s}
              ariaLabel="W"
              cursorResolution="leading"
              tooltip={{ onFollow: true }}
            />
          </div>
        </>,
      )
    })
    const svgD = el.querySelector('#D svg')
    if (!svgD) throw new Error('daily chart did not mount')
    // Without basalt's resolving view TanStack paints an unsnapped rule and focuses no point.
    await act(async () => {
      svgD.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 260, clientY: 100, bubbles: true }),
      )
      await new Promise((r) => setTimeout(r, 30))
    })
    const published = cursorController().getState()
    expect(published?.source).toBe('pointer')
    const titles = [...document.querySelectorAll('.ts-chart-tooltip__title')].map(
      (t) => t.textContent,
    )
    const x = published?.anchor === 'value' ? published.value.x : undefined
    if (!(x instanceof Date)) throw new Error('no value-anchored cursor')
    const monday = weekly
      .findLast((w) => w.t <= x)
      ?.t.toISOString()
      .slice(0, 10)
    expect(titles).toContain(monday ?? 'no monday')
    await act(async () => {
      // The DOM host clears transient focus on the container's `mouseleave` (renderer.js:696).
      for (const node of [svgD, svgD.parentElement, svgD.closest('.ts-chart-host')])
        node?.dispatchEvent(new MouseEvent('mouseleave'))
      await new Promise((r) => setTimeout(r, 30))
    })
    // The source's ownership-safe cleanup still finds ITS state through the resolving view. (The
    // crosshair node itself outlives the clear in happy-dom on source and follower alike — a paint
    // detail of the host, not of the adapter.)
    expect(cursorController().getState()).toBeNull()
  })
})
