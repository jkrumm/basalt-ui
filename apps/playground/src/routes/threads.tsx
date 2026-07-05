import { createFileRoute } from '@tanstack/react-router'
import { ThreadsPage } from '../demo/threads/ThreadsPage'

type ThreadsSearch = {
  thread?: string
}

function validateSearch(search: Record<string, unknown>): ThreadsSearch {
  return typeof search['thread'] === 'string' ? { thread: search['thread'] } : {}
}

export const Route = createFileRoute('/threads')({
  staticData: { title: 'Threads' },
  validateSearch,
  component: ThreadsPage,
})
