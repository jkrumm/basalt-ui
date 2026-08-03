import { createFileRoute } from '@tanstack/react-router'
import { ThreadsAdapterDemoPage } from '../demo/threads/ThreadsAdapterDemoPage'

export const Route = createFileRoute('/threads-adapter')({
  staticData: { title: 'Threads adapter' },
  component: ThreadsAdapterDemoPage,
})
