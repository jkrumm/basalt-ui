import { Stack, Text, Paper, Group } from '@mantine/core'

export type SubPageProps = {
  title: string
  description: string
}

export function SubPage({ title, description }: SubPageProps) {
  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="xs">
          <Text fw={600} fz="lg">
            {title}
          </Text>
        </Group>
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      </Paper>
      <Paper p="md" withBorder>
        <Text size="sm" c="dimmed">
          Placeholder content for {title.toLowerCase()}. This sub-route demonstrates the sidebar
          sub-navigation — hover &quot;Dashboard&quot; in the sidebar to see the popover, or
          navigate here to see inline children.
        </Text>
      </Paper>
    </Stack>
  )
}
