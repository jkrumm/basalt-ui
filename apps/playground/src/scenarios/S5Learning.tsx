/**
 * S5 — Learning record (stands for rb's knot detail and journal). docs/waves/design-parity/SPEC.md § 2.
 *
 *   Question: Where am I with this topic?
 *   Decision: Review it now or later.
 *
 * One invented topic: a summary sentence, a joined strip (sessions, last practised, mean rating,
 * minutes this month), the practice journal and an aside with the record facts. The journal body is
 * `learning/journal.tsx` (Wave 44: EventList fills it). Actions are inert in fixtures.
 *
 * Anchors for `basalt-ui shot`: `learning-summary`, `learning-strip`, `learning-journal`,
 * `learning-aside`. `Section` and `PageAside` do not forward `data-*`, so each anchor is a wrapping `Box`.
 */
import { Box, Flex, Skeleton, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { PageAside, PageBar, PageSummary, Section, StatGroup, useSizeClass } from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { Sparkline } from 'basalt-ui/charts'
import { fmtInt } from './fixture-utils'
import {
  FIRST_DATE,
  JOURNAL,
  KNOT_TITLE,
  LAST_DATE,
  MEAN_RATING,
  MINUTES_PER_WEEK,
  RATING_PER_WEEK,
  MINUTES_LAST_30,
  NEXT_REVIEW_DAYS,
  PARTNER_COUNT,
  RATED_COUNT,
  REVIEW_IN_DAYS,
  SESSIONS_LAST_30,
  SESSIONS_LOGGED,
  SESSIONS_PER_WEEK,
  SESSIONS_PRIOR_30,
  fmtLearningDay,
  fmtMinutes,
  fmtReviewDue,
} from './learning-data'
import { LearningJournal } from './learning/journal'
import { noop, queryFor, retryCopy } from './shot-state'
import type { ScenarioProps } from './shot-state'

const SPARK_HEIGHT = 28
const RECORD_ERROR = queryFor('error', retryCopy('practice record'))
/** One wording for every gap on the page: the record has no sessions. */
const NO_SESSIONS = 'No sessions logged yet'

/** The headline wraps to four lines on a compact screen and two elsewhere: the skeleton holds the same height. */
function SummarySkeleton() {
  const lines = useSizeClass() === 'compact' ? 4 : 2
  return (
    <Stack gap={0} aria-busy="true" data-page-summary="">
      {Array.from({ length: lines }, (_, i) => (
        <Flex key={i} h={31} align="center">
          <Skeleton height={22} width={i === lines - 1 ? '45%' : '85%'} radius="sm" />
        </Flex>
      ))}
    </Stack>
  )
}

function LearningSummary({ shotState }: ScenarioProps) {
  if (shotState === 'loading') return <SummarySkeleton />
  if (shotState === 'empty') {
    return <PageSummary sentence={NO_SESSIONS} facts={['Log a session to start the record.']} />
  }
  // The one error of the page: the whole record is one source, so the strip, aside and journal stay quiet.
  if (shotState === 'error') {
    return (
      <Section title="Practice record" {...(RECORD_ERROR && { query: RECORD_ERROR })}>
        {null}
      </Section>
    )
  }
  const trend =
    SESSIONS_LAST_30 === SESSIONS_PRIOR_30
      ? 'level with'
      : SESSIONS_LAST_30 > SESSIONS_PRIOR_30
        ? 'up from'
        : 'down from'
  return (
    <PageSummary
      sentence={`${KNOT_TITLE}: practised ${SESSIONS_LAST_30} times in the last 30 days, ${trend} ${SESSIONS_PRIOR_30} — ${fmtReviewDue(REVIEW_IN_DAYS)}.`}
    />
  )
}

function LearningStrip({ shotState }: ScenarioProps) {
  const loading = shotState === 'loading'
  const empty = shotState === 'empty'
  // The summary owns the sentence about the gap; a cell prints its honest empty figure.
  const cellState: Pick<StatStripCell, 'state'> = empty ? { state: { kind: 'empty' } } : {}
  const spark = (
    ariaLabel: string,
    data: typeof SESSIONS_PER_WEEK,
    format: (v: number) => string,
  ) =>
    loading || empty
      ? {}
      : {
          visual: (
            <Box data-shot-hover>
              <Sparkline
                ariaLabel={ariaLabel}
                data={data}
                height={SPARK_HEIGHT}
                reference="mean"
                referenceLabel="12 wk mean"
                format={format}
              />
            </Box>
          ),
        }
  const cells: StatStripCell[] = [
    {
      key: 'sessions',
      caption: 'Sessions',
      qualifier: 'logged',
      info: `Every practice session logged for ${KNOT_TITLE}, since ${fmtLearningDay(FIRST_DATE)}. The sparkline shows sessions per week, last 12 weeks.`,
      value: empty ? '0' : fmtInt(SESSIONS_LOGGED),
      unit: 'sessions',
      loading,
      ...spark(
        'Sessions per week, last 12 weeks',
        SESSIONS_PER_WEEK,
        (v) => `${fmtInt(v)} sessions`,
      ),
    },
    {
      key: 'last-practised',
      caption: 'Last practised',
      info: `The date of the latest session. A review comes due ${NEXT_REVIEW_DAYS} days after it.`,
      value: fmtLearningDay(LAST_DATE),
      loading,
      ...cellState,
    },
    {
      key: 'mean-rating',
      caption: 'Mean rating',
      // The qualifier states the count behind the figure, so it only exists where there is a figure.
      ...(!empty && { qualifier: `of ${fmtInt(RATED_COUNT)} rated` }),
      info: 'Average of the 1–5 ratings you gave your sessions; unrated sessions are left out.',
      value: MEAN_RATING.toFixed(1),
      unit: 'of 5',
      loading,
      ...cellState,
      ...spark(
        'Mean rating per week, last 12 weeks',
        RATING_PER_WEEK,
        (v) => `${v.toFixed(1)} of 5`,
      ),
    },
    {
      key: 'minutes-30d',
      caption: 'Practice time',
      qualifier: 'last 30 days',
      info: 'Minutes logged across the last 30 days’ sessions. The sparkline shows minutes per week, last 12 weeks.',
      value: fmtMinutes(MINUTES_LAST_30),
      loading,
      ...cellState,
      ...spark('Practice minutes per week, last 12 weeks', MINUTES_PER_WEEK, fmtMinutes),
    },
  ]
  return (
    <StatGroup
      variant="strip"
      label="Learning record"
      cols={4}
      cells={cells}
      shotAbsent={['error']}
    />
  )
}

function AsideFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm">{children}</Text>
    </Stack>
  )
}

function AsideSkeleton() {
  return (
    <Stack gap="md" data-shot="learning-aside" aria-busy="true">
      {[0, 1].map((i) => (
        <Stack key={i} gap={6}>
          <Skeleton height={10} width="40%" radius="sm" />
          <Skeleton height={14} width="65%" radius="sm" />
        </Stack>
      ))}
    </Stack>
  )
}

function LearningAside({ shotState }: ScenarioProps) {
  // The anchor sits inside the aside: in the shell the panel portals into its own region, so a wrapper
  // beside it would measure zero on desktop.
  return (
    <PageAside title={KNOT_TITLE} persistKey="learning-record">
      {shotState === 'loading' ? (
        <AsideSkeleton />
      ) : shotState === 'error' ? (
        // The summary carries the one error; the aside only marks its own anchor absent.
        <Box data-shot="learning-aside" data-shot-absent="error" />
      ) : (
        <Stack gap="md" data-shot="learning-aside" data-shot-absent="error">
          <AsideFact label="First practised">
            {shotState === 'empty' ? '—' : fmtLearningDay(FIRST_DATE)}
          </AsideFact>
          <AsideFact label="Practice partners">
            {shotState === 'empty' ? '—' : fmtInt(PARTNER_COUNT)}
          </AsideFact>
        </Stack>
      )}
    </PageAside>
  )
}

export function LearningScenario({ shotState }: ScenarioProps) {
  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      {/* One action when the record is empty: the log. Review only means something once there is a record. */}
      <PageBar
        actions={
          shotState === 'empty'
            ? [{ key: 'log', label: 'Log a session', onClick: noop, primary: true }]
            : [
                { key: 'review', label: 'Start review', onClick: noop, primary: true },
                { key: 'log', label: 'Log a session', onClick: noop },
              ]
        }
      />
      <Box data-shot="learning-summary">
        <LearningSummary shotState={shotState} />
      </Box>
      <Box data-shot="learning-strip" data-shot-absent="error">
        {shotState !== 'error' && <LearningStrip shotState={shotState} />}
      </Box>
      <Box data-shot="learning-journal" data-shot-absent="empty error">
        {shotState !== 'error' && shotState !== 'empty' && (
          <Section title="Practice journal">
            <LearningJournal entries={JOURNAL} shotState={shotState} />
          </Section>
        )}
      </Box>
      <LearningAside shotState={shotState} />
    </Stack>
  )
}
