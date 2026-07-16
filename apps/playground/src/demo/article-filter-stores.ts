import { createMultiSearchParamStore, createSearchParamStore } from 'basalt-ui/router-tanstack'
import { ARTICLE_TAGS, ARTICLE_CATEGORIES } from './articles'

/**
 * Shared stores for the content-overview filter bar. `validateSearch` from both goes on
 * `routes/content-overview.tsx`; `useStore()` is called in `ContentOverviewPage`.
 *
 * `'all'` is a UI sentinel added only here, not an `Article` model concept — `filterArticles`
 * treats `undefined`/`''` as "no constraint" and deliberately does NOT special-case `'all'` (a
 * consumer could legitimately have a category literally named `'all'`), so the page maps
 * `category === 'all' ? undefined : category` before calling it.
 */
export const articleCategory = createSearchParamStore({
  key: 'article-category',
  param: 'category',
  values: ['all', ...ARTICLE_CATEGORIES] as const,
  fallback: 'all',
})

export const articleTags = createMultiSearchParamStore({
  key: 'article-tags',
  param: 'tags',
  values: ARTICLE_TAGS,
})
