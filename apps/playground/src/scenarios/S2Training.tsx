/**
 * S2 — Training log (stands for argo strength-tracker and walking-pad).
 * docs/waves/design-parity/SPEC.md § 2.
 *
 *   Question: Am I on track for this month's goal?
 *   Decision: Train today or rest.
 *
 * Anchors for `basalt-ui shot`: every scored component carries `data-shot`; `StatCard` and
 * `ChartCard` do not forward `data-*`, so the anchor is the wrapping `Box`. `Meter` and `BarList`
 * draw their own loading and empty states (`shot-state` → `loading` / no reading); the card only
 * takes the error.
 */
import { Box, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core'
import { BarList, Meter, PageBar, Section, StatCard, StatGroup } from 'basalt-ui'
import { Bars, ChartCard, Sparkline } from 'basalt-ui/charts'
import type { BarsBar } from 'basalt-ui/charts'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import { CONTAINER_KEYS, VX } from 'basalt-ui/tokens'
import type { CSSProperties } from 'react'
import { tableEmptyState, useFilterReset } from '../demo/table-empty-state'
import { ErrorNote } from '../demo/fixtures/error-note'
import classes from './training-kpis.module.css'
import { demoColors } from '../demo/series'
import { TableCap } from './table-cap'
import { fmtInt, fmtKg, fmtKm, fmtRatio, fmtShare } from './fixture-utils'
import { FixedClockTime } from './FixedClockTime'
import { cardStateProps, chartStateFor, noop, queryFor, retryCopy } from './shot-state'
import type { ScenarioProps } from './shot-state'
import {
  ACUTE_LOAD,
  CHRONIC_LOAD,
  CONTRIBUTORS,
  DAYS_ELAPSED,
  DISTANCE_7D_POINTS,
  DISTANCE_CHANGE_PCT,
  DISTANCE_MTD_KM,
  GOAL_SESSIONS,
  HIT_HISTORY,
  HIT_MONTHS,
  HIT_RANGE_LABEL,
  LOAD_MAX,
  LOAD_RATIO,
  LOAD_ZONES,
  MONTHS_HIT,
  MONTH_DAYS,
  MONTH_END_LABEL,
  MONTH_NAME,
  NO_STRENGTH,
  PACE_GAP,
  PACE_SESSIONS,
  PRIOR_WINDOW_LABEL,
  READING_DATE,
  READINESS_SCORE,
  READINESS_ZONES,
  SESSIONS_7D_POINTS,
  SESSION_LOG,
  SESSIONS_CHANGE_PCT,
  SESSIONS_MTD,
  TODAY_LABEL,
  TOP_LIFTS,
  TYPE_MIX,
  VOLUME_7D_POINTS,
  VOLUME_CHANGE_PCT,
  VOLUME_MTD_KG,
  WINDOW_LABEL,
  readinessLevel,
  trainingVerdict,
} from './training-data'
import type { SessionLogRow, SessionType } from './training-data'

type SparklineSize = { width: number; height: number }

const TYPE_COLOR: Record<SessionType, string> = {
  strength: demoColors.sessions,
  walk: demoColors.signups,
  mobility: demoColors.revenue,
}

const TRAINING_EMPTY = 'No sessions logged this month. Log a workout to start the month.'
const retry = (): string => retryCopy('training log')

/** `Low under 60, Fair 60–79, Good 80+` — the legend, built from the zones the Meter draws. */
const READINESS_INFO = `Mean of the four contributors below, each scored 0–100: ${READINESS_ZONES.map(
  (z, i, all) =>
    `${z.label} ${i === 0 ? `under ${z.to}` : i === all.length - 1 ? `${z.from}+` : `${z.from}–${z.to - 1}`}`,
).join(', ')}.`

const aheadOrBehind = (gap: number): string =>
  gap === 0
    ? 'on pace'
    : `${Math.abs(gap)} ${Math.abs(gap) === 1 ? 'session' : 'sessions'} ${gap > 0 ? 'ahead of' : 'behind'} pace`

/** One card height for a row pair: the grid cell sets it, the card fills it. */
const FILL: CSSProperties = { height: '100%' }

const DAYS_LEFT = MONTH_DAYS - DAYS_ELAPSED
const TRAINING = trainingVerdict({
  paceGap: PACE_GAP,
  loadRatio: LOAD_RATIO,
  readiness: READINESS_SCORE,
})
const LOAD_WORDS = { low: 'load is low', holds: 'load holds', high: 'load is high' } as const
/** The one judgement the cards do not state: what pace, load and readiness add up to. Its only figure is the days left, which no card prints; the month binds to it with no-break spaces so it never wraps alone at 390. */
const SUMMARY = `${TRAINING.verdict[0]?.toUpperCase()}${TRAINING.verdict.slice(1)} today: ${TRAINING.pace === 'holds' ? 'pace holds' : 'pace is behind'}, ${LOAD_WORDS[TRAINING.load]}, readiness is ${readinessLevel(READINESS_SCORE).toLowerCase()}, with ${DAYS_LEFT}\u00A0days\u00A0left\u00A0in\u00A0${MONTH_NAME}.`

const SESSION_SEGMENTS = TYPE_MIX.filter((t) => t.count > 0).map((t) => ({
  value: t.count,
  label: t.label,
  color: TYPE_COLOR[t.type],
}))
/** Contributors ranked high to low: a ranked read, the weakest last. */
const READINESS_ITEMS = CONTRIBUTORS.toSorted((a, b) => b.value - a.value).map((c) => ({
  key: c.key,
  label: c.label,
  value: c.value,
  secondary: readinessLevel(c.value),
}))
type HitRow = (typeof HIT_HISTORY)[number]
/** One bar per month: the bar reaching the goal line is the encoding, a muted fill marks the misses. */
const HIT_BARS: BarsBar<HitRow>[] = [
  {
    key: 'reached',
    label: 'Reached goal',
    color: demoColors.sessions,
    getValue: (d) => (d.sessions >= GOAL_SESSIONS ? d.sessions : null),
    formatValue: (v) => `${fmtInt(v)} sessions`,
  },
  {
    key: 'below',
    label: 'Below goal',
    color: VX.faint,
    getValue: (d) => (d.sessions < GOAL_SESSIONS ? d.sessions : null),
    formatValue: (v) => `${fmtInt(v)} sessions`,
  },
]
const HIT_DATA = [...HIT_HISTORY]
const HIT_TICKS = HIT_HISTORY.map((m) => m.label)
/** The goal line sits inside the y domain: the tallest month and the goal both fit under it. */
const HIT_Y_MAX = 40
/** The axis states its unit once, on the top tick, so the scale reads without a legend entry per bar. */
const hitTick = (v: number): string => (v === HIT_Y_MAX ? `${v} sessions` : String(v))
const TOP_LIFT_COUNT = 6
/** The share of volume the six listed lifts carry — new on the card, the BarList rows state each one's. */
const LIFTS_SHARE = TOP_LIFTS.slice(0, TOP_LIFT_COUNT).reduce((a, l) => a + l.share, 0)
const LIFT_ITEMS = TOP_LIFTS.slice(0, TOP_LIFT_COUNT).map((l) => ({
  label: l.name,
  value: l.volumeKg,
  secondary: fmtShare(l.share),
}))

/** The page's state in one sentence; the live numbers only exist at rest. */
function Summary({ shotState }: ScenarioProps) {
  if (shotState === 'loading') {
    return (
      <Box data-shot="summary">
        <Skeleton height={20} width={420} maw="100%" />
      </Box>
    )
  }
  if (shotState === 'error') {
    return (
      <Box data-shot="summary">
        <ErrorNote title="Could not load the summary" cause={retry()} onRetry={noop} />
      </Box>
    )
  }
  // A summary is a sentence with a live number; an empty month has none, and every host below states its
  // own cause, so the line is omitted rather than repeating TRAINING_EMPTY a fifth time.
  if (shotState === 'empty') return <Box data-shot="summary" data-shot-absent="empty" />
  // The shot reads `data-shot-absent` at rest, so the loaded box declares the omitted empty.
  return (
    <Box data-shot="summary" data-shot-absent="empty">
      <Text size="sm" c="dimmed">
        {SUMMARY}
      </Text>
    </Box>
  )
}

/** A rolling-7-day trend for a `StatCard` visual slot. */
const trendSparkline =
  (label: string, data: readonly { at: number; value: number }[], format: (v: number) => string) =>
  (size: SparklineSize) => (
    <Box data-shot-hover>
      <Sparkline
        ariaLabel={`${label}, rolling 7 days, last 30 days`}
        data={data}
        reference="mean"
        format={format}
        {...size}
      />
    </Box>
  )

function TrainingStats({ shotState }: ScenarioProps) {
  const hidden = shotState === 'empty' || shotState === 'error'
  const query = queryFor(shotState, retry())
  const shared = { emptyText: TRAINING_EMPTY, ...(query !== undefined && { query }) }
  const deltaProps = (pct: number) =>
    !hidden ? { delta: pct, deltaPeriod: `vs ${PRIOR_WINDOW_LABEL}` } : {}

  return (
    <StatGroup cols={3}>
      <Box data-shot="sessions" h="100%">
        <StatCard
          title="Sessions"
          qualifier="month to date"
          value={fmtInt(SESSIONS_MTD)}
          unit="sessions"
          info={`Strength, walking-pad and mobility sessions, 7-day rolling. The dashed line is the 30-day mean.`}
          subtitle="7-day rolling"
          {...deltaProps(SESSIONS_CHANGE_PCT)}
          {...shared}
          sparkline={trendSparkline('Sessions', SESSIONS_7D_POINTS, (v) => `${fmtInt(v)} sessions`)}
        />
      </Box>
      <Box data-shot="volume" h="100%">
        <StatCard
          title="Training volume"
          qualifier="month to date"
          value={fmtInt(VOLUME_MTD_KG)}
          unit="kg"
          info={`Sets × reps × weight over the strength sessions of ${WINDOW_LABEL}. Pull-ups count at body weight. The dashed line is the 30-day mean.`}
          subtitle="7-day rolling"
          {...deltaProps(VOLUME_CHANGE_PCT)}
          {...shared}
          sparkline={trendSparkline('Training volume, kilograms', VOLUME_7D_POINTS, fmtKg)}
        />
      </Box>
      <Box data-shot="distance" h="100%" className={classes.lastKpi}>
        <StatCard
          title="Walking distance"
          qualifier="month to date"
          value={fmtKm(DISTANCE_MTD_KM)}
          unit="km"
          info="Distance on the walking pad, 7-day rolling. The dashed line is the 30-day mean."
          subtitle="7-day rolling"
          {...deltaProps(DISTANCE_CHANGE_PCT)}
          {...shared}
          sparkline={trendSparkline(
            'Walking distance, kilometres',
            DISTANCE_7D_POINTS,
            (v) => `${fmtKm(v)} km`,
          )}
        />
      </Box>
    </StatGroup>
  )
}

/**
 * Column rule: both columns of a row end within one row-gap at 1440, by composition, never by
 * stretching. Measured: goal 95 + mix 115 + load 151 + 2 gaps = 385 against the history chart 386.
 * At 390 the order is goal, mix, load, history.
 */
function GoalRow({ shotState }: ScenarioProps) {
  const empty = shotState === 'empty'
  const loading = shotState === 'loading'
  return (
    <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
      <Stack gap="sm" h="100%">
        <Box data-shot="goal">
          <ChartCard
            title={`Sessions against the ${MONTH_NAME} goal`}
            // The count lives on the Sessions KPI; this card leads with what is new on it.
            facts={{ value: aheadOrBehind(PACE_GAP) }}
            info={`Strength, walking-pad and mobility sessions all count. The tick is the pace that reaches ${GOAL_SESSIONS} on ${MONTH_END_LABEL}.`}
            {...cardStateProps(shotState, retry(), 'content', TRAINING_EMPTY)}
          >
            <Box data-shot-hover>
              <Meter
                label={`${fmtInt(SESSIONS_MTD)} of ${GOAL_SESSIONS} sessions this month against the goal`}
                value={empty ? null : SESSIONS_MTD}
                max={GOAL_SESSIONS}
                target={GOAL_SESSIONS}
                ticks={[
                  {
                    at: PACE_SESSIONS,
                    label: `Pace ${fmtInt(PACE_SESSIONS)} sessions by ${TODAY_LABEL}`,
                  },
                ]}
                format={(v) => `${fmtInt(v)} sessions`}
                loading={loading}
                emptyText={TRAINING_EMPTY}
              />
            </Box>
          </ChartCard>
        </Box>
        <Box data-shot="session-mix">
          <ChartCard
            title={`Sessions by type, ${WINDOW_LABEL}`}
            {...cardStateProps(shotState, retry(), 'content', TRAINING_EMPTY)}
          >
            <Box data-shot-hover>
              <Meter
                label={`Sessions by type, ${WINDOW_LABEL}`}
                max={SESSIONS_MTD}
                segments={empty ? [] : SESSION_SEGMENTS}
                format={(v) => `${fmtInt(v)} sessions`}
                loading={loading}
                emptyText={TRAINING_EMPTY}
              />
            </Box>
          </ChartCard>
        </Box>
        <LoadCard shotState={shotState} />
      </Stack>
      <Box data-shot="hit-rate" h="100%">
        <ChartCard
          style={FILL}
          title={`Goal hit rate, ${HIT_RANGE_LABEL}`}
          ghost={6}
          facts={{
            value: `${MONTHS_HIT} of ${HIT_MONTHS}`,
            unit: 'months',
            period: `reached ${GOAL_SESSIONS} sessions`,
          }}
          info={`Sessions per complete month against the goal of ${GOAL_SESSIONS}. A bar that reaches the goal line is a month that hit it.`}
          state={chartStateFor(shotState, {
            empty: 'No complete month logged yet. The history appears after the first full month.',
            error: retry(),
          })}
          {...(shotState === 'error' && { onRetry: noop })}
        >
          <Box data-shot-hover data-shot-tooltip>
            <Bars
              data={HIT_DATA}
              ariaLabel={`Sessions per month against the goal of ${GOAL_SESSIONS}, ${HIT_RANGE_LABEL}`}
              x={(d) => d.label}
              xTicks={HIT_TICKS}
              y={{ domain: [0, HIT_Y_MAX], format: hitTick }}
              bars={HIT_BARS}
              refLines={[
                {
                  value: GOAL_SESSIONS,
                  color: VX.faint,
                  dashed: true,
                  label: `Goal ${GOAL_SESSIONS}`,
                },
              ]}
            />
          </Box>
        </ChartCard>
      </Box>
    </SimpleGrid>
  )
}

function LoadCard({ shotState }: ScenarioProps) {
  // Fill the row beside the taller sibling only while the body is drawn; an empty or failed card ends at its content.
  const fills = shotState === undefined || shotState === 'loading'
  return (
    <Box data-shot="training-load" {...(fills && { flex: 1 })}>
      <ChartCard
        {...(fills && { style: FILL })}
        title="Training load"
        facts={{ value: fmtRatio(LOAD_RATIO), period: '7 days against the 4-week norm' }}
        info="Load of the last 7 days divided by the weekly average of the last 28 days. Load is minutes × session intensity (1–10), in arbitrary units (AU)."
        {...cardStateProps(
          shotState,
          retry(),
          'content',
          'No sessions in the last 28 days to compare against. Log a workout.',
        )}
      >
        <Box data-shot-hover>
          <Meter
            label="Acute to chronic training load ratio"
            value={shotState === 'empty' ? null : LOAD_RATIO}
            startCaption={null}
            max={LOAD_MAX}
            zones={LOAD_ZONES}
            format={fmtRatio}
            ticks={[
              { at: 0, label: '0' },
              { at: LOAD_MAX, label: LOAD_MAX.toFixed(1) },
            ]}
            endCaption={`${fmtInt(ACUTE_LOAD)} AU this week · norm ${fmtInt(CHRONIC_LOAD)} AU`}
            loading={shotState === 'loading'}
            emptyText="No sessions in the last 28 days to compare against. Log a workout."
          />
        </Box>
      </ChartCard>
    </Box>
  )
}

/**
 * Column rule: cards of like natural height share a row, so neither is stretched. Measured at
 * 1440: readiness 283 and top lifts 283. At 390 the order is readiness, then lifts.
 */
function ReadinessRow({ shotState }: ScenarioProps) {
  const empty = shotState === 'empty'
  const loading = shotState === 'loading'
  // The lifts card fills the row beside the readiness card only while its body is drawn; empty or failed it ends at its content.
  const fills = shotState === undefined || loading
  return (
    <SimpleGrid
      type="container"
      cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}
      {...(!fills && { style: { alignItems: 'start' } })}
    >
      <Box data-shot="readiness" h="100%">
        <ChartCard
          style={FILL}
          title="Readiness"
          facts={{ value: fmtInt(READINESS_SCORE), unit: 'of 100' }}
          subtitle={`As of ${TODAY_LABEL}`}
          info={READINESS_INFO}
          {...cardStateProps(
            shotState,
            retry(),
            'content',
            'No readiness reading today. Sync the watch.',
          )}
        >
          <Stack gap="md">
            <Meter
              label="Readiness score out of 100"
              value={empty ? null : READINESS_SCORE}
              startCaption={null}
              zones={READINESS_ZONES}
              ticks={[
                { at: 0, label: '0' },
                { at: 100, label: '100' },
              ]}
              endCaption={null}
              loading={loading}
              emptyText="No readiness reading today. Sync the watch."
            />
            {/* The Meter above already says there is no reading; a second empty line would repeat it. */}
            {!empty && (
              <Box data-shot-hover>
                <BarList
                  label="Readiness contributors, score out of 100"
                  max={100}
                  items={READINESS_ITEMS}
                  loading={loading}
                  loadingRows={READINESS_ITEMS.length}
                />
              </Box>
            )}
          </Stack>
        </ChartCard>
      </Box>
      <Box data-shot="top-lifts" {...(fills && { h: '100%' })}>
        <ChartCard
          {...(fills && { style: FILL })}
          title="Top lifts by volume"
          facts={{
            value: fmtShare(LIFTS_SHARE),
            unit: 'of volume',
            period: `in ${TOP_LIFT_COUNT} lifts, ${WINDOW_LABEL}`,
          }}
          info="Sets × reps × weight per lift over the strength sessions of the window; the share is of total training volume."
          {...cardStateProps(shotState, retry(), 'content', NO_STRENGTH)}
        >
          <Box data-shot-hover>
            <BarList
              label={`Top lifts by volume, ${WINDOW_LABEL}, kilograms`}
              items={empty ? [] : LIFT_ITEMS}
              format={fmtKg}
              accentLeader
              loading={loading}
              loadingRows={LIFT_ITEMS.length}
              emptyText={NO_STRENGTH}
            />
          </Box>
        </ChartCard>
      </Box>
    </SimpleGrid>
  )
}

const EXERCISES = [...new Set(SESSION_LOG.map((r) => r.exercise))]
const EXERCISE_OPTIONS = EXERCISES.map((value) => ({ value, label: value }))
const SESSION_ROWS = [...SESSION_LOG]
const NO_SESSIONS: SessionLogRow[] = []

const fullDate = (date: Date): string =>
  date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

/** Units live in the headers; `priority` orders the fold (highest folds first). */
const sessionColumns = (() => {
  const col = createColumnHelper<SessionLogRow>()
  return [
    // Entity glyph-free: colour on this page means one thing per hue, and the result column owns it.
    col.accessor('exercise', { header: 'Exercise', meta: { kind: 'entity', priority: 1 } }),
    col.accessor('date', {
      header: 'Date',
      cell: (c) => (
        <FixedClockTime date={c.getValue()} now={READING_DATE} full={fullDate(c.getValue())} />
      ),
      meta: { kind: 'relative-time', priority: 2 },
    }),
    col.accessor('result', {
      header: 'Result',
      meta: {
        kind: 'status',
        priority: 3,
        statusColor: (result) =>
          result === 'PR' ? 'green' : result === 'Dropped' ? 'red' : 'gray',
      },
    }),
    col.accessor('e1rmKg', {
      header: 'Est. 1RM (kg, Epley)',
      meta: { kind: 'number', priority: 4 },
    }),
    col.accessor('volumeKg', { header: 'Volume (kg)', meta: { kind: 'number', priority: 5 } }),
    col.accessor('sets', { header: 'Sets', meta: { kind: 'number', priority: 6 } }),
  ]
})()

function TrainingSessions({ shotState }: ScenarioProps) {
  const query = queryFor(shotState, retry())
  const reset = useFilterReset([], shotState === undefined)
  return (
    <Box data-shot="session-log" h="100%">
      <Section title={`Lift log, ${WINDOW_LABEL}`}>
        <TableCap>
          <BasaltDataTable
            key={reset.tableKey}
            // Rows only at rest: the empty branch needs `data` empty, the others have no rows yet.
            data={shotState === undefined ? SESSION_ROWS : NO_SESSIONS}
            columns={sessionColumns}
            enablePagination
            facets={[{ columnId: 'exercise', label: 'Exercise', options: EXERCISE_OPTIONS }]}
            initialSorting={[{ id: 'date', desc: true }]}
            {...(query !== undefined && { query })}
            onColumnFiltersChange={reset.onColumnFiltersChange}
            emptyState={tableEmptyState({
              noun: 'lifts',
              total: SESSION_ROWS.length,
              cause: NO_STRENGTH,
              filtered: reset.filtered,
              onClear: reset.clear,
            })}
          />
        </TableCap>
      </Section>
    </Box>
  )
}

export function TrainingScenario({ shotState }: ScenarioProps) {
  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      <PageBar />
      <Summary shotState={shotState} />
      <TrainingStats shotState={shotState} />
      <GoalRow shotState={shotState} />
      <ReadinessRow shotState={shotState} />
      <TrainingSessions shotState={shotState} />
    </Stack>
  )
}
