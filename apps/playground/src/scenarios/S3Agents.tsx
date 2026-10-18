/**
 * S3 — Agent work (stands for argo warden and agents). docs/waves/design-parity/SPEC.md § 2.
 *
 *   Question: What needs me, and what is stuck?
 *   Decision: Approve, reassign or leave it.
 *
 * One strip reads the queue (needs-you, oldest wait, fleet by state, dispatch spend, failures) with
 * warden's budget meters as its footer; a ranked list of the stuck items and the open/close flow
 * sit below. Actions are inert in fixtures.
 *
 * Anchors for `basalt-ui shot`: strip cells carry their own `data-shot` (`strip-needs-you`,
 * `strip-oldest-wait`, `strip-fleet`, `strip-dispatch-spend`, `strip-failures`; footer meters
 * `strip-footer-day` / `strip-footer-week`, declared absent in empty and error, where each cell says
 * why through its own `state`); `ChartCard` does not forward `data-*`, so those anchors are wrapping `Box`es.
 */
import { Box, Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import { BarList, DeltaBadge, Meter, PageBar, StatGroup, StatusVerdict } from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { ChartCard, Lines, Sparkline } from 'basalt-ui/charts'
import type { ChartSeries } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
import { demoColors } from '../demo/series'
import {
  ABANDON_HOURS,
  BUDGETS,
  DISPATCH_COMPLETE_DAYS,
  FAILURES_24H,
  FAILURES_BY_HOUR,
  FAILURES_LATEST_LABEL,
  FLEET,
  FLEET_TOTAL,
  FLOW,
  FLOW_CLOSED,
  FLOW_OPENED,
  FLOW_RANGE_LABEL,
  NEEDS_YOU,
  NEEDS_YOU_TREND,
  OLDEST_WAIT_HOURS,
  STUCK,
  WARN_HOURS,
  fmtAge,
} from './agents-data'
import type { FlowRow, ItemState } from './agents-data'
import { fmtEur, fmtInt } from './fixture-utils'
import { cardStateProps, chartStateFor, noop, retryCopy } from './shot-state'
import type { ScenarioProps } from './shot-state'

const WARDEN_EMPTY = 'No agent work in the queue. Dispatch an item to start.'
const retry = (what: string): string => retryCopy(what, 'warden')

/** Body height of the error placeholder for the BarList card, so a failed card stays near its size. */
const STUCK_PLACEHOLDER = 190

const SPARK_HEIGHT = 28

const STATE_COLOR: Record<ItemState, string> = {
  awaiting: VX.status.warn,
  running: demoColors.sessions,
  queued: VX.faint,
  blocked: VX.status.bad,
}

const FLOW_SERIES: ChartSeries<FlowRow>[] = [
  {
    key: 'opened',
    label: 'Opened',
    color: demoColors.sessions,
    getValue: (d) => d.opened,
    formatValue: (v) => `${fmtInt(v)} opened`,
  },
  {
    key: 'closed',
    label: 'Closed',
    color: demoColors.signups,
    getValue: (d) => d.closed,
    formatValue: (v) => `${fmtInt(v)} closed`,
  },
]
const FLOW_DATA = [...FLOW]

/** One or two words: at 390 px the title is the row label and nothing may crowd it. */
const stuckStatus = (i: (typeof STUCK)[number]) =>
  i.state === 'blocked' ? (
    <StatusVerdict color={VX.status.bad} word="Blocked" />
  ) : i.waitHours > WARN_HOURS ? (
    <StatusVerdict color={VX.status.warn} word="Overdue" />
  ) : (
    <StatusVerdict color={VX.faint} word="Waiting" />
  )

const STUCK_ITEMS = STUCK.map((i) => ({
  key: i.id,
  label: i.title,
  value: i.waitHours,
  secondary: stuckStatus(i),
}))

const WARN_LABEL = `${WARN_HOURS} h`
const ABANDON_LABEL = `${ABANDON_HOURS / 24} d`

function QueueStrip({ shotState }: ScenarioProps) {
  const loading = shotState === 'loading'
  const none = shotState === 'empty' || shotState === 'error'
  // Loading shows the hero skeleton alone: a visual over placeholder data would contradict it.
  const hidden = none || loading
  // Empty and error say why in the cell itself, with the Retry on a failure.
  const cellState = (what: string, reason: string): Pick<StatStripCell, 'state'> =>
    shotState === 'error'
      ? { state: { kind: 'error', error: new Error(retry(what)), onRetry: noop } }
      : shotState === 'empty'
        ? { state: { kind: 'empty', reason } }
        : {}

  const cells: StatStripCell[] = [
    {
      key: 'needs-you',
      caption: 'Needs you',
      qualifier: 'now',
      info: 'Items waiting on your decision. The dashed line is the 14-day mean.',
      value: fmtInt(NEEDS_YOU),
      unit: 'items',
      loading,
      ...cellState('Needs-you items', WARDEN_EMPTY),
      ...(!hidden && {
        visual: (
          <Box data-shot-hover>
            <Sparkline
              ariaLabel="Items awaiting a decision, end of day, last 14 days"
              data={NEEDS_YOU_TREND}
              height={SPARK_HEIGHT}
              reference="mean"
              format={(v) => `${fmtInt(v)} items`}
            />
          </Box>
        ),
      }),
    },
    {
      key: 'dispatch-spend',
      caption: 'Dispatch spend',
      qualifier: 'today',
      info: `Agent dispatch cost so far today, in EUR; the daily cap is ${fmtEur(BUDGETS.day.cap)}. The sparkline and its dashed mean cover the ${DISPATCH_COMPLETE_DAYS.length} complete days before today.`,
      value: fmtEur(BUDGETS.day.spent),
      ...cellState('Dispatch spend', 'No dispatch spend today. It appears with the first run.'),
      ...(!hidden && {
        visual: (
          <Box data-shot-hover>
            <Sparkline
              ariaLabel={`Dispatch spend per day, last ${DISPATCH_COMPLETE_DAYS.length} complete days, EUR`}
              data={DISPATCH_COMPLETE_DAYS}
              height={SPARK_HEIGHT}
              reference="mean"
              format={fmtEur}
            />
          </Box>
        ),
      }),
      loading,
    },
    {
      key: 'oldest-wait',
      caption: 'Oldest wait',
      info: `The longest an item has waited on you. Warden warns past ${WARN_LABEL} and closes an item as abandoned at ${ABANDON_LABEL}.`,
      value: fmtAge(OLDEST_WAIT_HOURS),
      ...(OLDEST_WAIT_HOURS > WARN_HOURS && !none && { tone: 'warn' as const }),
      ...cellState('The oldest wait', 'Nothing is waiting on you, so there is no wait to measure.'),
      loading,
      ...(!hidden && {
        visual: (
          <Meter
            label={`Oldest wait against the ${WARN_LABEL} warning and ${ABANDON_LABEL} abandon limits`}
            value={OLDEST_WAIT_HOURS}
            max={ABANDON_HOURS}
            target={WARN_HOURS}
            format={fmtAge}
            startCaption={null}
            endCaption={`Warns at ${WARN_LABEL} · abandoned at ${ABANDON_LABEL}`}
          />
        ),
      }),
    },
    {
      key: 'failures',
      caption: 'Failures',
      qualifier: 'last 24 h',
      info: 'Agent runs that ended in an error in the last 24 hours.',
      value: fmtInt(FAILURES_24H.count),
      unit: 'runs',
      ...cellState('Failures', 'No agent runs in the last 24 h to count.'),
      // Hourly bars answer "is it still happening?": three runs, but a burst or a trickle. The
      // footer prints when each ran, so the marks read without colour and against a clock.
      ...(!hidden && { footer: `Latest ${FAILURES_LATEST_LABEL}` }),
      ...(!hidden && {
        visual: (
          <Sparkline
            ariaLabel="Failed runs per hour, last 24 hours"
            data={FAILURES_BY_HOUR}
            height={SPARK_HEIGHT}
            mark="bar"
            color={VX.status.bad}
            emphasizeLast={false}
            format={(v) => `${fmtInt(v)} ${v === 1 ? 'run' : 'runs'}`}
          />
        ),
      }),
      ...(!hidden && FAILURES_24H.count > FAILURES_24H.prior && { tone: 'bad' as const }),
      ...(!hidden && {
        delta: (
          <DeltaBadge
            value={FAILURES_24H.count - FAILURES_24H.prior}
            polarity="up-bad"
            period="vs prior 24 h"
            format={(v) => `${fmtInt(Math.abs(v))} runs`}
          />
        ),
      }),
      loading,
    },
    {
      key: 'fleet',
      caption: 'Fleet',
      qualifier: 'by state',
      info: 'Every item in the queue by its state.',
      value: fmtInt(FLEET_TOTAL),
      unit: 'items',
      loading,
      ...cellState('The fleet', WARDEN_EMPTY),
      ...(!hidden && {
        visual: (
          <Meter
            label="Fleet by state"
            max={FLEET_TOTAL}
            segments={FLEET.map((s) => ({
              value: s.count,
              label: s.label,
              color: STATE_COLOR[s.state],
            }))}
            format={(v) => `${fmtInt(v)} items`}
          />
        ),
      }),
    },
  ]

  const budget = (label: string, spent: number, cap: number, caption: string) => (
    <Meter
      label={label}
      value={spent}
      max={cap}
      format={fmtEur}
      loading={loading}
      startCaption={`${caption} ${fmtEur(spent)}`}
      endCaption={`${fmtEur(cap - spent)} left of ${fmtEur(cap)}`}
    />
  )

  // The strip derives each footer cell's anchor, which cannot carry `data-shot-absent`: the content
  // repeats the name with the declaration, so `shot` reads the footer as absent in empty and error.
  const footerEntry = (key: string, content: ReactNode) => ({
    key,
    content: (
      <Box data-shot={`strip-footer-${key}`} data-shot-absent="empty error">
        {content}
      </Box>
    ),
  })
  const footer = none
    ? undefined
    : [
        footerEntry(
          'day',
          budget('Daily dispatch budget', BUDGETS.day.spent, BUDGETS.day.cap, 'Today'),
        ),
        footerEntry(
          'week',
          budget('Weekly dispatch budget', BUDGETS.week.spent, BUDGETS.week.cap, 'Last 7 days'),
        ),
      ]

  return (
    <StatGroup
      variant="strip"
      label="Agent queue"
      cols={5}
      cells={cells}
      {...(footer !== undefined && { footer })}
    />
  )
}

/**
 * Column rule: a card with no short partner spans the row alone rather than pairing with a
 * mismatched one. Measured at 1440: the 9-row list is 478 and the flow chart 542 (its default
 * height at full width), one row each. At 390 the order is the list (651), then the flow (331).
 */
function QueueRow({ shotState }: ScenarioProps) {
  const empty = shotState === 'empty'
  return (
    <Stack gap="sm">
      <Box data-shot="stuck-items">
        <ChartCard
          title="Waiting or blocked, by age"
          info={`Items waiting on your decision and items blocked on something else, oldest first. The status marks a wait past the ${WARN_LABEL} warning.`}
          {...(shotState === undefined && {
            subtitle: `Warden abandons an item at ${ABANDON_LABEL}`,
          })}
          {...(shotState === undefined && {
            facts: {
              value: fmtInt(STUCK.length),
              unit: 'items',
              period: `${NEEDS_YOU} need you`,
            },
          })}
          {...cardStateProps(shotState, retry('Waiting and blocked items'), STUCK_PLACEHOLDER)}
        >
          <Box data-shot-hover>
            <BarList
              label="Items waiting or blocked, by age"
              items={empty ? [] : STUCK_ITEMS}
              max={ABANDON_HOURS}
              format={fmtAge}
              accentLeader
              variant="thin"
              loading={shotState === 'loading'}
              emptyText="Nothing is waiting on you. New items appear here when an agent needs a decision."
            />
          </Box>
        </ChartCard>
      </Box>
      <Box data-shot="item-flow">
        <ChartCard
          title="Items opened and closed per day"
          info="Items warden opened and items it closed each day, UTC. A queue that opens more than it closes grows."
          {...(shotState === undefined && {
            facts: [
              { value: fmtInt(FLOW_OPENED), unit: 'opened', period: FLOW_RANGE_LABEL },
              { value: fmtInt(FLOW_CLOSED), unit: 'closed', period: FLOW_RANGE_LABEL },
            ],
          })}
          state={chartStateFor(shotState, {
            empty: 'No items opened or closed in the window. Dispatch an item to start.',
            error: retry('Item flow'),
          })}
          {...(shotState === 'error' && { onRetry: noop })}
        >
          <Box data-shot-hover data-shot-tooltip>
            <Lines<FlowRow, Date>
              data={FLOW_DATA}
              ariaLabel={`Items opened and closed per day, ${FLOW_RANGE_LABEL}`}
              x={(d) => d.date}
              series={FLOW_SERIES}
            />
          </Box>
        </ChartCard>
      </Box>
    </Stack>
  )
}

export function AgentsScenario({ shotState }: ScenarioProps) {
  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      <PageBar
        actions={[{ key: 'approve', label: 'Approve oldest', onClick: () => {}, primary: true }]}
      />
      <QueueStrip shotState={shotState} />
      <QueueRow shotState={shotState} />
    </Stack>
  )
}
