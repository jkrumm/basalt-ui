import { createFileRoute } from '@tanstack/react-router'
import { ContentDemoPage } from '../demo/ContentDemoPage'

export const Route = createFileRoute('/content')({
  staticData: { title: 'Content' },
  component: ContentDemoPage,
})
