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
import { Box, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { PageAside, PageBar, PageSummary, Section, StatGroup } from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { fmtInt } from './fixture-utils'
import {
  DAYS_SINCE_LAST,
  FIRST_DATE,
  JOURNAL,
  KNOT_TITLE,
  LAST_DATE,
  MEAN_RATING,
  MINUTES_THIS_MONTH,
  NEXT_REVIEW,
  NEXT_REVIEW_DAYS,
  PARTNER_COUNT,
  RATED_COUNT,
  SESSIONS_LOGGED,
  SESSIONS_THIS_MONTH,
  fmtLearningDate,
  fmtLearningDay,
  fmtMinutes,
  fmtSince,
} from './learning-data'
import { LearningJournal } from './learning/journal'
import { noop, retryCopy } from './shot-state'
import type { ScenarioProps } from './shot-state'

const EMPTY_COPY = `No sessions logged for ${KNOT_TITLE}. Log a session to start the record.`
const retry = (): string => retryCopy('journal')

function LearningSummary({ shotState }: ScenarioProps) {
  if (shotState === 'loading') return <PageSummary loading facts={[]} />
  if (shotState === 'empty') {
    return <PageSummary sentence="0 sessions logged" facts={[EMPTY_COPY]} />
  }
  if (shotState === 'error') {
    return <PageSummary sentence="Record unavailable" facts={[retry()]} />
  }
  return (
    <PageSummary
      sentence={`${KNOT_TITLE}: ${fmtInt(SESSIONS_LOGGED)} sessions, last ${fmtSince(DAYS_SINCE_LAST)}`}
      facts={[
        `review due ${fmtLearningDate(NEXT_REVIEW)}`,
        `${fmtInt(SESSIONS_THIS_MONTH)} sessions this month`,
        `mean rating ${MEAN_RATING.toFixed(1)} of 5`,
      ]}
    />
  )
}

function LearningStrip({ shotState }: ScenarioProps) {
  const loading = shotState === 'loading'
  const cellState = (reason: string): Pick<StatStripCell, 'state'> =>
    shotState === 'error'
      ? { state: { kind: 'error', error: new Error(retry()), onRetry: noop } }
      : shotState === 'empty'
        ? { state: { kind: 'empty', reason } }
        : {}
  const cells: StatStripCell[] = [
    {
      key: 'sessions',
      caption: 'Sessions',
      qualifier: 'logged',
      info: `Every practice session logged for ${KNOT_TITLE}, since ${fmtLearningDay(FIRST_DATE)}.`,
      value: fmtInt(SESSIONS_LOGGED),
      unit: 'sessions',
      loading,
      ...cellState(EMPTY_COPY),
    },
    {
      key: 'last-practised',
      caption: 'Last practised',
      info: `The date of the latest session. A review comes due ${NEXT_REVIEW_DAYS} days after it.`,
      value: fmtLearningDay(LAST_DATE),
      loading,
      ...cellState('Nothing practised yet, so there is no date. Log a session to start.'),
    },
    {
      key: 'mean-rating',
      caption: 'Mean rating',
      qualifier: `of ${fmtInt(RATED_COUNT)} rated`,
      info: 'Average of the 1–5 ratings you gave your sessions; unrated sessions are left out.',
      value: MEAN_RATING.toFixed(1),
      unit: 'of 5',
      loading,
      ...cellState('No rated sessions. Rate a session to see how it is going.'),
    },
    {
      key: 'minutes-month',
      caption: 'Practice time',
      qualifier: 'this month',
      info: 'Minutes logged across this month’s sessions.',
      value: fmtMinutes(MINUTES_THIS_MONTH),
      loading,
      ...cellState('No sessions this month. Log one to start counting.'),
    },
  ]
  return <StatGroup variant="strip" label="Learning record" cols={4} cells={cells} />
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

function LearningAside({ shotState }: ScenarioProps) {
  const text = (value: ReactNode): ReactNode =>
    shotState === 'loading'
      ? '…'
      : shotState === 'empty'
        ? 'Not yet'
        : shotState === 'error'
          ? 'Unavailable'
          : value
  // The anchor sits inside the aside: in the shell the panel portals into its own region, so a wrapper
  // beside it would measure zero on desktop.
  return (
    <PageAside title="Record facts" persistKey="learning-record">
      <Stack gap="md" data-shot="learning-aside">
        <AsideFact label="First practised">{text(fmtLearningDay(FIRST_DATE))}</AsideFact>
        <AsideFact label="Practice partners">
          {text(`${fmtInt(PARTNER_COUNT)} different partners`)}
        </AsideFact>
        <AsideFact label="Next review due">
          {text(`${fmtLearningDate(NEXT_REVIEW)}, in ${NEXT_REVIEW_DAYS - DAYS_SINCE_LAST} days`)}
        </AsideFact>
        {shotState === 'error' && (
          <Text size="xs" c="dimmed">
            {retry()}
          </Text>
        )}
      </Stack>
    </PageAside>
  )
}

export function LearningScenario({ shotState }: ScenarioProps) {
  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      <PageBar
        actions={[{ key: 'log', label: 'Log a session', onClick: () => {}, primary: true }]}
      />
      <Box data-shot="learning-summary">
        <LearningSummary shotState={shotState} />
      </Box>
      <Box data-shot="learning-strip">
        <LearningStrip shotState={shotState} />
      </Box>
      <Box data-shot="learning-journal">
        <Section title="Practice journal">
          <LearningJournal entries={shotState === 'empty' ? [] : JOURNAL} shotState={shotState} />
        </Section>
      </Box>
      <LearningAside shotState={shotState} />
    </Stack>
  )
}
