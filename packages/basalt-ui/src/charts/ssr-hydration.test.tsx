/**
 * The SSR-first contract for every chart kind (V2-SPEC § 9.6/§ 9.7, W10): the server HTML carries
 * the final box — the CSS-owned `ChartBox`, the legend, the card header — and `hydrateRoot` adopts
 * it with no mismatch warning and an identical outer markup. Only the svg inside the engine
 * surface may differ (it redraws at the measured size). Real geometry is the layout suite's
 * (`tests/layout/ssr-contract.layout.test.ts`); here the markup is compared.
 */
import { act } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import type { ReactElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { BandStrip } from './BandStrip'
import { Bars } from './Bars'
import { CartesianChart } from './CartesianChart'
import { ChartCard } from './ChartCard'
import { Donut } from './Donut'
import { DualPanel } from './DualPanel'
import { Heatmap } from './Heatmap'
import { Lines } from './Lines'
import { MirroredBars } from './MirroredBars'
import { Sparkline } from './Sparkline'
import { StackedArea } from './StackedArea'
import { chartBoxVars } from './box'
import { resolveChartSize } from './sizing'
import type { ChartSeries } from './types'

type Row = { t: Date; a: number; b: number; v: number | null; up: number; down: number }
const day = (d: number): Date => new Date(Date.UTC(2026, 8, d))
const data: Row[] = Array.from({ length: 10 }, (_, i) => ({
  t: day(i + 1),
  a: 20 + i * 3,
  b: 60 - i * 2,
  v: i % 4 === 3 ? null : i - 4,
  up: 5 + i,
  down: 2 + (i % 3),
}))
const x = (d: Row): Date => d.t
const a: ChartSeries<Row> = { key: 'a', label: 'A', color: 'var(--vx-line)', getValue: (d) => d.a }
const b: ChartSeries<Row> = {
  key: 'b',
  label: 'B',
  color: 'var(--vx-accent)',
  getValue: (d) => d.b,
}

const kinds: [string, () => ReactElement][] = [
  ['Lines', () => <Lines ariaLabel="L" data={data} x={x} series={[a, b]} />],
  [
    'Lines with a state',
    () => <Lines ariaLabel="L" data={data} x={x} series={[a]} state={{ pending: true }} />,
  ],
  [
    'Bars',
    () => (
      <Bars
        ariaLabel="B"
        data={data}
        x={(d) => d.t.toISOString()}
        bars={[{ key: 'a', label: 'A', color: 'var(--vx-line)', getValue: (d) => d.a }]}
      />
    ),
  ],
  ['StackedArea', () => <StackedArea ariaLabel="S" data={data} x={x} series={[a, b]} />],
  ['Sparkline', () => <Sparkline ariaLabel="T" data={[3, 5, 4, 8, 6]} height={28} />],
  [
    'BandStrip',
    () => (
      <BandStrip
        ariaLabel="Up"
        data={data}
        x={(d) => d.t.toISOString()}
        states={[{ key: 'up', label: 'Up', color: 'var(--vx-good)' }]}
        getBand={() => ({ state: 'up' })}
      />
    ),
  ],
  [
    'Donut',
    () => (
      <Donut
        ariaLabel="D"
        data={[
          { key: 'a', value: 3 },
          { key: 'b', value: 5 },
        ]}
        colorForKey={() => 'var(--vx-line)'}
        formatValue={String}
      />
    ),
  ],
  [
    'Heatmap',
    () => (
      <Heatmap
        ariaLabel="H"
        data={[
          { r: 'Mon', c: '0', v: 1 },
          { r: 'Tue', c: '1', v: 2 },
        ]}
        getRow={(d) => d.r}
        getCol={(d) => d.c}
        getValue={(d) => d.v}
      />
    ),
  ],
  [
    'DualPanel',
    () => (
      <DualPanel
        ariaLabel="P"
        data={data}
        x={x}
        series={[a, b]}
        bar={{
          label: 'Bar',
          getValue: (d) => d.v,
          positive: 'var(--vx-good)',
          negative: 'var(--vx-bad)',
          format: String,
        }}
      />
    ),
  ],
  [
    'MirroredBars',
    () => (
      <MirroredBars
        ariaLabel="M"
        data={data}
        x={x}
        series={[
          { key: 'down', label: 'Down', color: 'var(--vx-line)', getValue: (d) => d.down },
          { key: 'up', label: 'Up', color: 'var(--vx-accent)', getValue: (d) => d.up },
        ]}
        up={{ key: 'up', format: String }}
        down={{ key: 'down', format: String }}
      />
    ),
  ],
  [
    'CartesianChart',
    () => <CartesianChart ariaLabel="C" data={data} x={x} series={[a]} marks={() => []} />,
  ],
  ['fixed height', () => <Lines ariaLabel="L" data={data} x={x} series={[a]} height={200} />],
  [
    'responsive height',
    () => <Lines ariaLabel="L" data={data} x={x} series={[a]} height={{ base: 150, wide: 260 }} />,
  ],
  [
    'ChartCard with a header legend',
    () => (
      <ChartCard title="Card">
        <Lines ariaLabel="L" data={data} x={x} series={[a, b]} legend={{ placement: 'header' }} />
      </ChartCard>
    ),
  ],
  ['ChartCard pending', () => <ChartCard title="Card" state={{ pending: true }} />],
]

/** The markup the contract promises: everything but the engine surface (its svg and the inline
 * style the engine writes when it mounts). */
const outer = (html: string): string =>
  html
    .replaceAll(
      /<div class="ts-chart-surface"[^>]*>.*?<\/svg><\/div>|<div class="ts-chart-surface"[^>]*><\/div>/gs,
      '<surface/>',
    )
    .replaceAll(/ id="mantine-[^"]*"/g, '')

afterEach(() => {
  document.body.innerHTML = ''
})

async function hydrate(
  node: ReactElement,
): Promise<{ server: string; client: string; warnings: string[] }> {
  const container = document.createElement('div')
  container.innerHTML = renderToString(node)
  document.body.append(container)
  const server = container.innerHTML
  const warnings: string[] = []
  const spy = spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    warnings.push(args.map(String).join(' '))
  })
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, node, { onRecoverableError: (e) => warnings.push(String(e)) })
  })
  spy.mockRestore()
  const client = container.innerHTML
  await act(async () => root?.unmount())
  return { server, client, warnings }
}

describe('chart SSR hydration', () => {
  test.each(kinds)(
    '%s: no mismatch, the outer markup is the server markup',
    async (_name, node) => {
      const { server, client, warnings } = await hydrate(node())
      expect(warnings).toEqual([])
      expect(outer(client)).toBe(outer(server))
    },
  )

  test('the box is in the server HTML: four per-class heights, no measured number', () => {
    const html = renderToString(<Lines ariaLabel="L" data={data} x={x} series={[a]} />)
    for (const k of ['micro', 'compact', 'regular', 'wide'])
      expect(html).toContain(`--bc-${k}:clamp(`)
    expect(html).not.toContain('height:320px')
  })

  test('the legend is in the server HTML with both swatches; CSS picks one', () => {
    const html = renderToString(<Lines ariaLabel="L" data={data} x={x} series={[a, b]} />)
    expect(html).toContain('data-basalt-chart-legend="auto"')
    expect(html).toContain('data-legend-key="b"')
  })

  test('a header-placed legend is in the server HTML, so the card header never grows', () => {
    const html = renderToString(
      <ChartCard title="Card">
        <Lines ariaLabel="L" data={data} x={x} series={[a, b]} legend={{ placement: 'header' }} />
      </ChartCard>,
    )
    expect(html).toContain('data-legend-key="a"')
    expect(html.indexOf('data-basalt-chart-legend')).toBeLessThan(html.indexOf('ts-chart-host'))
  })
})

describe('the CSS height law mirrors resolveChartSize', () => {
  /** Evaluates `clamp(Npx, Mcqw, Kpx)` at a container width. */
  const evaluate = (value: string, width: number): number => {
    const m = /^clamp\((\d+)px, ([\d.]+)cqw, (\d+)px\)$/.exec(value)
    if (!m) return Number.parseFloat(value)
    return Math.min(Math.max((width * Number(m[2])) / 100, Number(m[1])), Number(m[3]))
  }
  const heightAt = (width: number): number => {
    const vars = chartBoxVars(undefined) as Record<string, string>
    const cls =
      width >= 800 ? 'wide' : width >= 480 ? 'regular' : width >= 240 ? 'compact' : 'micro'
    return evaluate(vars[`--bc-${cls}`] as string, width)
  }

  test.each([120, 200, 239, 240, 358, 479, 480, 640, 799, 800, 1248, 3000])(
    'width %ipx: the CSS law is the pixel law, to the rounding',
    (width) => {
      const px = resolveChartSize({ width, coarse: false, viewportH: 0 }).height
      expect(Math.abs(heightAt(width) - px)).toBeLessThanOrEqual(0.5)
    },
  )

  test('a stated height is the same at every class; a responsive one steps down to base', () => {
    expect(chartBoxVars(200) as Record<string, string>).toEqual({
      '--bc-micro': '200px',
      '--bc-compact': '200px',
      '--bc-regular': '200px',
      '--bc-wide': '200px',
    })
    expect(chartBoxVars({ base: 150, wide: 260 }) as Record<string, string>).toEqual({
      '--bc-micro': '150px',
      '--bc-compact': '150px',
      '--bc-regular': '150px',
      '--bc-wide': '260px',
    })
  })
})
