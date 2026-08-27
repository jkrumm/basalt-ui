import { createFileRoute } from '@tanstack/react-router'
import { articleFilters } from '../demo/article-filter-stores'
import { ContentOverviewPage } from '../demo/ContentOverviewPage'

export const Route = createFileRoute('/content-overview')({
  staticData: { title: 'Content overview' },
  // One store, one `validateSearch` — both params resolve URL ⊳ localStorage ⊳ fallback in it.
  validateSearch: articleFilters.validateSearch,
  component: ContentOverviewPage,
})
