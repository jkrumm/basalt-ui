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
import { Box, Group, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core'
import { BarList, Meter, PageBar, StatCard, StatGroup } from 'basalt-ui'
import { ChartCard, Sparkline } from 'basalt-ui/charts'
import { CONTAINER_KEYS } from 'basalt-ui/tokens'
import { demoColors } from '../demo/series'
import { fmtInt, fmtKg, fmtKm, fmtRatio, fmtShare } from './fixture-utils'
import { cardStateProps, queryFor, retryCopy } from './shot-state'
import type { ScenarioProps } from './shot-state'
import {
  ACUTE_LOAD,
  CHRONIC_LOAD,
  CONTRIBUTORS,
  DAYS_ELAPSED,
  DISTANCE_7D_TREND,
  DISTANCE_CHANGE_PCT,
  DISTANCE_MTD_KM,
  GOAL_SESSIONS,
  HIT_MONTHS,
  HIT_RANGE_LABEL,
  HIT_RATE_PCT,
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
  SESSIONS_7D_TREND,
  SESSIONS_CHANGE_PCT,
  SESSIONS_MTD,
  TODAY_LABEL,
  TOP_LIFTS,
  TYPE_MIX,
  VOLUME_7D_TREND,
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
const PLACEHOLDER = { meter: 72, ring: 104, readiness: 168, lifts: 184 }

/** `Low under 60, Fair 60–79, Good 80+` — the legend, built from the zones the Meter draws. */
const READINESS_INFO = `Mean of the four contributors below, each scored 0–100: ${READINESS_ZONES.map(
  (z, i, all) =>
    `${z.label} ${i === 0 ? `under ${z.to}` : i === all.length - 1 ? `${z.from}+` : `${z.from}–${z.to - 1}`}`,
).join(', ')}.`

const percent = (value: number): string => `${Math.round(value)}%`
const aheadOrBehind = (gap: number): string =>
  gap === 0 ? 'on pace' : `${Math.abs(gap)} ${gap > 0 ? 'ahead of' : 'behind'} pace`

const SUMMARY = `${SESSIONS_MTD} sessions in ${DAYS_ELAPSED} days, ${aheadOrBehind(PACE_GAP)} for ${GOAL_SESSIONS} by ${MONTH_END_LABEL}. Load is ${loadZoneName(LOAD_RATIO).toLowerCase()} at ${fmtRatio(LOAD_RATIO)}; readiness is ${readinessLevel(READINESS_SCORE).toLowerCase()} at ${READINESS_SCORE}.`

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
const TOP_LIFT_COUNT = 6
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
  (label: string, data: readonly number[], format: (v: number) => string) =>
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
          sparkline={trendSparkline('Sessions', SESSIONS_7D_TREND, (v) => `${fmtInt(v)} sessions`)}
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
          sparkline={trendSparkline('Training volume, kilograms', VOLUME_7D_TREND, fmtKg)}
        />
      </Box>
      <Box data-shot="distance" h="100%">
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
            DISTANCE_7D_TREND,
            (v) => `${fmtKm(v)} km`,
          )}
        />
      </Box>
    </StatGroup>
  )
}

/**
 * The goal and the mix are short meter cards stacked in one column, beside the taller ring card:
 * two like-height columns, so neither card is stretched into an empty lower half.
 */
function GoalRow({ shotState }: ScenarioProps) {
  const empty = shotState === 'empty'
  const loading = shotState === 'loading'
  return (
    <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
      <Stack gap="sm">
        <Box data-shot="goal">
          <ChartCard
            title={`Sessions against the ${MONTH_NAME} goal`}
            info={`Strength, walking-pad and mobility sessions all count. The tick is the pace that reaches ${GOAL_SESSIONS} on ${MONTH_END_LABEL}.`}
            {...cardStateProps(shotState, retry('The session goal'), PLACEHOLDER.meter)}
          >
            <Box data-shot-hover>
              <Meter
                label={`Sessions this month against the goal of ${GOAL_SESSIONS}`}
                value={empty ? null : SESSIONS_MTD}
                max={GOAL_SESSIONS}
                ticks={[{ at: PACE_SESSIONS, label: 'Pace' }]}
                format={(v) => `${fmtInt(v)} sessions`}
                startCaption={`${fmtInt(SESSIONS_MTD)} of ${GOAL_SESSIONS} sessions`}
                endCaption={`${fmtInt(PACE_SESSIONS)} sessions by ${TODAY_LABEL}`}
                loading={loading}
                emptyText={TRAINING_EMPTY}
              />
            </Box>
          </ChartCard>
        </Box>
        <Box data-shot="session-mix">
          <ChartCard
            title="Sessions by type"
            {...(shotState === undefined && {
              facts: { value: fmtInt(SESSIONS_MTD), unit: 'sessions', period: WINDOW_LABEL },
            })}
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
      </Stack>
      <Box data-shot="hit-rate" h="100%">
        <ChartCard
          title={`Goal hit rate, ${HIT_RANGE_LABEL}`}
          info={`Share of the last ${HIT_MONTHS} complete months that reached ${GOAL_SESSIONS} sessions.`}
          {...cardStateProps(shotState, retry('The goal hit rate'), PLACEHOLDER.ring)}
        >
          <Group gap="lg" wrap="nowrap">
            <Meter
              shape="ring"
              label={`Goal hit rate, ${HIT_RANGE_LABEL}`}
              value={empty ? null : HIT_RATE_PCT}
              format={percent}
              loading={loading}
              emptyText="No complete month logged yet. The rate appears after the first full month."
            />
            {shotState === undefined && (
              <Text size="sm" c="dimmed">
                {MONTHS_HIT} of {HIT_MONTHS} months reached {GOAL_SESSIONS} sessions.
              </Text>
            )}
          </Group>
        </ChartCard>
      </Box>
    </SimpleGrid>
  )
}

function LoadCard({ shotState }: ScenarioProps) {
  return (
    <Box data-shot="training-load">
      <ChartCard
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
            max={LOAD_MAX}
            zones={LOAD_ZONES}
            format={fmtRatio}
            endCaption={`${fmtInt(ACUTE_LOAD)} AU this week · norm ${fmtInt(CHRONIC_LOAD)} AU`}
            loading={shotState === 'loading'}
            emptyText="No sessions in the last 28 days to compare against. Log a workout."
          />
        </Box>
      </ChartCard>
    </Box>
  )
}

/** Two tall BarList cards side by side: like heights, so the row has no empty half. */
function ReadinessRow({ shotState }: ScenarioProps) {
  const empty = shotState === 'empty'
  const loading = shotState === 'loading'
  return (
    <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
      <Box data-shot="readiness" h="100%">
        <ChartCard
          title="Readiness"
          {...(shotState === undefined && {
            facts: { value: fmtInt(READINESS_SCORE), unit: 'of 100', period: TODAY_LABEL },
          })}
          info={READINESS_INFO}
          {...cardStateProps(shotState, retry('Readiness'), PLACEHOLDER.readiness)}
        >
          <Stack gap="md">
            <Meter
              label="Readiness score out of 100"
              value={empty ? null : READINESS_SCORE}
              zones={READINESS_ZONES}
              endCaption="Scale 0–100"
              loading={loading}
              emptyText="No readiness reading today. Sync the watch."
            />
            <Box data-shot-hover>
              <BarList
                label="Readiness contributors, score out of 100"
                max={100}
                items={empty ? [] : READINESS_ITEMS}
                loading={loading}
                emptyText="No contributor has a reading today. Sync the watch to score sleep, HRV and recovery."
              />
            </Box>
          </Stack>
        </ChartCard>
      </Box>
      <Box data-shot="top-lifts" h="100%">
        <ChartCard
          title="Top lifts by volume"
          {...(shotState === undefined && {
            facts: {
              value: fmtKg(TOP_LIFTS.reduce((a, l) => a + l.volumeKg, 0)),
              period: `all lifts, ${WINDOW_LABEL}`,
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
              emptyText="No strength session logged in the window. Log a lift to rank your lifts."
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
      <LoadCard shotState={shotState} />
      <ReadinessRow shotState={shotState} />
    </Stack>
  )
}
