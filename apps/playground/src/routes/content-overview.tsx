import { createFileRoute } from '@tanstack/react-router'
import { ContentOverviewPage } from '../demo/ContentOverviewPage'

export const Route = createFileRoute('/content-overview')({
  staticData: { title: 'Content overview' },
  component: ContentOverviewPage,
})
