import { createFileRoute } from '@tanstack/react-router'
import { ContentSanitizeDemoPage } from '../demo/ContentSanitizeDemoPage'

export const Route = createFileRoute('/content-sanitize')({
  staticData: { title: 'Content sanitize' },
  component: ContentSanitizeDemoPage,
})
