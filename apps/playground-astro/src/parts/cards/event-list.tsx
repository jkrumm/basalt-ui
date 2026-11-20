import { EventList } from 'basalt-ui/cards'
import type { ReactElement } from 'react'

const NOW = Date.UTC(2026, 10, 20, 12, 0)

const EVENTS = [
  {
    id: 'e1',
    at: NOW - 3_600_000,
    actor: 'Ada',
    title: 'merged pull request 412',
    chips: ['main'],
  },
  { id: 'e2', at: NOW - 9_000_000, actor: 'Grace', title: 'opened pull request 98', chips: ['ci'] },
  { id: 'e3', at: NOW - 40_000_000, actor: 'Linus', title: 'deployed checkout to production' },
  { id: 'e4', at: NOW - 90_000_000, actor: 'Ada', title: 'rotated the API keys' },
]

export function Demo(): ReactElement {
  return (
    <div className="max-w-xl">
      <EventList title="Activity" now={NOW} items={EVENTS} bodyRows={4} pageSize={3} />
    </div>
  )
}
