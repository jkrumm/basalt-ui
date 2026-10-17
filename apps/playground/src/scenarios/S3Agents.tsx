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
 * `strip-footer-day` / `strip-footer-week`, present in every state; the empty / error note
 * `strip-footer-note` sits inside the day cell); `ChartCard` does not forward `data-*`, so those anchors are wrapping `Box`es.
 */
import { Box, SimpleGrid, Stack } from '@mantine/core'
import { BarList, DeltaBadge, Meter, PageBar, StatGroup, StatusVerdict } from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { Bars, ChartCard, Sparkline } from 'basalt-ui/charts'
import type { BarsBar } from 'basalt-ui/charts'
import { CONTAINER_KEYS, VX } from 'basalt-ui/tokens'
import { demoColors } from '../demo/series'
import {
  ABANDON_HOURS,
  BUDGETS,
  DISPATCH_COMPLETE_DAYS,
  FAILURES_24H,
  FAILURES_BY_HOUR,
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
import { RETRY_ACTION } from './retry-action'
import { cardStateProps, chartStateFor, retryCopy } from './shot-state'
import type { ScenarioProps } from './shot-state'

const WARDEN_ERROR = 'The queue did not answer. Retry, or check the warden connection.'
const WEEK_ERROR =
  'The queue did not answer for the weekly budget. Retry, or check the warden connection.'
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

const FLOW_BARS: BarsBar<FlowRow>[] = [
  { key: 'opened', label: 'Opened', color: VX.neutral, getValue: (d) => d.opened },
  { key: 'closed', label: 'Closed', color: demoColors.signups, getValue: (d) => d.closed },
]
const FLOW_DATA = [...FLOW]

const stuckStatus = (i: (typeof STUCK)[number]) =>
  i.state === 'blocked' ? (
    <StatusVerdict
      color={VX.status.bad}
      word={i.reason === undefined ? 'Blocked' : `Blocked · ${i.reason}`}
    />
  ) : i.waitHours > WARN_HOURS ? (
    <StatusVerdict color={VX.status.warn} word="Needs you · over 24 h" />
  ) : (
    <StatusVerdict color={VX.faint} word="Needs you" />
  )

const STUCK_ITEMS = STUCK.map((i) => ({
  key: i.id,
  label: `${i.title} · ${i.repo}`,
  value: i.waitHours,
  secondary: stuckStatus(i),
}))

const WARN_LABEL = `${WARN_HOURS} h`
const ABANDON_LABEL = `${ABANDON_HOURS / 24} d`

function QueueStrip({ shotState }: ScenarioProps) {
  const loading = shotState === 'loading'
  const empty = shotState === 'empty'
  const error = shotState === 'error'
  const none = empty || error
  // Loading shows the hero skeleton alone: a visual over placeholder data would contradict it.
  const hidden = none || loading
  const note = error ? WARDEN_ERROR : empty ? WARDEN_EMPTY : undefined

  const cells: StatStripCell[] = [
    {
      key: 'needs-you',
      caption: 'Needs you',
      qualifier: 'now',
      info: 'Items waiting on your decision. The dashed line is the 14-day mean.',
      value: none ? null : fmtInt(NEEDS_YOU),
      unit: 'items',
      loading,
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
      value: none ? null : fmtEur(BUDGETS.day.spent),
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
      value: none ? null : fmtAge(OLDEST_WAIT_HOURS),
      ...(OLDEST_WAIT_HOURS > WARN_HOURS && !none && { tone: 'warn' as const }),
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
      key: 'fleet',
      caption: 'Fleet',
      qualifier: 'by state',
      info: 'Every item in the queue by its state.',
      value: none ? null : fmtInt(FLEET_TOTAL),
      unit: 'items',
      loading,
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
    {
      key: 'failures',
      caption: 'Failures',
      qualifier: 'last 24 h',
      info: 'Agent runs that ended in an error in the last 24 hours.',
      value: none ? null : fmtInt(FAILURES_24H.count),
      unit: 'runs',
      // Hourly bars answer "is it still happening?": three runs, but a burst or a trickle.
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
  ]

  const budget = (
    label: string,
    spent: number,
    cap: number,
    caption: string,
    emptyText: string,
  ) => (
    <Meter
      label={label}
      value={none ? null : spent}
      max={cap}
      format={fmtEur}
      loading={loading}
      emptyText={emptyText}
      startCaption={`${caption} ${fmtEur(spent)}`}
      endCaption={`${fmtEur(cap - spent)} left of ${fmtEur(cap)}`}
    />
  )

  const dayMeter = {
    key: 'day',
    content: budget(
      'Daily dispatch budget',
      BUDGETS.day.spent,
      BUDGETS.day.cap,
      'Today',
      note ?? WARDEN_EMPTY,
    ),
  }
  const weekMeter = {
    key: 'week',
    content: budget(
      'Weekly dispatch budget',
      BUDGETS.week.spent,
      BUDGETS.week.cap,
      'Last 7 days',
      error ? WEEK_ERROR : 'No dispatch spend this week.',
    ),
  }
  // Both footer anchors exist in every state (`shot` errors on an anchor that vanishes); the
  // empty / error note is the day meter's emptyText, wrapped so it keeps its own anchor.
  const footer = [
    note === undefined
      ? dayMeter
      : { ...dayMeter, content: <Box data-shot="strip-footer-note">{dayMeter.content}</Box> },
    weekMeter,
  ]

  return <StatGroup variant="strip" label="Agent queue" cols={5} cells={cells} footer={footer} />
}

function QueueRow({ shotState }: ScenarioProps) {
  const empty = shotState === 'empty'
  return (
    <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
      <Box data-shot="stuck-items" h="100%">
        <ChartCard
          title="Waiting or blocked, by age"
          info={`Items waiting on your decision and items blocked on something else, oldest first. The status marks a wait past the ${WARN_LABEL} warning.`}
          {...(shotState === undefined && {
            subtitle: `Warden abandons an item at ${ABANDON_LABEL}`,
          })}
          {...(shotState === undefined && {
            facts: { value: fmtInt(STUCK.length), unit: 'items', period: `${NEEDS_YOU} need you` },
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
      <Box data-shot="item-flow" h="100%">
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
          {...(shotState === 'error' && { stateAction: RETRY_ACTION })}
        >
          <Box data-shot-hover data-shot-tooltip>
            <Bars
              data={FLOW_DATA}
              ariaLabel={`Items opened and closed per day, ${FLOW_RANGE_LABEL}`}
              x={(d) => d.date}
              bars={FLOW_BARS}
              layout="grouped"
            />
          </Box>
        </ChartCard>
      </Box>
    </SimpleGrid>
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
