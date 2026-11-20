import type { ReactElement } from 'react'
import { StatCard } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import type { ScenarioProps } from '../../shot-state'
import { FrictionPanel } from './friction-panel'
import { NO_DATA, loadData } from './fixture'
import type { Reason } from './fixture'
import { IdleCard } from './idle-card'
import { doneShare, droppedShare, signed, summarise } from './summary'
import { CommitsCard, OUTCOMES, OutcomesCard, outcomeLine, weekReading } from './week-cards'

// cycle-expression-14: the kit ships no icon set, so the two strip glyphs are one-path svgs of the icon shape.
function glyph(d: string): (props: { className?: string }) => ReactElement {
  return function Glyph({ className }) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={d} />
      </svg>
    )
  }
}
const RiseGlyph = glyph('M3 17l6-6 4 4 8-8M15 7h6v6')
const DoneGlyph = glyph('M4 12l5 5L20 6')

const BASE = 'vs W46'

const LEDGER_DOWN = 'The factory ledger did not answer.'

const nowBefore = (r: Reason): string => `${r.now} now, ${r.prev} before`

/** A focused reason's reading, led by its name so the headline's name is never mistaken for it. */
const reasonReading = (r: Reason): string => [r.name, nowBefore(r)].join(', ')

// cycle-expression-14: the playground has no ledger to refetch, so the retry and the empty-state action are no-ops.
const reload = (): void => undefined

/** Which friction reason grew most, and does the week's work end done or dropped. */
export function ExprN65Scenario({ shotState, fixture }: ScenarioProps) {
  const data =
    shotState === 'loading' || shotState === 'error'
      ? undefined
      : shotState === 'empty'
        ? NO_DATA
        : loadData(fixture)
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: LEDGER_DOWN }
        : 'ready'
  const summary = data ? summarise(data) : undefined
  const loaded = data ?? NO_DATA
  const reasonFocus = useChartFocus(loaded.reasons, {
    announce: reasonReading,
  })
  const weekFocus = useChartFocus(loaded.weeks, {
    announce: outcomeLine,
  })
  const dayFocus = useChartFocus(loaded.days, {
    announce: (d) => `${d.key}: ${d.idle} h`,
  })

  const total = loaded.reasons.length
  const ofTotal = (n: number): string => `${n} of ${total}`
  const riserSub = reasonFocus.readout(summary ? nowBefore(summary.riser) : '', reasonReading)
  const riserDelta = {
    value: summary ? signed(summary.riser.change) : '',
    polarity: 'up-bad' as const,
    label: BASE,
  }
  const doneDelta = {
    value: summary ? `${signed(doneShare(summary.now) - doneShare(summary.before))} pts` : '',
    polarity: 'up-good' as const,
    label: BASE,
  }
  const doneStatus = {
    tone: 'bad' as const,
    label: summary ? `${droppedShare(summary.now)} % ${OUTCOMES[1]}` : '',
  }

  const doneSub = weekFocus.readout(
    summary ? `Best was ${doneShare(summary.bestShare)} % in ${summary.bestShare.id}` : '',
    (w) => weekReading(w, `${doneShare(w)} %`),
  )
  const riserFooter = [
    { label: 'Rising', value: summary ? ofTotal(summary.up) : '' },
    { label: 'Falling', value: summary ? ofTotal(summary.falling) : '' },
  ] as const
  const doneFooter = [{ label: 'Cancelled', value: summary ? summary.now.cancelled : '' }] as const

  return (
    <Page area="expr-n65">
      <PageBar
        title="Factory loop, week 47"
        {...(shotState === 'error'
          ? {
              refresh: {
                scope: 'page' as const,
                syncing: false,
                onSync: reload,
                error: LEDGER_DOWN,
              },
            }
          : {})}
      />
      <div className="grid gap-3">
        <div className="grid gap-3 @wide:grid-cols-2">
          <StatCard
            icon={RiseGlyph}
            title="Fastest riser"
            info="The friction reason that grew most since the previous report. Fewer is better."
            value={summary?.riser.name ?? null}
            delta={riserDelta}
            sub={riserSub}
            footer={riserFooter}
            phase={phase}
            empty={
              summary
                ? null
                : {
                    cause: 'Nothing reported yet.',
                    action: { label: 'Reload', onClick: reload },
                  }
            }
          />
          <StatCard
            icon={DoneGlyph}
            title="Done share"
            info="Of all Issues ended. Higher is better."
            value={summary ? doneShare(summary.now) : null}
            unit="%"
            delta={doneDelta}
            status={doneStatus}
            footer={doneFooter}
            sub={doneSub}
            phase={phase}
            empty={
              summary
                ? null
                : {
                    cause: 'No share until an outcome exists.',
                    action: { label: 'Reload', onClick: reload },
                  }
            }
          />
        </div>
        <div className="grid gap-3 @wide:grid-cols-2">
          <OutcomesCard data={data} summary={summary} phase={phase} focus={weekFocus} />
          <CommitsCard data={data} summary={summary} phase={phase} focus={weekFocus} />
          <FrictionPanel data={data} phase={phase} focus={reasonFocus} />
          <IdleCard data={data} summary={summary} phase={phase} focus={dayFocus} />
        </div>
        {reasonFocus.live}
      </div>
    </Page>
  )
}
