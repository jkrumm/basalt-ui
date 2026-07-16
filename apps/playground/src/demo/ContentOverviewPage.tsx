/**
 * ContentOverviewPage — a docs-landing demo exercising the docs-framing layer of
 * `basalt-ui/content`: `ArticleFilterBar` + `filterArticles`/`sortArticles` over the fixture
 * article list (`ARTICLES`), rendered through the shipped `ArticleGrid`/`ArticleCard`, plus
 * `GuideLink`/`GuideDrawer` (the contextual-help pattern) mounted next to a couple of `StatCard`s
 * the way a real dashboard would use them ("this metric has a guide").
 */
import { Group, Stack, Text, Title } from '@mantine/core'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { EmptyState, StatCard } from 'basalt-ui'
import {
  ArticleCard,
  ArticleFilterBar,
  ArticleGrid,
  filterArticles,
  GuideLink,
  sortArticles,
} from 'basalt-ui/content'
import type { ArticleNavTarget } from 'basalt-ui/content'
import type { ReactNode } from 'react'
import { articleCategory, articleTags } from './article-filter-stores'
import { ARTICLE_CATEGORIES, ARTICLE_TAGS, ARTICLES, articleHref } from './articles'
import type { ArticleCategory } from './articles'
import { IconSearch } from './icons'

// getRouteApi (not `Route.useSearch()`) sidesteps a circular import between this file and
// routes/content-overview.tsx (which imports THIS component) — same route, same search schema,
// no Route binding to import back.
const route = getRouteApi('/content-overview')

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

const CATEGORY_LABELS: Record<ArticleCategory, string> = {
  guide: 'Guide',
  reference: 'Reference',
  pattern: 'Pattern',
}

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All' },
  ...ARTICLE_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] })),
]

export function ContentOverviewPage() {
  // route.useSearch() is safe here (unlike the sibling-route hazard `createSearchParamStore`'s
  // JSDoc warns about) because ContentOverviewPage IS this route's own `component` — not a page
  // rendered from a sibling route.
  const { category, tags } = route.useSearch()
  const [, persistCategory] = articleCategory.useStore()
  const [, persistTags] = articleTags.useStore()
  const navigate = useNavigate()

  // 'all' is a UI sentinel added by the filter bar, not an `Article` model concept —
  // filterArticles treats undefined/'' as "no constraint" and deliberately does NOT special-case
  // 'all' (a consumer could legitimately have a category literally named 'all').
  const effectiveCategory = category === 'all' ? undefined : category
  const articles = sortArticles(
    filterArticles(ARTICLES, {
      ...(effectiveCategory !== undefined && { category: effectiveCategory }),
      tags,
    }),
  )

  return (
    <Stack gap="xl" p="md">
      <div>
        <Title order={2}>Guides</Title>
        <Text size="sm" c="dimmed" mt={4}>
          Every article below is rendered by the SAME basalt-ui/content primitives — hand-authored
          JSX, a rendered markdown file, or an MDX guide are visually indistinguishable.
        </Text>
      </div>

      <ArticleFilterBar
        categories={CATEGORY_OPTIONS}
        category={category}
        onCategoryChange={(next) => {
          const value = next as typeof category
          persistCategory(value)
          navigate({ to: '.', search: (prev) => ({ ...prev, category: value }) })
        }}
        tags={ARTICLE_TAGS}
        selectedTags={tags}
        onTagsChange={(next) => {
          const value = next as typeof tags
          persistTags(value)
          navigate({ to: '.', search: (prev) => ({ ...prev, tags: value }) })
        }}
      />

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
