/**
 * Decision-card recipe (SPEC § 6.9), modelled on argo's upstream card: the question is the headline
 * (`md` 500), one muted facts line, an inset evidence panel, then one primary, one secondary and one
 * quiet action with key hints. A recipe, not an export (D4): built from Mantine and `VX`.
 * Actions are inert in fixtures. S5 imports it for its review, S3 for the oldest awaiting item.
 */
import { Box, Button, Card, Group, Kbd, Skeleton, Stack, Text } from '@mantine/core'
import { VX } from 'basalt-ui/tokens'
import type { ReactNode } from 'react'

export type DecisionAction = { label: string; keyHint: string; onClick: () => void }

export type DecisionCardProps = {
  /** The headline, written as the question the owner answers. */
  question: string
  /** One muted line, `·`-separated; every entry states a fact. */
  facts: readonly string[]
  /** The reasoning behind the question, in the inset panel. */
  evidence: ReactNode
  primary: DecisionAction
  secondary: DecisionAction
  quiet: DecisionAction
}

function ActionButton({
  action,
  variant,
}: {
  action: DecisionAction
  variant: 'filled' | 'default' | 'subtle'
}) {
  return (
    <Button
      size="xs"
      variant={variant}
      onClick={action.onClick}
      rightSection={<Kbd size="xs">{action.keyHint}</Kbd>}
    >
      {action.label}
    </Button>
  )
}

export function DecisionCard({
  question,
  facts,
  evidence,
  primary,
  secondary,
  quiet,
}: DecisionCardProps) {
  return (
    <Card>
      <Stack gap="sm">
        <Stack gap={2}>
          <Text component="h3" m={0} fz="md" fw={500}>
            {question}
          </Text>
          <Text size="xs" c="dimmed">
            {facts.join(' · ')}
          </Text>
        </Stack>
        <Box bg={VX.surface.field} bdrs={VX.radiusCtrl} p="sm">
          {evidence}
        </Box>
        <Group gap="xs" wrap="wrap">
          <ActionButton action={primary} variant="filled" />
          <ActionButton action={secondary} variant="default" />
          <ActionButton action={quiet} variant="subtle" />
        </Group>
      </Stack>
    </Card>
  )
}

/** The card's shape while its question loads: headline, facts line, inset, three actions. */
export function DecisionCardSkeleton() {
  return (
    <Card aria-busy="true">
      <Stack gap="sm">
        <Stack gap={6}>
          <Skeleton height={18} width="55%" radius="sm" />
          <Skeleton height={12} width="40%" radius="sm" />
        </Stack>
        <Skeleton height={44} radius="sm" />
        <Group gap="xs">
          <Skeleton height={28} width={120} radius="sm" />
          <Skeleton height={28} width={96} radius="sm" />
          <Skeleton height={28} width={72} radius="sm" />
        </Group>
      </Stack>
    </Card>
  )
}
