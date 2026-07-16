/**
 * The playground's article vocabulary + fixture — the consumer-side declaration `Article<C, T>`
 * is generic over. Mirrors the `VX.series` pattern applied to content: the framework ships the
 * generic model (`basalt-ui/content`), the consumer declares which categories/tags actually exist.
 * `ARTICLES` feeds both `ContentOverviewPage`'s grid and the Spotlight article actions (see
 * `main.tsx`'s `spotlightActions`).
 */
import type { Article } from 'basalt-ui/content'

export const ARTICLE_CATEGORIES = ['guide', 'reference', 'pattern'] as const
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]

export const ARTICLE_TAGS = ['dashboards', 'charts', 'design', 'streaming', 'tokens'] as const
export type ArticleTag = (typeof ARTICLE_TAGS)[number]

/** Only `reading-dashboards` routes anywhere real — every other slug is a fixture. */
export function articleHref(article: Pick<Article, 'slug'>): string {
  return article.slug === 'reading-dashboards' ? '/content' : '#'
}

export const ARTICLES = [
  {
    slug: 'reading-dashboards',
    title: 'Reading dashboards',
    description: 'Why most internal dashboards fail the five-second glance test.',
    date: '2026-07-01',
    category: 'guide',
    tags: ['dashboards'],
    readingTime: 6,
  },
  {
    slug: 'chart-guide',
    title: 'Chart guide',
    description: 'Picking chart kinds, series colors, and when to go bespoke.',
    date: '2026-06-20',
    category: 'reference',
    tags: ['charts', 'design'],
    readingTime: 5,
  },
  {
    slug: 'streaming-markdown',
    title: 'Streaming markdown',
    description: 'Rendering AI-streamed prose safely, block by block.',
    date: '2026-05-15',
    category: 'guide',
    tags: ['streaming'],
    readingTime: 4,
  },
  {
    slug: 'theming',
    title: 'Theming',
    description: 'Tuning the --vx-* token system for light and dark.',
    date: '2026-04-10',
    category: 'reference',
    tags: ['tokens', 'design'],
    readingTime: 7,
  },
  {
    slug: 'search-and-commands',
    title: 'Search & commands',
    description: 'Wiring Spotlight search over your own route/article list.',
    date: '2026-03-05',
    category: 'pattern',
    tags: ['design'],
    readingTime: 3,
  },
  {
    slug: 'deployment',
    title: 'Deployment',
    description: 'Shipping a TanStack Start app with content-collections.',
    date: '2026-02-18',
    category: 'guide',
    tags: ['tokens'],
    readingTime: 5,
  },
  {
    slug: 'dashboards-that-scale',
    title: 'Dashboards that scale',
    description: 'Composing StatCard/ChartCard grids that stay readable past a dozen KPIs.',
    date: '2026-07-10',
    category: 'pattern',
    tags: ['dashboards', 'charts'],
    readingTime: 6,
  },
  {
    slug: 'token-driven-charts',
    title: 'Token-driven charts',
    description:
      'Wiring visx series colors through the --vx-* token layer instead of hardcoded hex.',
    date: '2026-06-01',
    category: 'reference',
    tags: ['tokens', 'charts'],
    readingTime: 5,
  },
] satisfies readonly Article<ArticleCategory, ArticleTag>[]
