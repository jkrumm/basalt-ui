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
import { Box, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { BarList, Meter, PageBar, StatCard, StatGroup } from 'basalt-ui'
import { ChartCard, Sparkline } from 'basalt-ui/charts'
import type { ChartState } from 'basalt-ui/charts'
import { CONTAINER_KEYS } from 'basalt-ui/tokens'
import { demoColors } from '../demo/series'
import { RETRY_ACTION } from './retry-action'
import { queryFor, retryCopy } from './shot-state'
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
  fmtInt,
  fmtKg,
  fmtKm,
  fmtRatio,
  fmtShare,
  loadZoneName,
  readinessLevel,
} from './training-data'
import type { SessionType } from './training-data'

const TYPE_COLOR: Record<SessionType, string> = {
  strength: demoColors.sessions,
  walk: demoColors.signups,
  mobility: demoColors.revenue,
}

const TRAINING_ERROR = 'The training log did not answer. Retry, or reconnect it in Settings.'
const TRAINING_EMPTY = 'No sessions logged this month. Log a workout to start the month.'
const retry = (what: string): string => retryCopy(what, 'training log')

/** A Meter or BarList draws its own loading and empty states; the card only takes the error. */
const errorOnly = (state: ScenarioProps['shotState'], copy: string): ChartState | undefined =>
  state === 'error' ? { error: new Error(copy) } : undefined

const percent = (value: number): string => `${Math.round(value)}%`
const aheadOrBehind = (gap: number): string =>
  gap === 0 ? 'on pace' : `${Math.abs(gap)} ${gap > 0 ? 'ahead of' : 'behind'} pace`

const SUMMARY = `${SESSIONS_MTD} sessions in ${DAYS_ELAPSED} days, ${aheadOrBehind(PACE_GAP)} for ${GOAL_SESSIONS} by ${MONTH_END_LABEL}. Load is ${loadZoneName(LOAD_RATIO).toLowerCase()} at ${fmtRatio(LOAD_RATIO)}; readiness is ${readinessLevel(READINESS_SCORE).toLowerCase()} at ${READINESS_SCORE}.`

function TrainingStats({ shotState }: ScenarioProps) {
  const isAtRest = shotState === undefined
  const query = queryFor(shotState, TRAINING_ERROR)
  const shared = { emptyText: TRAINING_EMPTY, ...(query !== undefined && { query }) }
  const delta = (pct: number) =>
    isAtRest ? { delta: pct, deltaPeriod: `vs ${PRIOR_WINDOW_LABEL}` } : {}

  return (
    <StatGroup cols={3}>
      <Box data-shot="sessions" h="100%">
        <StatCard
          title="Sessions"
          qualifier="month to date"
          value={fmtInt(SESSIONS_MTD)}
          unit="sessions"
          subtitle="Rolling 7 days, last 30 days"
          {...delta(SESSIONS_CHANGE_PCT)}
          {...shared}
          sparkline={(size) => (
            <Box data-shot-hover>
              <Sparkline
                ariaLabel="Sessions, rolling 7 days, last 30 days"
                data={SESSIONS_7D_TREND}
                {...size}
              />
            </Box>
          )}
        />
      </Box>
      <Box data-shot="volume" h="100%">
        <StatCard
          title="Training volume"
          qualifier="month to date"
          value={fmtInt(VOLUME_MTD_KG)}
          unit="kg"
          info={`Sets × reps × weight over the strength sessions of ${WINDOW_LABEL}. Pull-ups count at body weight.`}
          subtitle="Rolling 7 days, last 30 days"
          {...delta(VOLUME_CHANGE_PCT)}
          {...shared}
          sparkline={(size) => (
            <Box data-shot-hover>
              <Sparkline
                ariaLabel="Training volume, rolling 7 days, last 30 days, kilograms"
                data={VOLUME_7D_TREND}
                {...size}
              />
            </Box>
          )}
        />
      </Box>
      <Box data-shot="distance" h="100%">
        <StatCard
          title="Walking distance"
          qualifier="month to date"
          value={fmtKm(DISTANCE_MTD_KM)}
          unit="km"
          subtitle="Rolling 7 days, last 30 days"
          {...delta(DISTANCE_CHANGE_PCT)}
          {...shared}
          sparkline={(size) => (
            <Box data-shot-hover>
              <Sparkline
                ariaLabel="Walking distance, rolling 7 days, last 30 days, kilometres"
                data={DISTANCE_7D_TREND}
                {...size}
              />
            </Box>
          )}
        />
      </Box>
    </StatGroup>
  )
}

function GoalRow({ shotState }: ScenarioProps) {
  const empty = shotState === 'empty'
  const loading = shotState === 'loading'
  const failed = shotState === 'error'
  const action = failed ? { stateAction: RETRY_ACTION } : {}
  return (
    <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
      <Box data-shot="goal" h="100%">
        <ChartCard
          title={`Sessions against the ${MONTH_NAME} goal`}
          info={`Strength, walking-pad and mobility sessions all count. The tick is the pace that reaches ${GOAL_SESSIONS} on ${MONTH_END_LABEL}.`}
          state={errorOnly(shotState, retry('The session goal'))}
          {...action}
        >
          <Box data-shot-hover>
            <Meter
              label={`Sessions this month against the goal of ${GOAL_SESSIONS}`}
              value={empty ? null : SESSIONS_MTD}
              max={GOAL_SESSIONS}
              target={PACE_SESSIONS}
              format={(v) => `${fmtInt(v)} sessions`}
              startCaption={`${fmtInt(SESSIONS_MTD)} of ${GOAL_SESSIONS} sessions`}
              endCaption={`Pace ${fmtInt(PACE_SESSIONS)} by ${TODAY_LABEL}`}
              loading={loading}
              emptyText={TRAINING_EMPTY}
            />
          </Box>
        </ChartCard>
      </Box>
      <Box data-shot="hit-rate" h="100%">
        <ChartCard
          title={`Goal hit rate, ${HIT_RANGE_LABEL}`}
          info={`Share of the last ${HIT_MONTHS} complete months that reached ${GOAL_SESSIONS} sessions.`}
          state={errorOnly(shotState, retry('The goal hit rate'))}
          {...action}
        >
          <Group gap="lg" wrap="nowrap">
            <Meter
              shape="ring"
              label={`Goal hit rate, ${HIT_RANGE_LABEL}`}
              value={empty ? null : HIT_RATE_PCT}
              format={percent}
              loading={loading}
              emptyText="No complete month yet"
            />
            <Text size="sm" c="dimmed">
              {MONTHS_HIT} of {HIT_MONTHS} months reached {GOAL_SESSIONS} sessions.
            </Text>
          </Group>
        </ChartCard>
      </Box>
    </SimpleGrid>
  )
}

function ReadinessRow({ shotState }: ScenarioProps) {
  const empty = shotState === 'empty'
  const loading = shotState === 'loading'
  const action = shotState === 'error' ? { stateAction: RETRY_ACTION } : {}
  return (
    <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
      <Box data-shot="training-load" h="100%">
        <ChartCard
          title="Training load, 7 days against the 4-week norm"
          info="Load of the last 7 days divided by the weekly average of the last 28 days. Load is minutes × session intensity (1–10), in arbitrary units (AU)."
          state={errorOnly(shotState, retry('Training load'))}
          {...action}
        >
          <Box data-shot-hover>
            <Meter
              label="Acute to chronic training load ratio"
              value={empty ? null : LOAD_RATIO}
              max={LOAD_MAX}
              zones={LOAD_ZONES}
              format={fmtRatio}
              endCaption={`${fmtInt(ACUTE_LOAD)} AU this week · norm ${fmtInt(CHRONIC_LOAD)} AU`}
              loading={loading}
              emptyText="No sessions in the last 28 days to compare against."
            />
          </Box>
        </ChartCard>
      </Box>
      <Box data-shot="readiness" h="100%">
        <ChartCard
          title={`Readiness, ${TODAY_LABEL}`}
          info="Mean of the four contributors below, each scored 0–100: 80+ is Good, 60–79 Fair, under 60 Low."
          state={errorOnly(shotState, retry('Readiness'))}
          {...action}
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
                items={
                  empty
                    ? []
                    : CONTRIBUTORS.map((c) => ({
                        key: c.key,
                        label: c.label,
                        value: c.value,
                        secondary: readinessLevel(c.value),
                      }))
                }
                loading={loading}
                loadingRows={CONTRIBUTORS.length}
                emptyText="No contributors without a reading."
              />
            </Box>
          </Stack>
        </ChartCard>
      </Box>
    </SimpleGrid>
  )
}

function MixRow({ shotState }: ScenarioProps) {
  const empty = shotState === 'empty'
  const loading = shotState === 'loading'
  const action = shotState === 'error' ? { stateAction: RETRY_ACTION } : {}
  return (
    <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
      <Box data-shot="session-mix" h="100%">
        <ChartCard
          title={`Sessions by type, ${WINDOW_LABEL}`}
          state={errorOnly(shotState, retry('Sessions by type'))}
          {...action}
        >
          <Box data-shot-hover>
            <Meter
              label={`Sessions by type, ${WINDOW_LABEL}`}
              max={SESSIONS_MTD}
              segments={
                empty
                  ? []
                  : TYPE_MIX.filter((t) => t.count > 0).map((t) => ({
                      value: t.count,
                      label: t.label,
                      color: TYPE_COLOR[t.type],
                    }))
              }
              format={(v) => `${fmtInt(v)} sessions`}
              loading={loading}
              emptyText={TRAINING_EMPTY}
            />
          </Box>
        </ChartCard>
      </Box>
      <Box data-shot="top-lifts" h="100%">
        <ChartCard
          title={`Top lifts by volume, ${WINDOW_LABEL}`}
          info="Sets × reps × weight per lift over the strength sessions of the window; the share is of total training volume."
          state={errorOnly(shotState, retry('Top lifts'))}
          {...action}
        >
          <Box data-shot-hover>
            <BarList
              label={`Top lifts by volume, ${WINDOW_LABEL}, kilograms`}
              items={
                empty
                  ? []
                  : TOP_LIFTS.slice(0, 6).map((l) => ({
                      label: l.name,
                      value: l.volumeKg,
                      secondary: fmtShare(l.share),
                    }))
              }
              format={fmtKg}
              accentLeader
              loading={loading}
              loadingRows={6}
              emptyText="No strength session logged in the window."
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
      <Text size="sm" c="dimmed" data-shot="summary">
        {SUMMARY}
      </Text>
      <TrainingStats shotState={shotState} />
      <GoalRow shotState={shotState} />
      <ReadinessRow shotState={shotState} />
      <MixRow shotState={shotState} />
    </Stack>
  )
}
