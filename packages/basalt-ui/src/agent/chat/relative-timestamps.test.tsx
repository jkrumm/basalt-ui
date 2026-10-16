/**
 * The three chat timestamp call sites and the notification center read `format/relativeTime`:
 * sub-minute is the locale's "now", and a past hour reads as one.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { NotificationCenter } from '../../commands/notifications/center'
import { add, clear } from '../../commands/notifications/store'
import type { ChatMessage } from '../history'
import type { TranscriptPart } from '../foreign'
import type { AgentThread } from '../thread'
import { ThreadFeedRow } from './thread-feed-row'
import { ThreadOutcomeCard } from './thread-outcome-card'
import { ThreadTranscript } from './thread-message'

const HOUR = 3_600_000

function thread(updatedAt: number): AgentThread {
  return {
    id: 't1',
    messages: [],
    outcome: { title: 'Resolved', summary: 'Summary', status: 'done' },
    status: 'done',
    read: true,
    createdAt: 0,
    updatedAt,
  }
}

function message(createdAt: number): ChatMessage<TranscriptPart>[] {
  return [
    {
      id: 'm1',
      role: 'assistant',
      parts: [{ id: 'm1-p1', type: 'text', text: 'hi' }],
      createdAt,
    },
  ]
}

const wrap = (node: React.ReactNode) => <MantineProvider>{node}</MantineProvider>

const row = (updatedAt: number) =>
  wrap(
    <ThreadFeedRow
      thread={thread(updatedAt)}
      expanded={false}
      onToggle={() => {}}
      onSend={() => {}}
    />,
  )

const label = (createdAt: number) => {
  render(
    wrap(
      <ThreadTranscript messages={message(createdAt)} affordances={{ timestamp: 'relative' }} />,
    ),
  )
  return within(screen.getByTestId('message-affordances-m1')).getByText(/now|ago/).textContent
}

const item = (createdAt: number) => add({ id: 'n1', intent: 'error', message: 'body', createdAt })

beforeEach(() => clear())
afterEach(cleanup)

describe('ThreadOutcomeCard', () => {
  test('sub-minute reads "now"', () => {
    render(
      wrap(
        <ThreadOutcomeCard
          thread={thread(Date.now() - 5_000)}
          selected={false}
          onSelect={() => {}}
        />,
      ),
    )
    expect(screen.getByText('now')).toBeDefined()
  })

  test('a past hour reads "1 hour ago"', () => {
    render(
      wrap(
        <ThreadOutcomeCard
          thread={thread(Date.now() - HOUR)}
          selected={false}
          onSelect={() => {}}
        />,
      ),
    )
    expect(screen.getByText('1 hour ago')).toBeDefined()
  })
})

describe('ThreadFeedRow', () => {
  test('sub-minute reads "now"', () => {
    render(row(Date.now() - 5_000))
    expect(screen.getByText('now')).toBeDefined()
  })

  test('a past hour reads "1 hour ago"', () => {
    render(row(Date.now() - HOUR))
    expect(screen.getByText('1 hour ago')).toBeDefined()
  })
})

describe('ThreadTranscript timestamp', () => {
  test('sub-minute reads "now"', () => {
    expect(label(Date.now() - 5_000)).toBe('now')
  })

  test('a past hour reads "1 hour ago"', () => {
    expect(label(Date.now() - HOUR)).toBe('1 hour ago')
  })
})

describe('NotificationCenter timestamp', () => {
  test('sub-minute reads "now"', () => {
    item(Date.now() - 5_000)
    render(wrap(<NotificationCenter />))
    expect(screen.getByText('now')).toBeDefined()
  })

  test('a past hour reads in the short style', () => {
    item(Date.now() - HOUR)
    render(wrap(<NotificationCenter />))
    expect(screen.getByText('1 hr. ago')).toBeDefined()
  })
})
