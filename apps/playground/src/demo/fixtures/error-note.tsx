import { Button, Group, Stack, Text } from '@mantine/core'
import { StatusDot } from 'basalt-ui'
import { VX } from 'basalt-ui/tokens'

/**
 * The house error anatomy for a fixture that sits outside a `QueryState` host: the status dot and
 * the title, the cause in one line, one Retry. `ErrorState` is not a public export.
 */
export function ErrorNote({
  title,
  cause,
  onRetry,
}: {
  title: string
  cause: string
  onRetry: () => void
}) {
  return (
    <Stack gap="xs" role="alert">
      <Group gap="xs" wrap="nowrap">
        <StatusDot color={VX.status.bad} />
        <Text size="sm" fw={500}>
          {title}
        </Text>
      </Group>
      <Text size="sm" c="dimmed">
        {cause}
      </Text>
      <Group gap="xs">
        <Button size="xs" variant="default" onClick={onRetry}>
          Retry
        </Button>
      </Group>
    </Stack>
  )
}
