import { createFileRoute } from '@tanstack/react-router'
import { articleCategory, articleTags } from '../demo/article-filter-stores'
import { ContentOverviewPage } from '../demo/ContentOverviewPage'

export const Route = createFileRoute('/content-overview')({
  staticData: { title: 'Content overview' },
  // Composing two single-param stores into one route's validateSearch is the intended pattern —
  // each store owns exactly one search param, so validation just merges both result objects.
  validateSearch: (search) => ({
    ...articleCategory.validateSearch(search),
    ...articleTags.validateSearch(search),
  }),
  component: ContentOverviewPage,
})
