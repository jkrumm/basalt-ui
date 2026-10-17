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
 * Anchors for `basalt-ui shot`: strip cells carry their own `data-shot` (`strip-<key>`,
 * `strip-footer-<key>`); `ChartCard` does not forward `data-*`, so those anchors are wrapping `Box`es.
 */
import { Box, SimpleGrid, Stack, Text } from '@mantine/core'
import { BarList, DeltaBadge, Meter, PageBar, StatGroup } from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { Bars, ChartCard, Sparkline } from 'basalt-ui/charts'
import type { BarsBar } from 'basalt-ui/charts'
import { CONTAINER_KEYS, VX } from 'basalt-ui/tokens'
import { demoColors } from '../demo/series'
import {
  ABANDON_HOURS,
  BUDGETS,
  DISPATCH_DAILY,
  DISPATCH_PRIOR_EUR,
  FAILURES_24H,
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

/** Status as a dot and a word: the colour never carries the verdict alone. */
function Status({ tone, word }: { tone: string; word: string }) {
  return (
    <Text component="span" size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: tone,
          marginRight: 6,
        }}
      />
      {word}
    </Text>
  )
}

const STUCK_ITEMS = STUCK.map((i) => ({
  key: i.id,
  label: `${i.title} · ${i.repo}`,
  value: i.waitHours,
  secondary:
    i.waitHours > WARN_HOURS ? (
      <Status tone={VX.status.warn} word="Over 24 h" />
    ) : (
      <Status tone={VX.faint} word="Within 24 h" />
    ),
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
      ...(note !== undefined && { footer: note }),
      ...(!hidden && {
        visual: (
          <Sparkline
            ariaLabel="Items awaiting a decision, end of day, last 14 days"
            data={NEEDS_YOU_TREND}
            height={SPARK_HEIGHT}
            reference="mean"
            format={(v) => `${fmtInt(v)} items`}
          />
        ),
      }),
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
      key: 'dispatch-spend',
      caption: 'Dispatch spend',
      qualifier: 'today',
      info: `Agent dispatch cost today, in EUR. The dashed line is the 14-day daily mean; the daily cap is ${fmtEur(BUDGETS.day.cap)}.`,
      value: none ? null : fmtEur(BUDGETS.day.spent),
      ...(!hidden && {
        delta: (
          <DeltaBadge
            value={(BUDGETS.day.spent / DISPATCH_PRIOR_EUR - 1) * 100}
            polarity="up-bad"
            period="vs yesterday"
          />
        ),
        visual: (
          <Sparkline
            ariaLabel="Dispatch spend per day, last 14 days, EUR"
            data={DISPATCH_DAILY}
            height={SPARK_HEIGHT}
            reference="mean"
            format={fmtEur}
          />
        ),
      }),
      loading,
    },
    {
      key: 'failures',
      caption: 'Failures',
      qualifier: 'last 24 h',
      info: 'Agent runs that ended in an error in the last 24 hours.',
      value: none ? null : fmtInt(FAILURES_24H.count),
      unit: 'runs',
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

  const budget = (label: string, spent: number, cap: number, caption: string) => (
    <Meter
      label={label}
      value={none ? null : spent}
      max={cap}
      format={fmtEur}
      loading={loading}
      emptyText={note ?? WARDEN_EMPTY}
      startCaption={`${caption} ${fmtEur(spent)}`}
      endCaption={`${fmtEur(cap - spent)} left of ${fmtEur(cap)}`}
    />
  )

  return (
    <StatGroup
      variant="strip"
      label="Agent queue"
      cols={5}
      cells={cells}
      footer={[
        {
          key: 'day',
          content: budget('Daily dispatch budget', BUDGETS.day.spent, BUDGETS.day.cap, 'Today'),
        },
        {
          key: 'week',
          content: budget(
            'Weekly dispatch budget',
            BUDGETS.week.spent,
            BUDGETS.week.cap,
            'Last 7 days',
          ),
        },
      ]}
    />
  )
}

function QueueRow({ shotState }: ScenarioProps) {
  const empty = shotState === 'empty'
  return (
    <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
      <Box data-shot="stuck-items" h="100%">
        <ChartCard
          title="Stuck items by wait"
          info={`Items waiting on your decision, longest first. The status marks a wait past the ${WARN_LABEL} warning.`}
          subtitle={`Warden abandons an item at ${ABANDON_LABEL}`}
          facts={{ value: fmtInt(NEEDS_YOU), unit: 'items', period: 'waiting for a decision' }}
          {...cardStateProps(shotState, retry('Stuck items'), STUCK_PLACEHOLDER)}
        >
          <Box data-shot-hover>
            <BarList
              label="Items awaiting a decision, by wait"
              items={empty ? [] : STUCK_ITEMS}
              max={ABANDON_HOURS}
              format={fmtAge}
              accentLeader
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
          facts={[
            { value: fmtInt(FLOW_OPENED), unit: 'opened' },
            { value: fmtInt(FLOW_CLOSED), unit: 'closed', period: FLOW_RANGE_LABEL },
          ]}
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
