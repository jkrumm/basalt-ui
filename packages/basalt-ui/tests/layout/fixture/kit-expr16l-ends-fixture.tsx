import { createRoot } from 'react-dom/client'
import { Lines } from '../../../src/charts/parts/lines'
import { ChartCard } from '../../../src/charts/parts/chart-card'

const C = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
  light: `var(--basalt-chart-${n})`,
  dark: `var(--basalt-chart-${n})`,
}))

type Row = { window: string } & Record<string, number | string>
const WINDOWS = ['Oct 24–30', 'Oct 31–Nov 6', 'Nov 7–13', 'Nov 14–20']
// Eight classes converging on the plot's right edge, one of them surging off the axis (n79 `?fixture=surge`).
const COUNTS: Record<string, [string, readonly number[]]> = {
  lint: ['Lint', [15, 10, 7, 6]],
  types: ['Type errors', [12, 11, 8, 6]],
  build: ['Build config', [9, 7, 5, 4]],
  deps: ['Dependency bumps', [8, 7, 5, 4]],
  deploy: ['Deploy scripts', [6, 4, 3, 3]],
  docs: ['Docs drift', [5, 4, 3, 2]],
  migration: ['Migrations', [0, 0, 0, 0]],
  flaky: ['Flaky tests', [4, 3, 3, 38]],
}
const DATA: Row[] = WINDOWS.map((window, i) => ({
  window,
  ...Object.fromEntries(Object.entries(COUNTS).map(([key, [, v]]) => [key, v[i] as number])),
}))

function Probe() {
  return (
    <div data-testid="x16-ends" className="min-w-0">
      <ChartCard
        title="Fixes per class"
        height="tall"
        chart={(box) => (
          <Lines
            label="Four points per line, one line each"
            height={box.height}
            data={DATA}
            x={{ value: (d) => d.window as string }}
            y={{ title: 'Count', domain: ([lo, hi]) => [lo, Math.min(hi, 20)] }}
            naming="endLabels"
            series={Object.entries(COUNTS).map(([key, [label]], i) => ({
              mark: 'line' as const,
              key,
              label,
              color: C[i]!,
              y: (d: Row) => d[key] as number,
            }))}
          />
        )}
      />
    </div>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(
  <main className="flex max-w-[1100px] min-w-0 flex-col gap-6 p-4 text-foreground">
    <Probe />
  </main>,
)
