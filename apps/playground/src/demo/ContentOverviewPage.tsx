/**
 * ContentOverviewPage — a docs-landing demo exercising the docs-framing layer of
 * `basalt-ui/content`: `filterArticles`/`sortArticles` over the fixture article list (`ARTICLES`),
 * rendered through the shipped `ArticleGrid`/`ArticleCard`, plus `GuideLink`/`GuideDrawer` (the
 * contextual-help pattern) mounted in a couple of `StatCard` action slots the way a real dashboard
 * would use them ("this metric has a guide").
 *
 * The filter bar is the replacement for the removed controlled `ArticleFilterBar`: a `ViewTabs`
 * over the category axis and a `MultiSelectFilter` over tags, both bound to `articleFilters` by
 * `FieldHandle`. There is no `useState`, no `onChange` and no `navigate` here — each control owns
 * its URL param and its localStorage mirror (laws C2/C3), and both live inside `PageBar` slots
 * rather than a hand-rolled row (law C1).
 */
import { Box, Group, Stack, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { EmptyState, PageBar, Section, StatCard } from 'basalt-ui'
import {
  ArticleCard,
  ArticleGrid,
  filterArticles,
  FilterSet,
  GuideLink,
  MultiSelectFilter,
  sortArticles,
  ViewTabs,
} from 'basalt-ui/content'
import type { ArticleNavTarget } from 'basalt-ui/content'
import type { ReactNode } from 'react'
import { articleFilters } from './article-filter-stores'
import { ARTICLES, articleHref } from './articles'
import { IconSearch } from './icons'

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
  // The store's own reader — no `useSearch({ from: '/content-overview' })`, which would break the
  // moment this component rendered under a sibling route (law C10).
  const { category, tags } = articleFilters.useValues()

  // 'all' is a UI sentinel declared on the store, not an `Article` model concept — filterArticles
  // treats undefined as "no constraint" and deliberately does NOT special-case 'all'.
  const effectiveCategory = category === 'all' ? undefined : category
  const articles = sortArticles(
    filterArticles(ARTICLES, {
      ...(effectiveCategory !== undefined && { category: effectiveCategory }),
      tags,
    }),
  )

  return (
    <Stack gap="md">
      <PageBar
        tabs={<ViewTabs field={articleFilters.field.category} />}
        filters={
          <FilterSet>
            <MultiSelectFilter field={articleFilters.field.tags} label="All tags" noun="tags" />
          </FilterSet>
        }
      />

      <Section
        title="Guides"
        subtitle="Every article below is rendered by the SAME basalt-ui/content primitives — hand-authored JSX, a rendered markdown file, or an MDX guide are visually indistinguishable."
        count={articles.length}
      >
        {articles.length === 0 ? (
          <EmptyState
            icon={<IconSearch />}
            title="No matching guides"
            description="Try a different category or clear the selected tags."
            variant="section"
          />
        ) : (
          <ArticleGrid>
            {articles.map((article) => {
              const href = articleHref(article)
              const isRealRoute = href !== '#'
              return (
                <ArticleCard
                  key={article.slug}
                  title={article.title}
                  description={article.description}
                  date={article.date}
                  category={article.category}
                  tags={article.tags}
                  readingTime={article.readingTime}
                  href={href}
                  {...(isRealRoute && {
                    renderLink: (target: ArticleNavTarget, node: ReactNode) => (
                      <Link to={target.href as never}>{node}</Link>
                    ),
                  })}
                />
              )
            })}
          </ArticleGrid>
        )}
      </Section>

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
