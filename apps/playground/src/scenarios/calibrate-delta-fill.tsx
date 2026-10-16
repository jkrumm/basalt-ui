/**
 * Calibration seed — expected failing item: Craft 4 (accent/fill on chrome) / Expression 3 (a hue only
 * for a trend, status or category). Defect: the delta is a solid filled badge, not neutral text with a
 * trend glyph. Everything else on the card is clean.
 */
import { Badge, Card, Group, Text } from '@mantine/core'

export function CalibrateDeltaFill() {
  return (
    <Card py="xs" px="sm" data-shot="calibrate-delta-fill">
      <Text size="xs" c="dimmed">
        Spend, 1–16 Oct (€)
      </Text>
      <Group gap="xs" align="center">
        <Text data-numeric fw={600}>
          €1,240
        </Text>
        <Badge variant="filled" color="green" size="sm">
          +12 % vs 1–16 Sep
        </Badge>
      </Group>
    </Card>
  )
}
