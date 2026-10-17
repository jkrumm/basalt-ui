/**
 * Calibration seed — expected failing item: Craft 4 (accent/fill on chrome) / Expression 3 (a hue only
 * for a trend, status or category). Defect: the delta is a solid filled badge, not neutral text with a
 * trend glyph. Everything else on the card is clean.
 */
import { Badge, Card, Group, Text } from '@mantine/core'
import { MTD_EUR, PRIOR_MTD_EUR, PRIOR_WINDOW_LABEL, WINDOW_LABEL } from './spend-data'
import { fmtEur, fmtSignedShare } from './fixture-utils'

export function CalibrateDeltaFill() {
  return (
    <Card py="sm" px="md" data-shot="probe-5">
      <Text size="xs" c="dimmed">
        Spend, {WINDOW_LABEL} (€)
      </Text>
      <Group gap="xs" align="center">
        <Text data-numeric fw={600}>
          {fmtEur(MTD_EUR)}
        </Text>
        <Badge variant="filled" color="green" size="sm">
          {fmtSignedShare(MTD_EUR / PRIOR_MTD_EUR - 1)} vs {PRIOR_WINDOW_LABEL}
        </Badge>
      </Group>
    </Card>
  )
}
