/**
 * The `charts-seam-track` fixture (`v3-expr-2-seam-tracks`): a waterfall drawn on an HTML track
 * through the geometry seam, inside the v3 `ChartCard` with a legend row for its marks. The axis is
 * `chartLabels.axis`, each row's duration label and gridlines are `chartLabels.row`, and focus is
 * `useChartFocus`. Entry of `charts-seam-track.layout.test.ts`, which bundles it in memory; the
 * harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 *
 * Probes: `st-card` (the card), `[data-track]` (each row's track), `[data-axis]` (the tick row).
 */
import { createRoot } from 'react-dom/client'
import { chartLabels } from '../../../src/charts/chart-labels'
import { useChartFocus } from '../../../src/charts/focus'
import { ChartCard } from '../../../src/charts/parts/chart-card'

type Span = { name: string; start: number; ms: number }
const SPANS: readonly Span[] = [
  { name: 'plan', start: 0, ms: 420 },
  { name: 'search docs', start: 420, ms: 1180 },
  { name: 'read files', start: 1600, ms: 310 },
  { name: 'call model', start: 1910, ms: 5480 },
  { name: 'write patch', start: 7390, ms: 560 },
  { name: 'verify', start: 7950, ms: 170 },
]
const RUN = 8120
const seconds = (ms: number): string => `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 2)} s`
/** The track is three quarters of the fixture's own `@container`, less the column gap. */
const SHARE = 0.7
const blue = { light: '#0b6bcb', dark: '#5aa9f0' }
const red = { light: '#b42318', dark: '#f97066' }

function Waterfall() {
  const focus = useChartFocus(SPANS, { announce: (s) => `${s.name}: ${seconds(s.ms)}` })
  const axis = chartLabels.axis({ domain: [0, RUN], format: seconds, share: SHARE })
  return (
    <div className="@container">
      <div className="grid grid-cols-[1fr_3fr] gap-x-2 text-xs">
        <span />
        <div data-axis="" className="relative h-4">
          {axis.ticks.map((t) => (
            <span key={t.at} data-tick="" {...t.label}>
              {t.text}
            </span>
          ))}
        </div>
      </div>
      <div {...focus.target} aria-label="Spans of the run" className="flex flex-col">
        {SPANS.map((s, i) => {
          const from = axis.at(s.start)
          const to = axis.at(s.start + s.ms)
          const row = chartLabels.row([{ key: s.name, text: seconds(s.ms), from, to }], {
            share: SHARE,
            grid: axis.ticks,
          })
          return (
            <div
              key={s.name}
              {...focus.item(i)}
              className="grid grid-cols-[1fr_3fr] items-center gap-x-2 py-0.5 text-xs"
            >
              <span className="truncate">{s.name}</span>
              <div data-track="" className="relative h-5">
                {row.lines.map((t) => (
                  <span key={t.at} data-gridline="" {...t.line} />
                ))}
                <div
                  className="absolute inset-y-0.5 rounded-sm bg-dim-bar"
                  style={{ left: `${from * 100}%`, width: `${(to - from) * 100}%` }}
                />
                {row.placed.map((l) => (
                  <span
                    key={l.key}
                    data-row-label=""
                    {...l.props}
                    className={`${l.props.className} data-[spot=inside]:text-on-brand`}
                  >
                    {l.text}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {focus.live}
    </div>
  )
}

function Fixture() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <div data-testid="st-card">
        <ChartCard
          title="One slow agent run"
          legend={[
            { key: 'step', label: 'step', color: blue, swatch: 'bar' },
            { key: 'slow', label: 'slowest', color: blue, swatch: 'hollow' },
            { key: 'notice', label: 'notice', color: red, swatch: 'dot' },
            { key: 'closed', label: 'closed', color: red, swatch: 'ring' },
          ]}
          chart={() => <Waterfall />}
        />
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
