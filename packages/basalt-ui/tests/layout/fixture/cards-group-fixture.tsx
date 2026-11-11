/**
 * The `cards-group` fixture (docs/v3/issues/g1/v3-cards-1-statgroup.json): `StatGroup`, `StatCell`
 * and `DataPanel` on their own markup, no shell and no provider. It is the entry the `cards-group`
 * layout test bundles; the harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 *
 * Probes, each a `data-testid` box around one composite:
 * - `cg-strip-<ready|loading|stale|empty|error|forbidden|not-found|throw>`: the same six cells in a
 *   strip, one phase per strip (`throw` is a chart slot that throws);
 * - `cg-strip-230`: the six ready cells in a strip 1532 px wide, so each is 230 px, inside a
 *   horizontal scroller so the page does not widen;
 * - `cg-cards`, `cg-cards-one`: the cards variant with five cells and with one;
 * - `cg-panel-<ready|loading|stale|empty|error|forbidden|not-found|throw>`: one panel per phase,
 *   `throw` being a body slot that throws.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { StatCell } from '../../../src/cards/stat-cell'
import { StatGroup } from '../../../src/cards/stat-group'
import type { StatCellElement } from '../../../src/cards/stat-group'
import type { StatCellProps } from '../../../src/cards/stat-cell'
import type { DataPanelProps } from '../../../src/cards/contract'

const PROBES = [
  'ready',
  'loading',
  'stale',
  'empty',
  'error',
  'forbidden',
  'not-found',
  'throw',
] as const
type Probe = (typeof PROBES)[number]

const retry = (): undefined => undefined

const phaseOf = (probe: Probe): Pick<StatCellProps, 'phase' | 'empty'> => {
  if (probe === 'loading' || probe === 'stale') return { phase: probe }
  if (probe === 'error') return { phase: { tag: 'error', retry } }
  if (probe === 'forbidden') return { phase: { tag: 'error', kind: 'forbidden' } }
  if (probe === 'not-found') return { phase: { tag: 'error', kind: 'not-found', retry } }
  if (probe === 'empty') return { empty: { cause: 'No readings in this range' } }
  return {}
}

const sparkline = (height: number | 'fill'): ReactElement => (
  <svg width="100%" height={height === 'fill' ? 28 : height} aria-hidden="true">
    <polyline
      points="0,20 40,12 80,16 120,6 160,10 200,4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
)

const boom = (): ReactElement => {
  throw new Error('the slot threw')
}

/** Six 230 px cells, incl. argo's recovery cell (meter, qualifier, definition and three rows). */
const cells = (probe: Probe): StatCellElement[] => {
  const phase = phaseOf(probe)
  const chart =
    probe === 'throw' ? boom : (box: { height: number | 'fill' }) => sparkline(box.height)
  return [
    <StatCell
      key="down"
      label="Downstream"
      value={412}
      unit="Mbit/s"
      delta={{ value: '+3%', polarity: 'up-good' }}
      sub="Measured 06:40"
      {...phase}
    />,
    <StatCell key="up" label="Upstream" value={44} unit="Mbit/s" {...phase} />,
    <StatCell
      key="recovery"
      label="Recovery"
      qualifier="7 day"
      info="Readiness from sleep and training load."
      value={82}
      unit="%"
      status={{ tone: 'good', label: 'Optimal' }}
      meter={{
        label: 'Recovery',
        value: 82,
        max: 100,
        zones: [
          { to: 40, tone: 'bad', label: 'Low' },
          { to: 70, tone: 'warn', label: 'Fair' },
          { to: 100, tone: 'good', label: 'Optimal' },
        ],
      }}
      rows={[
        { label: 'HRV', value: '64 ms' },
        {
          label: 'Resting heart rate',
          value: '48 bpm',
          delta: { value: '-2', polarity: 'up-bad' },
        },
        { label: 'Sleep debt', value: '0.4 h', bar: { value: 0.4, max: 8 } },
      ]}
      sub="Updated 06:40"
      href="#recovery"
      {...phase}
    />,
    <StatCell
      key="sleep"
      label="Sleep, with a label long enough to need truncating"
      value="7 h 12 m"
      chart={chart}
      sub="Last night"
      onSelect={() => undefined}
      {...phase}
    />,
    <StatCell
      key="strain"
      label="Strain"
      value={14.2}
      rows={[
        { label: 'Mon', value: 12 },
        { label: 'Tue', value: 15 },
        { label: 'Wed', value: 9 },
        { label: 'Thu', value: 18 },
      ]}
      {...phase}
    />,
    <StatCell key="load" label="Load" value={null} {...phase} />,
  ]
}

const panelProps = (probe: Probe): DataPanelProps => ({
  title: 'Open pull requests',
  subtitle: 'by age',
  info: 'Pull requests with no merge yet.',
  skeleton: { rows: 5 },
  body:
    probe === 'throw'
      ? boom
      : (box) => (
          <ul className="m-0 list-none p-0" style={{ height: box.height }}>
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex h-8 items-center text-sm">{`Pull request ${i + 1}`}</li>
            ))}
          </ul>
        ),
  ...phaseOf(probe),
})

function Fixture(): ReactElement {
  return (
    // theme-allow -- the wrappers are the probe's payload (composites in a responsive page)
    <main lang="en" className="flex flex-col gap-6 p-4 text-foreground">
      {PROBES.map((probe) => (
        <div key={probe} data-testid={`cg-strip-${probe}`}>
          <StatGroup variant="strip" label="Link health">
            {cells(probe)}
          </StatGroup>
        </div>
      ))}
      <div
        // The scroller is a keyboard stop (axe: scrollable-region-focusable) and is named.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="region"
        aria-label="A strip wider than the page"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className="overflow-x-auto focus-ring"
      >
        <div data-testid="cg-strip-230" className="w-[1532px]">
          <StatGroup variant="strip" label="Link health, 230 px">
            {cells('ready')}
          </StatGroup>
        </div>
      </div>
      <div data-testid="cg-cards">
        <StatGroup variant="cards" label="Link health cards">
          {cells('ready').slice(0, 5)}
        </StatGroup>
      </div>
      <div data-testid="cg-cards-one">
        <StatGroup variant="cards" label="One card">
          <StatCell label="Downstream" value={412} unit="Mbit/s" />
        </StatGroup>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] items-start gap-4">
        {PROBES.map((probe) => (
          <div key={probe} data-testid={`cg-panel-${probe}`}>
            <DataPanel {...panelProps(probe)} />
          </div>
        ))}
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
