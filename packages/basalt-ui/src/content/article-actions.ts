/**
 * toArticleActions — projects an article list into Mantine Spotlight actions
 * (docs/CONTENT-SPEC.md). A pure in-memory PROJECTOR into the already-shipped Spotlight surface —
 * the same tier as `toRouteActions` (`basalt-ui/commands`). It does not tokenize, rank, index, or
 * persist; an app that outgrows substring matching brings its own index.
 *
 * `SpotlightActionData` is imported TYPE-ONLY — it erases at build, so `./content` stays a types-
 * only optional peer of `@mantine/spotlight` and adds no runtime edge. The consumer merges the
 * result into its own `<Spotlight>`/`toSpotlightActions()` action array.
 *
 * @example
 * const articleActions = toArticleActions(ARTICLES, {
 *   onNavigate: (href) => router.navigate({ to: href as never }),
 *   href: (article) => (article.slug === 'reading-dashboards' ? '/content' : '#'),
 *   group: 'Guides',
 * })
 */
import type { SpotlightActionData } from '@mantine/spotlight'
import type { ReactNode } from 'react'
import type { Article } from './article-model'

export type ToArticleActionsOptions = {
  /** Navigate to an article's href — e.g. `(href) => router.navigate({ to: href })`. */
  onNavigate: (href: string) => void
  /** Consumer owns routing — maps an article to its destination href. */
  href: (article: Article) => string
  /** Prefix for generated action ids so they never collide with route/command ids. Default 'article:'. */
  idPrefix?: string
  /** Spotlight group for every produced action (e.g. 'Guides'). Omit for an ungrouped, flat list. */
  group?: string
  /** Node rendered on the right of every action — e.g. a kind badge (`<Badge>Guide</Badge>`). */
  rightSection?: ReactNode
}

/**
 * Project an article list into Mantine Spotlight actions. `keywords` joins title, description,
 * category, tags, and slug — this is why tags/category live on the model, they make an article
 * findable by topic even when the title itself doesn't mention it.
 */
export function toArticleActions(
  articles: readonly Article[],
  options: ToArticleActionsOptions,
): SpotlightActionData[] {
  const { onNavigate, href, idPrefix = 'article:', group, rightSection } = options
  const actions: SpotlightActionData[] = []

  for (const article of articles) {
    const target = href(article)
    const keywords = [
      article.title,
      article.description,
      article.category,
      ...(article.tags ?? []),
      article.slug,
    ]
      .filter((part): part is string => part !== undefined)
      .join(' ')

    const action: SpotlightActionData = {
      id: `${idPrefix}${target}`,
      label: article.title,
      keywords,
      onClick: () => onNavigate(target),
    }
    if (article.description !== undefined) action.description = article.description
    if (group !== undefined) action.group = group
    if (rightSection !== undefined) action.rightSection = rightSection
    actions.push(action)
  }

  return actions
}
