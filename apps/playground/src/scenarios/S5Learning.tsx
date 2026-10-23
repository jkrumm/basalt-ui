/**
 * S5 — Learning record (stands for rb's knot detail and journal). docs/waves/design-parity/SPEC.md § 2.
 *
 *   Question: Where am I with this topic?
 *   Decision: Review it now or later.
 *
 * The record-page recipe (SPEC § 6.9): record header, one summary sentence, a joined strip (sessions,
 * last practised, mean rating, minutes this month), a pending decision card, the practice journal and
 * an aside with the practice partners as list rows. The journal body is `learning/journal.tsx`
 * (Wave 44: EventList fills it). Actions are inert in fixtures; they live in `PageBar`, the one home.
 *
 * Anchors for `basalt-ui shot`: `learning-header`, `learning-summary`, `learning-strip`,
 * `learning-decision`, `learning-journal`, `learning-aside`. `Section` and `PageAside` do not forward `data-*`, so each anchor is a wrapping `Box`.
 */
import { Avatar, Box, Button, Flex, Skeleton, Stack, Text } from '@mantine/core'
import {
  EmptyState,
  PageAside,
  PageBar,
  PageSummary,
  Section,
  StatGroup,
  useSizeClass,
} from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { Sparkline } from 'basalt-ui/charts'
import { DecisionCard, DecisionCardSkeleton } from './agents/decision-card'
import { ListRow } from './agents/list-row'
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
  PARTNERS_BY_SESSIONS,
  RECENT_RATINGS,
  RATED_COUNT,
  SESSIONS_LAST_30,
  SESSIONS_LOGGED,
  SESSIONS_PER_WEEK,
  SESSIONS_PRIOR_30,
  fmtLearningDay,
  fmtMinutes,
} from './learning-data'
import { RecordHeader } from './learning/header'
import { LearningJournal } from './learning/journal'
import { noop, queryFor, retryCopy } from './shot-state'
import type { ScenarioProps } from './shot-state'

const SPARK_HEIGHT = 28
const RECORD_ERROR = queryFor('error', retryCopy('practice record'))

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
  // Empty has no sentence to state: the tile in the main column says it once.
  if (shotState === 'empty') return null
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
      sentence={`Practised ${SESSIONS_LAST_30} times in the last 30 days, ${trend} ${SESSIONS_PRIOR_30} in the 30 days before.`}
    />
  )
}

function LearningStrip({ shotState }: ScenarioProps) {
  const loading = shotState === 'loading'
  const empty = shotState === 'empty'
  // A cell in empty prints the strip's rule: a dash and a muted reason line, never a bare zero.
  const cellState = (reason: string): Pick<StatStripCell, 'state'> =>
    empty ? { state: { kind: 'empty', reason } } : {}
  const spark = (
    ariaLabel: string,
    data: typeof SESSIONS_PER_WEEK,
    format: (v: number) => string,
  ) =>
    empty
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
      value: fmtInt(SESSIONS_LOGGED),
      unit: 'sessions',
      loading,
      ...cellState('No sessions logged yet'),
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
      ...cellState('Nothing practised yet'),
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
      ...cellState('No sessions rated yet'),
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
      ...cellState('No practice in the last 30 days'),
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

const initial = (name: string): string => name.charAt(0).toUpperCase()

function PartnerRows() {
  return (
    <Stack gap={0}>
      {PARTNERS_BY_SESSIONS.map((p) => (
        <ListRow
          key={p.name}
          glyph={
            <Avatar size="sm" radius="md" color="gray" aria-hidden="true">
              {initial(p.name)}
            </Avatar>
          }
          title={p.name}
          meta={`Last together ${fmtLearningDay(p.last)}`}
          trailing={
            <Text size="xs" c="dimmed" ff="monospace">
              {fmtInt(p.sessions)}
            </Text>
          }
          onClick={noop}
        />
      ))}
    </Stack>
  )
}

function AsideSkeleton() {
  return (
    <Stack gap="xs" data-shot="learning-aside" aria-busy="true">
      <Text size="xs" c="dimmed">
        Practice partners · sessions together
      </Text>
      <Stack gap="md">
        {PARTNERS_BY_SESSIONS.map((p) => (
          <Flex key={p.name} gap="xs" align="center">
            <Skeleton height={26} width={26} radius="md" />
            <Stack gap={6} flex={1}>
              <Skeleton height={12} width="40%" radius="sm" />
              <Skeleton height={10} width="65%" radius="sm" />
            </Stack>
          </Flex>
        ))}
      </Stack>
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
        <Box data-shot="learning-aside" data-shot-absent="error">
          <Stack gap="xs">
            <Text size="xs" c="dimmed">
              Practice partners · sessions together
            </Text>
            {shotState === 'empty' ? (
              <EmptyState
                tier="section"
                title="No practice partners yet"
                description="Partners appear with the first session you log together."
              />
            ) : (
              <PartnerRows />
            )}
          </Stack>
        </Box>
      )}
    </PageAside>
  )
}

/** The pending decision: the review the spaced-repetition interval has put in front of the user. */
function LearningDecision({ shotState }: ScenarioProps) {
  if (shotState === 'loading') return <DecisionCardSkeleton />
  if (shotState === 'empty' || shotState === 'error') return null
  return (
    <DecisionCard
      // The header names the topic and its due date and the strip its dates and mean, so the card
      // states only what the decision adds: the interval it would cut short.
      question="Next review"
      facts={[`${NEXT_REVIEW_DAYS}-day review interval`]}
      evidence={
        <Text size="sm">
          {`Your last ${RECENT_RATINGS.length} rated sessions scored ${RECENT_RATINGS.join(', ')} of 5.`}
        </Text>
      }
      primary={{ label: 'Start review', keyHint: 'R', onClick: noop }}
      secondary={{ label: 'Snooze a day', keyHint: 'S', onClick: noop }}
      quiet={{ label: 'Skip', keyHint: 'X', onClick: noop }}
    />
  )
}

export function LearningScenario({ shotState }: ScenarioProps) {
  const empty = shotState === 'empty'
  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      {/* Review lives in the decision card; the page's one primary is logging, the verb that makes a record. */}
      {/* In empty the tile's button is the one "Log a session"; the bar's would be a second home. */}
      {!empty && (
        <PageBar actions={[{ key: 'log', label: 'Log a session', onClick: noop, primary: true }]} />
      )}
      <Box data-shot="learning-header" data-shot-absent="error">
        {shotState !== 'error' && <RecordHeader shotState={shotState} />}
      </Box>
      <Box data-shot="learning-summary" data-shot-absent="empty">
        <LearningSummary shotState={shotState} />
      </Box>
      <Box data-shot="learning-strip" data-shot-absent="error">
        {shotState !== 'error' && <LearningStrip shotState={shotState} />}
      </Box>
      <Box data-shot="learning-decision" data-shot-absent="empty error">
        <LearningDecision shotState={shotState} />
      </Box>
      <Box data-shot="learning-journal" data-shot-absent="error">
        {shotState !== 'error' && (
          <Section title="Practice journal">
            {empty ? (
              <EmptyState
                tier="section"
                title="No sessions logged yet"
                description="Log a session to start the record; the first review follows four days later."
                action={
                  <Button size="xs" onClick={noop} data-shot-hover>
                    Log a session
                  </Button>
                }
              />
            ) : (
              <LearningJournal entries={JOURNAL} shotState={shotState} />
            )}
          </Section>
        )}
      </Box>
      <LearningAside shotState={shotState} />
    </Stack>
  )
}
