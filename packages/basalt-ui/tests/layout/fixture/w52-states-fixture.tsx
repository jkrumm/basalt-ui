import type { ReactElement } from 'react'
import type { ChartState } from '../../../src/charts/types'
import { ChartCard } from '../../../src/charts/ChartCard'
import { RetryButton } from '../../../src/common/retry-button'
import { BarList } from '../../../src/dashboard/bar-list'
import { EventList } from '../../../src/dashboard/event-list'
import { Meter } from '../../../src/dashboard/meter'
import { Section } from '../../../src/dashboard/section'
import { StatGroup } from '../../../src/dashboard/stat-group'
import type { QueryStateLike } from '../../../src/dashboard/query-state'
import { VX } from '../../../src/tokens'

const NOW = new Date(2026, 2, 20, 18, 0)

const result = (loaded: boolean): QueryStateLike<unknown> => ({
  data: loaded ? { ok: true } : undefined,
  isError: false,
  error: null,
  fetchStatus: loaded ? 'idle' : 'fetching',
  refetch: () => undefined,
})

const BARS = Array.from({ length: 10 }, (_, i) => ({
  key: `b${i}`,
  label: `project ${i}`,
  value: 100 - i * 8,
  secondary: `${100 - i * 8}%`,
}))

const EVENTS = Array.from({ length: 9 }, (_, i) => ({
  id: `e${i}`,
  at: new Date(NOW.getTime() - i * 3_600_000),
  actor: 'Ada',
  title: `step ${i}`,
}))

/** The same figure loaded and pending inside a `Section`, each at `data-testid="w52-sec-<kind>-<loaded|loading>"`. */
function figure(kind: string, loaded: boolean): ReactElement {
  if (kind === 'bar')
    return (
      <BarList
        label="Spend"
        items={loaded ? BARS : []}
        {...(!loaded && { loadingRows: BARS.length })}
      />
    )
  if (kind === 'events')
    return (
      <EventList
        label="Events"
        now={NOW}
        items={loaded ? EVENTS : []}
        {...(!loaded && { loadingRows: EVENTS.length })}
      />
    )
  return <Meter label="Low" value={loaded ? 40 : null} min={0} max={100} />
}

/** Wave 54: a lone figure in a `ChartCard` with no `placeholderHeight`, at rest and in each state. */
const W54_STATES: readonly (readonly [string, ChartState | undefined])[] = [
  ['loaded', undefined],
  ['pending', { pending: true }],
  ['empty', { empty: 'Nothing here' }],
  ['error', { error: new Error('The request failed.') }],
]

const kg = (v: number): string => `${v.toFixed(1)} kg`

/** Wave 52: Section loading shape, one empty box, Retry as a control, the start caption's place. */
export function W52StatesFixture(): ReactElement {
  return (
    <div style={{ display: 'grid', gap: 16, padding: 16, maxWidth: 900 }}>
      {['bar', 'events', 'meter'].flatMap((kind) =>
        [true, false].map((loaded) => (
          <div
            key={`${kind}-${loaded}`}
            data-testid={`w52-sec-${kind}-${loaded ? 'loaded' : 'loading'}`}
          >
            <Section title="Section" query={result(loaded)}>
              {figure(kind, loaded)}
            </Section>
          </div>
        )),
      )}
      {['bar', 'events', 'meter'].flatMap((kind) =>
        [true, false].map((loaded) => (
          <div
            key={`card-${kind}-${loaded}`}
            data-testid={`w53-card-${kind}-${loaded ? 'loaded' : 'loading'}`}
          >
            <ChartCard
              title="Card"
              placeholderHeight="content"
              {...(!loaded && { state: { pending: true } })}
            >
              {figure(kind, true)}
            </ChartCard>
          </div>
        )),
      )}
      {['bar', 'events', 'meter'].flatMap((kind) =>
        W54_STATES.map(([name, state]) => (
          <div key={`w54-${kind}-${name}`} data-testid={`w54-card-${kind}-${name}`}>
            <ChartCard title="Card" state={state}>
              {figure(kind, true)}
            </ChartCard>
          </div>
        )),
      )}
      <div data-testid="w52-empty-meter">
        <Meter label="Low" value={null} emptyText="Not worn" />
      </div>
      <div data-testid="w52-empty-bar">
        <BarList label="Spend" items={[]} emptyText="Not worn" />
      </div>
      <div data-testid="w52-retry-bg" style={{ background: VX.surface.bg, padding: 16 }}>
        <RetryButton onClick={() => {}} />
      </div>
      <div data-testid="w52-retry-panel" style={{ background: VX.surface.panel, padding: 16 }}>
        <RetryButton onClick={() => {}} />
      </div>
      <div data-testid="w52-start" style={{ width: 'min(100%, 520px)' }}>
        <StatGroup
          variant="strip"
          label="Body"
          cols={2}
          cells={[
            {
              key: 'weight',
              caption: 'Weight spread',
              value: kg(4.4),
              visual: (
                <Meter
                  label="Current weight within the lowest and highest weigh-in"
                  value={75}
                  min={71.8}
                  max={76.2}
                  format={kg}
                  readingAt="start"
                  stops={[
                    { at: 71.8, color: VX.line },
                    { at: 76.2, color: VX.line },
                  ]}
                  startCaption={`60-day low ${kg(71.8)}`}
                  endCaption={`60-day high ${kg(76.2)}`}
                  tone="muted"
                />
              ),
            },
            { key: 'fat', caption: 'Body fat', value: '18', unit: '%' },
          ]}
        />
      </div>
    </div>
  )
}
