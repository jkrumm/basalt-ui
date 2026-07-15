import type { CSSProperties } from 'react'
import { Stack, Text, Paper, Group, Badge } from '@mantine/core'
import { VX } from 'basalt-ui/tokens'

// Matches the shipped ChartCard/SettingsSection title style (head font, 88% stretch, weight 550,
// VX.text.md) so this hand-rolled title reads as the SAME card chrome as the shipped composites.
const titleStyle: CSSProperties = {
  fontFamily: 'var(--basalt-font-head)',
  fontStretch: '88%',
  fontWeight: 550,
  fontSize: VX.text.md,
  color: VX.ink,
}

export type SubPageProps = {
  title: string
  description: string
  range?: string | undefined
}

export function SubPage({ title, description, range }: SubPageProps) {
  return (
    <Stack gap="md">
      <Paper py="xs" px="sm">
        <Group justify="space-between" mb="xs">
          <Text style={titleStyle}>{title}</Text>
          {range ? (
            <Badge size="sm" variant="light">
              {range}
            </Badge>
          ) : null}
        </Group>
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      </Paper>
      <Paper py="xs" px="sm">
        <Text size="sm" c="dimmed">
          Placeholder content for {title.toLowerCase()}. This sub-route demonstrates the sidebar
          sub-navigation — hover &quot;Dashboard&quot; in the sidebar to see the popover, or
          navigate here to see inline children.
        </Text>
      </Paper>
    </Stack>
  )
}
