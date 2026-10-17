import { Group, Stack, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { Section } from 'basalt-ui'
import { SCENARIO_INFO } from '../scenarios/scenario-info'

/** The playground's landing page: every scenario a human opens, one line each. */
export function ScenarioIndex() {
  return (
    <Section
      title="Scenarios"
      subtitle="Whole pages built on basalt, each answering one question with one decision."
      count={SCENARIO_INFO.length}
    >
      <Stack gap="sm">
        {SCENARIO_INFO.map(({ id, title, blurb }) => (
          <Group key={id} gap="xs" align="baseline">
            <Text fw={500}>
              <Link to="/scenarios/$name" params={{ name: id }}>
                {title}
              </Link>
            </Text>
            <Text size="sm" c="dimmed">
              {blurb}
            </Text>
          </Group>
        ))}
      </Stack>
    </Section>
  )
}
