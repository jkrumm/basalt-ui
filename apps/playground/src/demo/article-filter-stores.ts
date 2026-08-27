import { createSearchStore, field } from 'basalt-ui/router-tanstack'
import { ARTICLE_CATEGORIES, ARTICLE_TAGS } from './articles'

/**
 * The content-overview filter state — ONE store over the two params the page filters on
 * (docs/CONTROLS-SPEC.md §4). `validateSearch` goes on `routes/content-overview.tsx`; the page
 * itself reads nothing by hand: `<ViewTabs field={…category}/>` and
 * `<MultiSelectFilter field={…tags}/>` own both lanes (C2), and the nav destination carries the
 * live selection through `search: articleFilters.linkSearch` (C10).
 *
 * The two params keep the names they had as a `createSearchParamStore` +
 * `createMultiSearchParamStore` pair, so `?category=guide&tags=charts` still resolves. What
 * changed is the mirror: one entry per STORE (`basalt:article-filters`) instead of one bare value
 * per param, which is why the previously persisted selection is read once as absent.
 *
 * `'all'` is a UI sentinel declared HERE, not an `Article` model concept — `filterArticles` treats
 * `undefined` as "no constraint" and deliberately does NOT special-case `'all'` (a consumer could
 * legitimately have a category literally named `'all'`), so the page maps it before filtering.
 */
export const articleFilters = createSearchStore({
  key: 'article-filters',
  fields: {
    category: field.enum(['all', ...ARTICLE_CATEGORIES], 'all'),
    tags: field.multi(ARTICLE_TAGS, []),
  },
}).labels({
  category: { all: 'All', guide: 'Guide', reference: 'Reference', pattern: 'Pattern' },
  tags: {
    dashboards: 'Dashboards',
    charts: 'Charts',
    design: 'Design',
    streaming: 'Streaming',
    tokens: 'Tokens',
  },
})
