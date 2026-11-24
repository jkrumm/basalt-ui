/**
 * Lift balance (scenario expr-n92): are the four lift pairs inside their healthy ranges, and which
 * sits furthest out. A `StatCard` answers both clauses; a `DataPanel` holds one zoned `Meter` per
 * pair, the furthest first, so the verdict is a word under the marker and not a color.
 */
import type { ReactElement } from 'react'
import { DataPanel, StatCard } from 'basalt-ui/cards'
import type { Empty, FootFacts, Phase } from 'basalt-ui/cards'
import { Page, PageBar } from 'basalt-ui/page'
import { useFormat } from 'basalt-ui'
import { Meter } from 'basalt-ui/ui/meter'
import type { ScenarioProps } from '../../shot-state'
import {
  BORDERLINE,
  IMBALANCED,
  NO_LIFTS,
  liftsLogged,
  liftsOf,
  pairsOf,
  type Pair,
  type PairState,
} from './fixture'

type Zones = NonNullable<Parameters<typeof Meter>[0]['zones']>

const WORD: Record<PairState, string> = {
  balanced: 'Balanced',
  borderline: 'Borderline',
  imbalanced: 'Imbalanced',
  critical: 'Critical',
}

const named = (state: PairState, side: 'below' | 'above'): string => `${WORD[state]}, ${side}`

/** A row's zones from its range: three bands past each end, widening by the two state limits. */
function zonesOf([lo, hi]: readonly [number, number]): { min: number; max: number; zones: Zones } {
  const below = (limit: number): number => lo * (1 - limit)
  const above = (limit: number): number => hi * (1 + limit)
  return {
    min: lo * 0.5,
    max: hi * 1.5,
    zones: [
      { to: below(IMBALANCED), tone: 'bad', label: named('critical', 'below') },
      { to: below(BORDERLINE), tone: 'bad', label: named('imbalanced', 'below') },
      { to: lo, tone: 'warn', label: named('borderline', 'below') },
      { to: hi, tone: 'neutral', label: WORD.balanced },
      { to: above(BORDERLINE), tone: 'warn', label: named('borderline', 'above') },
      { to: above(IMBALANCED), tone: 'bad', label: named('imbalanced', 'above') },
      { to: Infinity, tone: 'bad', label: named('critical', 'above') },
    ],
  }
}

const EMPTY: Empty = {
  cause: 'Fewer than two lifts, log another.',
}

const FAILED: Phase = {
  tag: 'error',
  message: 'The lift log did not answer.',
  retry: () => undefined,
}

/** The two footer facts; the values are empty until the data is ready. */
const footOf = (logged: number | '', unmeasured: number | ''): FootFacts => [
  { label: 'Lifts logged', value: logged === '' ? '' : `${logged} of 4` },
  { label: 'Not measured', value: unmeasured },
]

function PairRow({ pair }: { pair: Pair }): ReactElement {
  const f = useFormat()
  const two = { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  const [lo, hi] = pair.range
  const { min, max, zones } = zonesOf(pair.range)
  return (
    <li className="flex list-none flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-medium">{pair.name}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {f.number(lo, two)}–{f.number(hi, two)}
        </span>
      </div>
      {pair.ratio === null ? (
        <p className="m-0 min-h-7 text-xs text-muted-foreground">{pair.gap}</p>
      ) : (
        <Meter
          label={pair.name}
          value={pair.ratio}
          min={min}
          max={max}
          zones={zones}
          format={(v) => f.number(v, two)}
        />
      )}
    </li>
  )
}

export function ExprN92Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const f = useFormat()
  const phase: Phase | undefined =
    shotState === 'loading' ? 'loading' : shotState === 'error' ? FAILED : undefined
  const lifts = shotState === 'empty' ? NO_LIFTS : liftsOf(fixture)
  const comparable = liftsLogged(lifts) >= 2
  const pairs = pairsOf(lifts)
  const empty = comparable ? null : EMPTY
  const ready = phase === undefined && comparable

  const measured = pairs.filter((p) => p.ratio !== null)
  const balanced = measured.filter((p) => p.state === 'balanced').length
  const worst = measured[0]
  const reach =
    worst === undefined || worst.side === null
      ? 'Every measured pair is inside its range'
      : `Furthest out: ${worst.name}, ${f.percent(worst.miss)} ${worst.side === 'below' ? 'under' : 'over'} ${f.number(
          worst.side === 'below' ? worst.range[0] : worst.range[1],
          { minimumFractionDigits: 2, maximumFractionDigits: 2 },
        )}`

  return (
    <Page area="lift-balance">
      <PageBar title="Lift balance" />
      <div className="grid items-stretch gap-3 p-3 @wide:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
        <StatCard
          title="Balanced pairs"
          subtitle="Best lifts, healthy range"
          info="Borderline is up to 15% past an end, imbalanced up to 30% and critical beyond. More balanced is better."
          value={ready ? balanced : null}
          unit={ready ? `of ${measured.length}` : ''}
          sub={ready ? reach : ''}
          footer={
            ready ? footOf(liftsLogged(lifts), pairs.length - measured.length) : footOf('', '')
          }
          phase={phase}
          empty={empty}
        />
        <DataPanel
          title="Pair ratios"
          subtitle="Best lift over best lift, widest miss first"
          phase={phase}
          empty={empty}
          bodySize={{ height: 256 }}
          body={() => (
            <ul className="m-0 flex flex-col gap-3 p-0">
              {pairs.map((pair) => (
                <PairRow key={pair.id} pair={pair} />
              ))}
            </ul>
          )}
        />
      </div>
    </Page>
  )
}
