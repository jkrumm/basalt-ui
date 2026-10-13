/**
 * ContentOverviewPage — `GuideLink` (the contextual-help pattern) mounted in a couple of `StatCard`
 * action slots the way a real dashboard would use it ("this metric has a guide").
 */
import { Box, Group, Stack, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { Section, StatCard } from 'basalt-ui'
import { GuideLink } from 'basalt-ui/content'

const GUIDE_MARKDOWN_FIXTURE = `## How this metric is measured

The 95th-percentile latency is the value below which 95% of requests complete — it filters out
the average-latency blind spot where a handful of slow outliers get diluted into a comfortable
mean.

\`\`\`ts
export function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b)
  const index = Math.ceil(sorted.length * 0.95) - 1
  return sorted[index]
}
\`\`\`

> [!NOTE]
> A threshold breach for five sustained minutes pages on-call — see the full playbook for every
> threshold and response.
`

export function ContentOverviewPage() {
  return (
    <Stack gap="md">
      <Section title="Contextual guides">
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            GuideLink mounts a quiet trigger next to whatever it explains — here, in a StatCard's
            actions slot — and opens a GuideDrawer without leaving the page.
          </Text>
          <Group gap="md" align="flex-start" wrap="wrap">
            <Box w={220}>
              <StatCard
                title="P95 Latency"
                value="312ms"
                delta={-4.2}
                deltaPeriod="WoW"
                actions={
                  <GuideLink
                    title="How p95 latency is measured"
                    markdown={GUIDE_MARKDOWN_FIXTURE}
                    fullPageHref="/content"
                    renderLink={(target, node) => <Link to={target.href as never}>{node}</Link>}
                  />
                }
              />
            </Box>
            <Box w={220}>
              <StatCard
                title="Error budget"
                value="42%"
                actions={
                  <GuideLink
                    title="How error budget is tracked"
                    markdown={GUIDE_MARKDOWN_FIXTURE}
                    iconOnly
                  />
                }
              />
            </Box>
          </Group>
        </Stack>
      </Section>
    </Stack>
  )
}
