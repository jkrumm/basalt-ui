/**
 * Record header (SPEC § 6.9 record page): avatar tile, title, one badge, one mono facts line. The
 * actions stay in `PageBar`: basalt-controls.md gives a control exactly one home, and a button beside
 * the title has none. The title is a `Text`, never an in-body `Title` (basalt/in-body-page-title).
 */
import { Avatar, Badge, Flex, Group, Skeleton, Stack, Text } from '@mantine/core'
import {
  FIRST_DATE,
  KNOT_TITLE,
  PARTNER_COUNT,
  REVIEW_IN_DAYS,
  fmtLearningDay,
  fmtReviewDue,
} from '../learning-data'
import type { ShotState } from '../shot-state'

const initials = KNOT_TITLE.split(' ')
  .map((w) => w.charAt(0))
  .join('')
  .toUpperCase()

/** The facts line: since when, with how many partners. A record with no sessions has neither. */
export const headerFacts = (empty: boolean): string =>
  empty
    ? 'No sessions logged yet'
    : `Since ${fmtLearningDay(FIRST_DATE)} · ${PARTNER_COUNT} practice partners`

export function RecordHeaderSkeleton() {
  return (
    <Group gap="sm" wrap="nowrap" aria-busy="true">
      <Skeleton height={40} width={40} radius="md" />
      <Stack gap={6} flex={1}>
        <Skeleton height={18} width="35%" radius="sm" />
        <Skeleton height={12} width="55%" radius="sm" />
      </Stack>
    </Group>
  )
}

export function RecordHeader({ shotState }: { shotState: ShotState | undefined }) {
  if (shotState === 'loading') return <RecordHeaderSkeleton />
  const empty = shotState === 'empty'
  return (
    <Group gap="sm" wrap="nowrap" align="center">
      <Avatar size={40} radius="md" color="gray" aria-hidden="true">
        {initials}
      </Avatar>
      <Stack gap={2} miw={0}>
        <Flex gap="xs" align="center" wrap="wrap">
          <Text component="div" m={0} fz="lg" fw={500}>
            {KNOT_TITLE}
          </Text>
          {!empty && (
            <Badge color={REVIEW_IN_DAYS <= 0 ? 'orange' : 'gray'}>
              {fmtReviewDue(REVIEW_IN_DAYS).replace(/^a review is/, 'Review')}
            </Badge>
          )}
        </Flex>
        <Text size="xs" c="dimmed" ff="monospace">
          {headerFacts(empty)}
        </Text>
      </Stack>
    </Group>
  )
}
