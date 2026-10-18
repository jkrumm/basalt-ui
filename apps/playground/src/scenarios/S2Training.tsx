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
import { BarList, Meter, PageBar, StatCard, StatGroup } from 'basalt-ui'
import { Bars, ChartCard, Sparkline } from 'basalt-ui/charts'
import type { BarsBar } from 'basalt-ui/charts'
import { CONTAINER_KEYS, VX } from 'basalt-ui/tokens'
import type { CSSProperties } from 'react'
import classes from './training-kpis.module.css'
import { demoColors } from '../demo/series'
import { fmtInt, fmtKg, fmtKm, fmtRatio, fmtShare } from './fixture-utils'
import { cardStateProps, chartStateFor, noop, queryFor, retryCopy } from './shot-state'
import type { ScenarioProps } from './shot-state'
import {
  ACUTE_LOAD,
  CHRONIC_LOAD,
  CONTRIBUTORS,
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
  MONTH_END_LABEL,
  MONTH_NAME,
  PACE_GAP,
  PACE_SESSIONS,
  PRIOR_WINDOW_LABEL,
  READINESS_SCORE,
  READINESS_ZONES,
  SESSIONS_7D_POINTS,
  SESSIONS_CHANGE_PCT,
  SESSIONS_MTD,
  TODAY_LABEL,
  TOP_LIFTS,
  TYPE_MIX,
  VOLUME_7D_POINTS,
  VOLUME_CHANGE_PCT,
  VOLUME_MTD_KG,
  WINDOW_LABEL,
  loadZoneName,
  readinessLevel,
} from './training-data'
import type { SessionType } from './training-data'

type SparklineSize = { width: number; height: number }

const TYPE_COLOR: Record<SessionType, string> = {
  strength: demoColors.sessions,
  walk: demoColors.signups,
  mobility: demoColors.revenue,
}

const TRAINING_ERROR = 'The training log did not answer. Retry, or reconnect it in Settings.'
const TRAINING_EMPTY = 'No sessions logged this month. Log a workout to start the month.'
const retry = (what: string): string => retryCopy(what, 'training log')

/** Body heights for the error placeholder, so a failed card stays near its resting size. */
const PLACEHOLDER = { meter: 72, readiness: 168, lifts: 184 }

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

/** Words only, the status word bound to its verb with no-break spaces so it never wraps alone at 390. Every figure lives on the surface that owns it, so the sentence never restates one. */
const SUMMARY = `${PACE_GAP === 0 ? 'On' : PACE_GAP > 0 ? 'Ahead of' : 'Behind'} the ${MONTH_NAME} goal pace. Load is ${loadZoneName(LOAD_RATIO).toLowerCase()}; readiness\u00A0is\u00A0${readinessLevel(READINESS_SCORE).toLowerCase()}.`

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
  const text = {
    empty: TRAINING_EMPTY,
    error: retry('The month summary'),
    loading: '',
    rest: SUMMARY,
  }[shotState ?? 'rest']
  return (
    <Box data-shot="summary">
      {shotState === 'loading' ? (
        <Skeleton height={20} width={420} maw="100%" />
      ) : (
        <Text size="sm" c="dimmed">
          {text}
        </Text>
      )}
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
  const isAtRest = shotState === undefined
  const query = queryFor(shotState, TRAINING_ERROR)
  const shared = { emptyText: TRAINING_EMPTY, ...(query !== undefined && { query }) }
  const deltaProps = (pct: number) =>
    isAtRest ? { delta: pct, deltaPeriod: `vs ${PRIOR_WINDOW_LABEL}` } : {}

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
            {...(shotState === undefined && {
              // The count lives on the Sessions KPI; this card leads with what is new on it.
              facts: { value: aheadOrBehind(PACE_GAP) },
            })}
            info={`Strength, walking-pad and mobility sessions all count. The tick is the pace that reaches ${GOAL_SESSIONS} on ${MONTH_END_LABEL}.`}
            {...cardStateProps(shotState, retry('The session goal'), PLACEHOLDER.meter)}
          >
            <Box data-shot-hover>
              <Meter
                label={`${fmtInt(SESSIONS_MTD)} of ${GOAL_SESSIONS} sessions this month against the goal`}
                value={empty ? null : SESSIONS_MTD}
                max={GOAL_SESSIONS}
                target={GOAL_SESSIONS}
                ticks={[
                  { at: PACE_SESSIONS, caption: `Pace ${fmtInt(PACE_SESSIONS)} by ${TODAY_LABEL}` },
                ]}
                startCaption={null}
                endCaption={`Goal ${GOAL_SESSIONS}`}
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
            {...cardStateProps(shotState, retry('Sessions by type'), PLACEHOLDER.meter)}
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
          {...(shotState === undefined && {
            facts: {
              value: `${MONTHS_HIT} of ${HIT_MONTHS}`,
              unit: 'months',
              period: `reached ${GOAL_SESSIONS} sessions`,
            },
          })}
          info={`Sessions per complete month against the goal of ${GOAL_SESSIONS}. A bar that reaches the goal line is a month that hit it.`}
          state={chartStateFor(shotState, {
            empty: 'No complete month logged yet. The history appears after the first full month.',
            error: retry('The goal hit rate'),
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
  return (
    <Box data-shot="training-load" flex={1}>
      <ChartCard
        style={FILL}
        title="Training load"
        {...(shotState === undefined && {
          facts: { value: fmtRatio(LOAD_RATIO), period: '7 days against the 4-week norm' },
        })}
        info="Load of the last 7 days divided by the weekly average of the last 28 days. Load is minutes × session intensity (1–10), in arbitrary units (AU)."
        {...cardStateProps(shotState, retry('Training load'), PLACEHOLDER.meter)}
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
  return (
    <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
      <Box data-shot="readiness" h="100%">
        <ChartCard
          style={FILL}
          title="Readiness"
          {...(shotState === undefined && {
            facts: { value: fmtInt(READINESS_SCORE), unit: 'of 100' },
            subtitle: `As of ${TODAY_LABEL}`,
          })}
          info={READINESS_INFO}
          {...cardStateProps(shotState, retry('Readiness'), PLACEHOLDER.readiness)}
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
                />
              </Box>
            )}
          </Stack>
        </ChartCard>
      </Box>
      <Box data-shot="top-lifts" h="100%">
        <ChartCard
          style={FILL}
          title="Top lifts by volume"
          {...(shotState === undefined && {
            facts: {
              value: fmtShare(LIFTS_SHARE),
              unit: 'of volume',
              period: `in ${TOP_LIFT_COUNT} lifts, ${WINDOW_LABEL}`,
            },
          })}
          info="Sets × reps × weight per lift over the strength sessions of the window; the share is of total training volume."
          {...cardStateProps(shotState, retry('Top lifts'), PLACEHOLDER.lifts)}
        >
          <Box data-shot-hover>
            <BarList
              label={`Top lifts by volume, ${WINDOW_LABEL}, kilograms`}
              items={empty ? [] : LIFT_ITEMS}
              format={fmtKg}
              accentLeader
              loading={loading}
              emptyText={`No strength session logged ${WINDOW_LABEL}. Log a lift to rank your lifts.`}
            />
          </Box>
        </ChartCard>
      </Box>
    </SimpleGrid>
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
    </Stack>
  )
}
