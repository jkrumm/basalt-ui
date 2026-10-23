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
 * The item timeline below them is `agents/item-timeline.tsx` (Wave 44: EventList fills it).
 *
 * The decision card above the strip is `agents/decision-card.tsx` (Wave 45): the oldest awaiting item.
 *
 * Anchors for `basalt-ui shot`: `agents-decision`, strip cells carry their own `data-shot` (`strip-needs-you`,
 * `strip-oldest-wait`, `strip-fleet`, `strip-dispatch-spend`, `strip-failures`; footer meters
 * `strip-footer-day` / `strip-footer-week`, declared absent in empty and error, where each cell says
 * why through its own `state`); `ChartCard` does not forward `data-*`, so those anchors are wrapping `Box`es.
 */
import { Box, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { BarList, DeltaBadge, Meter, Section, StatGroup, StatusVerdict } from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { ChartCard, Lines, Sparkline } from 'basalt-ui/charts'
import { CONTAINER_KEYS, VX } from 'basalt-ui/tokens'
import { demoColors } from '../demo/series'
import { AgentsBoard } from './agents/board'
import {
  ABANDON_HOURS,
  BUDGETS,
  DISPATCH_COMPLETE_DAYS,
  DISPATCH_POINTS,
  FAILURES_24H,
  FAILURES_POINTS,
  FLEET,
  FLOW,
  FLOW_SERIES,
  FLOW_CLOSED,
  FLOW_OPENED,
  FLOW_RANGE_LABEL,
  ITEM_TIMELINE,
  ITEM_TIMELINE_TOTAL,
  NEEDS_YOU,
  NEEDS_YOU_POINTS,
  OLDEST_WAIT_HOURS,
  STUCK,
  TIMELINE_ITEM,
  WARN_HOURS,
  fmtAge,
} from './agents-data'
import type { FlowRow, ItemState } from './agents-data'
import { DecisionCard, DecisionCardSkeleton } from './agents/decision-card'
import { ItemTimeline } from './agents/item-timeline'
import { fmtEur, fmtEurCents, fmtInt, fmtShare } from './fixture-utils'
import { cardStateProps, chartStateFor, noop, retryCopy } from './shot-state'
import type { ScenarioProps } from './shot-state'

/** Keeps `24 h` on one line when a sentence wraps. */
const NBSP = '\u00A0'

const WARDEN_EMPTY = 'No agent work in the queue. Dispatch an item to start.'
const retry = (): string => retryCopy('warden')

const SPARK_HEIGHT = 28

const STATE_COLOR: Record<ItemState, string> = {
  awaiting: VX.status.warn,
  running: demoColors.sessions,
  queued: VX.faint,
  blocked: VX.status.bad,
}

const FLOW_DATA = [...FLOW]

/** A short word, plus the reason on a blocked row: at 390 px the title is the row label and nothing may crowd it. */
const stuckStatus = (i: (typeof STUCK)[number]) =>
  i.state === 'blocked' ? (
    <StatusVerdict
      color={VX.status.bad}
      word={i.reason === undefined ? 'Blocked' : `Blocked · ${i.reason}`}
    />
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

/** The failures window as a clock: the 24 bars run from a day ago to now (the hover readout names the hour). */
const failuresClock = (
  <Group justify="space-between" gap="xs" wrap="nowrap">
    <Text span inherit>
      {`24${NBSP}h ago`}
    </Text>
    <Text span inherit>
      now
    </Text>
  </Group>
)

/** The fleet without the items waiting on the owner: the Awaiting items cell and the board carry that count. */
const FLEET_OPEN = FLEET.filter((s) => s.state !== 'awaiting')
const FLEET_OPEN_TOTAL = FLEET_OPEN.reduce((n, s) => n + s.count, 0)

const WARN_LABEL = `${WARN_HOURS} h`
const ABANDON_LABEL = `${ABANDON_HOURS / 24} d`

// Intentional duplicate `data-shot`: the strip derives each footer cell's anchor
// (`strip-footer-<key>`) and offers no `absent` on a footer entry, so the content repeats the name
// carrying the declaration. `shot` resolves the anchor with `.first()` (the derived cell) and reads
// the declaration from the repeat, so the footer counts as absent in empty and error. A package
// follow-up would let the entry declare it, and this wrapper would go.
const footerEntry = (key: string, content: ReactNode) => ({
  key,
  content: (
    <Box data-shot={`strip-footer-${key}`} data-shot-absent="empty error">
      {content}
    </Box>
  ),
})

function QueueStrip({ shotState }: ScenarioProps) {
  const loading = shotState === 'loading'
  const none = shotState === 'empty' || shotState === 'error'
  // The cell decides what to paint while loading, so visual, footer and delta pass through; only empty and error drop them.
  const hidden = none
  // Empty and error say why in the cell itself, with the Retry on a failure.
  const cellState = (reason: string, error: string = retry()): Pick<StatStripCell, 'state'> =>
    shotState === 'error'
      ? { state: { kind: 'error', error: new Error(error), onRetry: noop } }
      : shotState === 'empty'
        ? { state: { kind: 'empty', reason } }
        : {}

  const cells: StatStripCell[] = [
    {
      key: 'needs-you',
      caption: 'Awaiting items',
      qualifier: 'your decision',
      info: 'Items waiting on your decision. The dashed line is the 14-day mean.',
      value: fmtInt(NEEDS_YOU),
      loading,
      ...cellState(WARDEN_EMPTY),
      ...(!hidden && {
        visual: (
          <Box data-shot-hover>
            <Sparkline
              ariaLabel="Items awaiting a decision, end of day, last 14 days"
              data={NEEDS_YOU_POINTS}
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
      value: fmtEurCents(BUDGETS.day.spent),
      ...cellState('No dispatch spend today. It appears with the first run.'),
      ...(!hidden && {
        visual: (
          <Box data-shot-hover>
            <Sparkline
              ariaLabel={`Dispatch spend per day, last ${DISPATCH_COMPLETE_DAYS.length} complete days, EUR`}
              data={DISPATCH_POINTS}
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
      ...cellState('Nothing is waiting on you, so there is no wait to measure.'),
      loading,
      ...(!hidden && {
        visual: (
          <Meter
            label={`Oldest wait against the ${WARN_LABEL} warning and ${ABANDON_LABEL} abandon limits`}
            value={OLDEST_WAIT_HOURS}
            max={ABANDON_HOURS}
            ticks={[{ at: WARN_HOURS, label: `Warn ${WARN_LABEL}` }]}
            format={fmtAge}
            startCaption={null}
            endCaption={`Abandoned at ${ABANDON_LABEL}`}
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
      ...cellState(`No agent runs in the last 24${NBSP}h to count.`),
      // Hourly bars answer "is it still happening?": three runs, but a burst or a trickle. The
      // footer is the clock under them: the window's first and last hour, and the hour of the latest run.
      ...(!hidden && { footer: failuresClock }),
      ...(!hidden && {
        visual: (
          <Box data-shot-hover>
            <Sparkline
              ariaLabel="Failed runs per hour, last 24 hours"
              data={FAILURES_POINTS}
              height={SPARK_HEIGHT}
              mark="bar"
              color={VX.status.bad}
              emphasizeLast={false}
              format={(v) => `${fmtInt(v)} ${v === 1 ? 'run' : 'runs'}`}
            />
          </Box>
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
      qualifier: 'not awaiting you',
      info: 'Every item the queue holds that is not waiting on your decision, by its state. The awaiting count is the Awaiting items cell.',
      value: fmtInt(FLEET_OPEN_TOTAL),
      unit: 'items',
      loading,
      ...cellState(WARDEN_EMPTY),
      ...(!hidden && {
        visual: (
          <Meter
            label="Fleet by state"
            max={FLEET_OPEN_TOTAL}
            segments={FLEET_OPEN.map((s) => ({
              value: s.count,
              label: s.label,
              color: STATE_COLOR[s.state],
            }))}
            format={fmtInt}
          />
        ),
      }),
    },
  ]

  // Both footers name the limit "cap" (as the Dispatch spend tooltip does) and state it once, as the Meter's end caption. The day's caption is the share only: the Meter's target states the cap and the Dispatch spend headline (to the cent, so 54% agrees with it) states the spend.
  const budget = ({
    label,
    title,
    spent,
    cap,
    caption,
  }: {
    label: string
    title: string
    spent: number
    cap: number
    caption: string
  }) => (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">
        {title}
      </Text>
      <Meter
        label={label}
        value={spent}
        max={cap}
        format={fmtEur}
        loading={loading}
        startCaption={caption}
        target={cap}
        endCaption={`Cap ${fmtEur(cap)}`}
      />
    </Stack>
  )

  const footer = none
    ? undefined
    : [
        footerEntry(
          'day',
          budget({
            label: 'Daily dispatch budget',
            title: 'Dispatch spend, today',
            spent: BUDGETS.day.spent,
            cap: BUDGETS.day.cap,
            caption: `${fmtShare(BUDGETS.day.spent / BUDGETS.day.cap)} of today's cap`,
          }),
        ),
        footerEntry(
          'week',
          budget({
            label: 'Weekly dispatch budget',
            title: 'Dispatch spend, last 7 days',
            spent: BUDGETS.week.spent,
            cap: BUDGETS.week.cap,
            caption: `${fmtEur(BUDGETS.week.spent)}, last 7 days`,
          }),
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

/** The 9-row list spans the row alone: it has no short partner. The flow chart pairs with the item history below the board. */
function QueueRow({ shotState }: ScenarioProps) {
  const empty = shotState === 'empty'
  return (
    <Stack gap="sm">
      <Box data-shot="stuck-items">
        <ChartCard
          title="Waiting or blocked, by age"
          info={`Items waiting on your decision and items blocked on something else, oldest first. The status marks a wait past the ${WARN_LABEL} warning.`}
          subtitle={`Warden abandons an item at ${ABANDON_LABEL}`}
          {...cardStateProps(
            shotState,
            retry(),
            'content',
            'Nothing is waiting on you. New items appear here when an agent needs a decision.',
          )}
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
              loadingRows={STUCK_ITEMS.length}
              emptyText="Nothing is waiting on you. New items appear here when an agent needs a decision."
            />
          </Box>
        </ChartCard>
      </Box>
    </Stack>
  )
}

/** Tall enough that the chart card ends level with the history card beside it at 1440. */
const FLOW_HEIGHT = { base: 240, regular: 400 }

function FlowCard({ shotState }: ScenarioProps) {
  return (
    <Box data-shot="item-flow" h="100%">
      <ChartCard
        title="Items opened and closed per day"
        placeholderHeight={FLOW_HEIGHT}
        ghost="line"
        info="Items warden opened and items it closed each day, UTC. A queue that opens more than it closes grows."
        facts={[
          { value: fmtInt(FLOW_OPENED), unit: 'opened' },
          { value: fmtInt(FLOW_CLOSED), unit: 'closed', period: `· ${FLOW_RANGE_LABEL}` },
        ]}
        state={chartStateFor(shotState, {
          empty: `No items opened or closed ${FLOW_RANGE_LABEL}. Dispatch an item to start.`,
          error: retry(),
        })}
        {...(shotState === 'error' && { onRetry: noop })}
      >
        <Box data-shot-hover data-shot-tooltip>
          <Lines<FlowRow, Date>
            data={FLOW_DATA}
            ariaLabel={`Items opened and closed per day, ${FLOW_RANGE_LABEL}`}
            height={FLOW_HEIGHT}
            x={(d) => d.date}
            series={FLOW_SERIES}
          />
        </Box>
      </ChartCard>
    </Box>
  )
}

/** The oldest item awaiting the user: the one decision the queue asks for. */
const AWAITING_ITEMS = STUCK.filter((i) => i.state === 'awaiting').toSorted(
  (a, b) => b.waitHours - a.waitHours,
)
const DECISION_ITEM = AWAITING_ITEMS[0]
/** The decision behind the one on screen: what answering this one unblocks the owner to look at next. */
const NEXT_ITEM = AWAITING_ITEMS.at(1)

function AgentsDecision({ shotState }: ScenarioProps) {
  if (shotState === 'loading') return <DecisionCardSkeleton />
  // Empty and error say why in the strip's cells; a card with nothing to decide is not drawn.
  if (shotState === 'empty' || shotState === 'error' || DECISION_ITEM === undefined) return null
  const { id, title, waitHours } = DECISION_ITEM
  return (
    <DecisionCard
      question={`Approve “${title}”?`}
      facts={[id.toUpperCase(), `Abandoned in ${fmtAge(Math.max(0, ABANDON_HOURS - waitHours))}`]}
      evidence={
        <Text size="sm">
          {NEXT_ITEM === undefined
            ? 'Nothing else is waiting on you.'
            : `Next in line: “${NEXT_ITEM.title}”, waiting ${fmtAge(NEXT_ITEM.waitHours)}.`}
        </Text>
      }
      primary={{ label: 'Approve', keyHint: 'A', onClick: noop }}
      secondary={{ label: 'Reassign', keyHint: 'R', onClick: noop }}
      quiet={{ label: 'Leave', keyHint: 'L', onClick: noop }}
    />
  )
}

export function AgentsScenario({ shotState }: ScenarioProps) {
  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      <Box data-shot="agents-decision" data-shot-absent="empty error">
        <AgentsDecision shotState={shotState} />
      </Box>
      <QueueStrip shotState={shotState} />
      <QueueRow shotState={shotState} />
      <Section title="Board">
        <AgentsBoard shotState={shotState} />
      </Section>
      <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
        <FlowCard shotState={shotState} />
        <Box data-shot="item-timeline" h="100%">
          <ChartCard title={`History · ${TIMELINE_ITEM}`} style={{ height: '100%' }}>
            <ItemTimeline
              events={ITEM_TIMELINE}
              total={ITEM_TIMELINE_TOTAL}
              shotState={shotState}
            />
          </ChartCard>
        </Box>
      </SimpleGrid>
    </Stack>
  )
}
