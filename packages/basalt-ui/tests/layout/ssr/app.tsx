/**
 * The page the SSR layout test server-renders and then hydrates: the same tree on both sides, so
 * any box that moves is moved by hydration itself. One probe per chart kind (default height law),
 * a `ChartCard` with a header legend, a pending `ChartCard` standing in for a streamed one, and
 * the loaded / `isLoading` table pair. Each probe is `[data-probe]`; PROBES lists them all.
 */
import { MantineProvider } from '@mantine/core'
import type { ReactElement } from 'react'
import { Bars } from '../../../src/charts/Bars'
import { BandStrip } from '../../../src/charts/BandStrip'
import { CartesianChart } from '../../../src/charts/CartesianChart'
import { ChartCard } from '../../../src/charts/ChartCard'
import { DualPanel } from '../../../src/charts/DualPanel'
import { Donut } from '../../../src/charts/Donut'
import { Heatmap } from '../../../src/charts/Heatmap'
import { Lines } from '../../../src/charts/Lines'
import { MirroredBars } from '../../../src/charts/MirroredBars'
import { Sparkline } from '../../../src/charts/Sparkline'
import { StackedArea } from '../../../src/charts/StackedArea'
import type { ChartSeries } from '../../../src/charts/types'
import { BasaltDataTable } from '../../../src/table/data-table'
import { createColumnHelper } from '../../../src/table/table-features'
import { createBasaltTheme, cssVariablesResolver } from '../../../src/theme'
import { ROW_COUNT } from './probes'

// ── table ─────────────────────────────────────────────────────────────────────────────────────

type TableRow = { project: string; owner: string; region: string; updated: string; cost: number }
const col = createColumnHelper<TableRow>()

const MIN_WIDTH = 720
const TABLE_ROWS: TableRow[] = Array.from({ length: ROW_COUNT }, (_, i) => ({
  project: `project-${i}`,
  owner: `owner-${i % 3}`,
  region: `eu-central-${i % 2}`,
  updated: `2026-10-${String(i + 1).padStart(2, '0')} 12:00 UTC`,
  cost: i * 37,
}))
const TABLE_COLUMNS = [
  col.accessor('project', { header: 'Project' }),
  col.accessor('owner', { header: 'Owner' }),
  col.accessor('region', { header: 'Region' }),
  col.accessor('updated', { header: 'Updated' }),
  col.accessor('cost', { header: 'Cost', meta: { align: 'right' } }),
]

// ── charts ────────────────────────────────────────────────────────────────────────────────────

type Row = { t: Date; a: number; b: number; v: number | null; up: number; down: number }
const day = (d: number): Date => new Date(Date.UTC(2026, 8, d))
const DATA: Row[] = Array.from({ length: 14 }, (_, i) => ({
  t: day(i + 1),
  a: 20 + i * 3,
  b: 60 - i * 2,
  v: i % 5 === 4 ? null : (i % 2 ? 1 : -1) * (i + 1),
  up: 5 + i,
  down: 2 + (i % 4),
}))
const x = (d: Row): Date => d.t
const A: ChartSeries<Row> = {
  key: 'a',
  label: 'Alpha',
  color: 'var(--vx-line)',
  getValue: (d) => d.a,
}
const B: ChartSeries<Row> = {
  key: 'b',
  label: 'Beta',
  color: 'var(--vx-accent)',
  getValue: (d) => d.b,
}

type Slot = { t: string; s: string }
const SLOTS: Slot[] = Array.from({ length: 24 }, (_, i) => ({
  t: `s${String(i).padStart(3, '0')}`,
  s: i % 5 === 0 ? 'down' : 'up',
}))

type Cell = { row: string; col: string; v: number | null }
const CELLS: Cell[] = ['Mon', 'Tue', 'Wed', 'Thu'].flatMap((row, r) =>
  Array.from({ length: 12 }, (_, c) => ({ row, col: String(c), v: (r + 1) * (c + 1) })),
)

function Probe({ name, children }: { name: string; children: ReactElement }): ReactElement {
  return <div data-probe={name}>{children}</div>
}

const theme = createBasaltTheme()

export function App(): ReactElement {
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="dark"
    >
      <main style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Probe name="lines">
          <Lines ariaLabel="Lines" data={DATA} x={x} series={[A, B]} />
        </Probe>
        <Probe name="lines-no-legend">
          <Lines ariaLabel="Lines" data={DATA} x={x} series={[A]} legend={false} />
        </Probe>
        <Probe name="bars">
          <Bars
            ariaLabel="Bars"
            data={DATA}
            x={(d) => d.t.toISOString()}
            bars={[{ key: 'a', label: 'Alpha', color: 'var(--vx-line)', getValue: (d) => d.a }]}
          />
        </Probe>
        <Probe name="stacked-area">
          <StackedArea ariaLabel="Stacked" data={DATA} x={x} series={[A, B]} />
        </Probe>
        <Probe name="sparkline">
          <Sparkline ariaLabel="Spark" data={DATA.map((d) => d.a)} height={32} />
        </Probe>
        <Probe name="band-strip">
          <BandStrip
            ariaLabel="Availability"
            data={SLOTS}
            x={(d) => d.t}
            states={[
              { key: 'up', label: 'Up', color: 'var(--vx-good)' },
              { key: 'down', label: 'Down', color: 'var(--vx-bad)' },
            ]}
            getBand={(d) => ({ state: d.s })}
          />
        </Probe>
        <Probe name="donut">
          <Donut
            ariaLabel="Split"
            data={[
              { key: 'a', value: 30 },
              { key: 'b', value: 20 },
              { key: 'c', value: 10 },
            ]}
            colorForKey={(k) => (k === 'a' ? 'var(--vx-line)' : 'var(--vx-accent)')}
            formatValue={String}
            centerLabel="60"
          />
        </Probe>
        <Probe name="heatmap">
          <Heatmap
            ariaLabel="Heat"
            data={CELLS}
            getRow={(d) => d.row}
            getCol={(d) => d.col}
            getValue={(d) => d.v}
          />
        </Probe>
        <Probe name="heatmap-fill">
          <div style={{ height: 300 }}>
            <Heatmap
              ariaLabel="Heat"
              data={CELLS}
              getRow={(d) => d.row}
              getCol={(d) => d.col}
              getValue={(d) => d.v}
              matchHeight
            />
          </div>
        </Probe>
        <Probe name="dual-panel">
          <DualPanel
            ariaLabel="Divergence"
            data={DATA}
            x={x}
            series={[A, { ...B, dash: 'dashed' }]}
            bar={{
              label: 'Divergence',
              getValue: (d) => d.v,
              positive: 'var(--vx-good)',
              negative: 'var(--vx-bad)',
              format: (v) => `${v}%`,
            }}
          />
        </Probe>
        <Probe name="mirrored-bars">
          <MirroredBars
            ariaLabel="Throughput"
            data={DATA}
            x={x}
            series={[
              { key: 'down', label: 'Download', color: 'var(--vx-line)', getValue: (d) => d.down },
              { key: 'up', label: 'Upload', color: 'var(--vx-accent)', getValue: (d) => d.up },
            ]}
            up={{ key: 'up', format: (v) => `${v} kB` }}
            down={{ key: 'down', format: (v) => `${v} MB` }}
          />
        </Probe>
        <Probe name="cartesian-chart">
          <CartesianChart ariaLabel="Rung" data={DATA} x={x} series={[A]} marks={() => []} />
        </Probe>
        <Probe name="lines-fixed-height">
          <Lines ariaLabel="Fixed" data={DATA} x={x} series={[A, B]} height={200} />
        </Probe>
        <Probe name="lines-responsive-height">
          <Lines
            ariaLabel="Responsive"
            data={DATA}
            x={x}
            series={[A, B]}
            height={{ base: 180, regular: 240, wide: 300 }}
          />
        </Probe>
        <Probe name="card-header-legend">
          <ChartCard title="Header legend" info="Two series">
            <Lines
              ariaLabel="Card"
              data={DATA}
              x={x}
              series={[A, B]}
              legend={{ placement: 'header' }}
            />
          </ChartCard>
        </Probe>
        <Probe name="card-kpi">
          <ChartCard
            title="Revenue"
            subtitle="Last 14 days"
            info="Net of refunds"
            value="$12.4k"
            delta={4.2}
            deltaPeriod="vs prior"
          >
            <Lines ariaLabel="Revenue" data={DATA} x={x} series={[A]} legend={false} />
          </ChartCard>
        </Probe>
        <Probe name="card-short-chart">
          <ChartCard
            title="Revenue"
            subtitle="Short card subtitle"
            info="Net of refunds"
            value="$12.4k"
            delta={4.2}
            deltaPeriod="vs prior"
          >
            <Lines ariaLabel="Short" data={DATA} x={x} series={[A]} legend={false} height={120} />
          </ChartCard>
        </Probe>
        <Probe name="card-loaded">
          <ChartCard title="Streamed section">
            <Lines ariaLabel="Card" data={DATA} x={x} series={[A]} legend={false} />
          </ChartCard>
        </Probe>
        <Probe name="card-fallback">
          <ChartCard title="Streamed section" state={{ pending: true }}>
            <Lines ariaLabel="Card" data={DATA} x={x} series={[A]} legend={false} />
          </ChartCard>
        </Probe>
        <Probe name="lines-pending">
          <Lines
            ariaLabel="Pending"
            data={DATA}
            x={x}
            series={[A]}
            legend={false}
            state={{ pending: true }}
          />
        </Probe>
        <Probe name="table-loaded">
          <BasaltDataTable data={TABLE_ROWS} columns={TABLE_COLUMNS} minWidth={MIN_WIDTH} />
        </Probe>
        <Probe name="table-fallback">
          <BasaltDataTable
            data={TABLE_ROWS}
            columns={TABLE_COLUMNS}
            isLoading
            skeletonRows={ROW_COUNT}
            minWidth={MIN_WIDTH}
          />
        </Probe>
      </main>
    </MantineProvider>
  )
}
