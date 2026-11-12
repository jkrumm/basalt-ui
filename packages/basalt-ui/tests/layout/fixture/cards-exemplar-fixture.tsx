import type { ReactElement } from 'react'
import { StatCard } from '../../../src/cards/stat-card'
import type { StatCardProps } from '../../../src/cards/contract'
import type { ControlsSlot } from '../../../src/core/ports'

const GLYPH = (props: { className?: string }): ReactElement => (
  <svg viewBox="0 0 16 16" className={props.className} fill="none" aria-hidden="true">
    <circle cx="4" cy="4" r="1.75" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="1.75" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4 6v3a3 3 0 0 0 3 3h3" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const RANGE: ControlsSlot = {
  kind: 'controls-slot',
  count: 1,
  render: () => (
    <button
      type="button"
      data-testid="cx-range"
      className="h-ctl rounded-ctrl bg-secondary px-2 text-xs shadow-raised"
    >
      Last 7 days
    </button>
  ),
}

const INFO = 'Pull requests merged into the default branch in the selected range.'

/** One anatomy for every probe: tile, title, info, subtitle, figure, delta, sub, chart box, footer. */
const FULL = {
  icon: GLYPH,
  title: 'Shipped',
  subtitle: 'vs last week',
  info: INFO,
  value: 388,
  delta: { value: '+12%', polarity: 'up-good' },
  sub: 'Most since March',
  footer: [
    { label: 'Open', value: 12 },
    { label: 'Merged', value: 4 },
  ],
  controls: RANGE,
  chart: (box) => (
    <div
      data-testid="cx-chart-fill"
      className="h-full w-full bg-selected"
      data-box-height={String(box.height)}
      data-box-phase={box.phase}
    />
  ),
} satisfies StatCardProps

const { sub: _sub, chart: _chart, ...PLAIN } = FULL

/** The four anatomies: which of the sub line and the chart box a card declares. */
const ANATOMIES = {
  plain: PLAIN,
  sub: { ...PLAIN, sub: FULL.sub },
  chart: { ...PLAIN, chart: FULL.chart },
  both: FULL,
} satisfies Record<string, StatCardProps>

const PHASED: Record<string, Partial<StatCardProps>> = {
  ready: {},
  loading: { phase: 'loading' },
  // A failed refetch: the data stays, with the long "Could not refresh" line.
  stale: { phase: { isPending: false, isError: true, isRefetchError: true, error: null } },
  empty: {
    empty: { cause: 'No merges in this range', action: { label: 'Widen range', href: '#r' } },
  },
  error: { phase: { tag: 'error', retry: () => undefined } },
}

/**
 * `cards-exemplar` probes (docs/v3/concepts/charts-cards-kanban.md S8), each in a `data-testid` box:
 * - `cx-<ready|loading|stale|empty|error>`: one card in each phase, same props;
 * - `cx-<anatomy>-<phase>`: every anatomy (`plain`, `sub`, `chart`, `both`) in every phase, the
 *   stale one with the long refresh-failed line;
 * - `cx-narrow`, `cx-wide`: controls at 360 px (wraps) and 560 px (inline), around `@regular`;
 * - `cx-greedy`: a chart slot that ignores `box.height` and asks for twice the box;
 * - `cx-link`: a stretched-link card, the focus-ring probe;
 * - `cx-bare`: no icon, no chart, no sub, one fact (the `hero-stats` shape).
 */
export function CardsExemplarFixture(): ReactElement {
  return (
    // theme-allow -- the wrappers are the probe's payload (cards at stated container widths)
    <div className="flex flex-col gap-6 p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] items-start gap-4">
        <div data-testid="cx-ready">
          <StatCard {...FULL} />
        </div>
        <div data-testid="cx-loading">
          <StatCard {...FULL} phase="loading" />
        </div>
        <div data-testid="cx-stale">
          <StatCard {...FULL} phase="stale" />
        </div>
        <div data-testid="cx-empty">
          <StatCard {...FULL} empty={{ cause: 'No merges in this range' }} />
        </div>
        <div data-testid="cx-error">
          <StatCard {...FULL} phase={{ tag: 'error', retry: () => undefined }} />
        </div>
      </div>
      {Object.entries(ANATOMIES).map(([anatomy, props]) => (
        <div
          key={anatomy}
          className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] items-start gap-4"
        >
          {Object.entries(PHASED).map(([phase, phased]) => (
            <div key={phase} data-testid={`cx-${anatomy}-${phase}`}>
              <StatCard {...props} {...phased} />
            </div>
          ))}
        </div>
      ))}
      <div data-testid="cx-narrow" className="w-90 max-w-full">
        <StatCard {...FULL} />
      </div>
      <div data-testid="cx-wide" className="w-140 max-w-full">
        <StatCard {...FULL} />
      </div>
      <div data-testid="cx-greedy" className="w-90 max-w-full">
        <StatCard
          {...FULL}
          chart={() => <div data-testid="cx-greedy-slot" className="h-36 bg-selected" />}
        />
      </div>
      <div data-testid="cx-link" className="w-90 max-w-full">
        <StatCard {...FULL} href="#shipped" />
      </div>
      <div data-testid="cx-bare" className="w-90 max-w-full">
        <StatCard title="Open" value={null} footer={[{ label: 'Merged', value: 4 }]} />
      </div>
    </div>
  )
}
