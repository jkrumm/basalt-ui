/**
 * ContentOverviewPage — a docs-landing demo exercising the docs-framing layer of
 * `basalt-ui/content`: `ArticleGrid`/`ArticleCard` (the overview card grid) and
 * `GuideLink`/`GuideDrawer` (the contextual-help pattern), mounted next to a couple of `StatCard`s
 * the way a real dashboard would use them ("this metric has a guide").
 */
import { Group, Stack, Text, Title } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { StatCard } from 'basalt-ui'
import { ArticleCard, ArticleGrid, GuideLink } from 'basalt-ui/content'
import { IconActivity, IconChart, IconSearch } from './icons'

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
    <Stack gap="xl" p="md">
      <div>
        <Title order={2}>Guides</Title>
        <Text size="sm" c="dimmed" mt={4}>
          Every article below is rendered by the SAME basalt-ui/content primitives — hand-authored
          JSX, a rendered markdown file, or an MDX guide are visually indistinguishable.
        </Text>
      </div>

      <ArticleGrid>
        <ArticleCard
          title="Reading dashboards"
          description="Why most internal dashboards fail the five-second glance test."
          meta="6 min read · guide"
          icon={<IconActivity />}
          href="/content"
          renderLink={(target, node) => <Link to={target.href as never}>{node}</Link>}
        />
        <ArticleCard
          title="Chart guide"
          description="Picking chart kinds, series colors, and when to go bespoke."
          meta="5 min read · guide"
          icon={<IconChart />}
          href="#"
        />
        <ArticleCard
          title="Streaming markdown"
          description="Rendering AI-streamed prose safely, block by block."
          meta="4 min read · guide"
          href="#"
        />
        <ArticleCard
          title="Theming"
          description="Tuning the --vx-* token system for light and dark."
          meta="7 min read · guide"
          href="#"
        />
        <ArticleCard
          title="Search & commands"
          description="Wiring Spotlight search over your own route/article list."
          meta="3 min read · guide"
          icon={<IconSearch />}
          href="#"
        />
        <ArticleCard
          title="Deployment"
          description="Shipping a TanStack Start app with content-collections."
          meta="5 min read · guide"
          href="#"
        />
      </ArticleGrid>

      <div>
        <Title order={3}>Contextual guides</Title>
        <Text size="sm" c="dimmed" mt={4}>
          GuideLink mounts a quiet trigger next to whatever it explains — here, in a StatCard's menu
          slot — and opens a GuideDrawer without leaving the page.
        </Text>
      </div>

      <Group gap="md" align="flex-start" wrap="wrap">
        <div style={{ width: 220 }}>
          <StatCard
            label="P95 Latency"
            value="312ms"
            delta={-4.2}
            deltaPeriod="WoW"
            menu={
              <GuideLink
                title="How p95 latency is measured"
                markdown={GUIDE_MARKDOWN_FIXTURE}
                fullPageHref="/content"
                renderLink={(target, node) => <Link to={target.href as never}>{node}</Link>}
              />
            }
          />
        </div>
        <div style={{ width: 220 }}>
          <StatCard
            label="Error budget"
            value="42%"
            menu={
              <GuideLink
                title="How error budget is tracked"
                markdown={GUIDE_MARKDOWN_FIXTURE}
                iconOnly
              />
            }
          />
        </div>
      </Group>
    </Stack>
  )
}
