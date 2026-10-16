/**
 * The three chat timestamp call sites and the notification center read `format/relativeTime`:
 * sub-minute is the locale's "now", and a past hour reads as one.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
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

const withMantine = (node: ReactNode) => <MantineProvider>{node}</MantineProvider>

const renderFeedRow = (updatedAt: number) =>
  withMantine(
    <ThreadFeedRow
      thread={thread(updatedAt)}
      expanded={false}
      onToggle={() => {}}
      onSend={() => {}}
    />,
  )

const transcriptTimestamp = (createdAt: number) => {
  render(
    withMantine(
      <ThreadTranscript messages={message(createdAt)} affordances={{ timestamp: 'relative' }} />,
    ),
  )
  return within(screen.getByTestId('message-affordances-m1')).getByText(/now|ago/).textContent
}

const addErrorNotification = (createdAt: number) =>
  add({ id: 'n1', intent: 'error', message: 'body', createdAt })

beforeEach(() => clear())
afterEach(cleanup)

describe('ThreadOutcomeCard', () => {
  test('sub-minute reads "now"', () => {
    render(
      withMantine(
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
      withMantine(
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
    render(renderFeedRow(Date.now() - 5_000))
    expect(screen.getByText('now')).toBeDefined()
  })

  test('a past hour reads "1 hour ago"', () => {
    render(renderFeedRow(Date.now() - HOUR))
    expect(screen.getByText('1 hour ago')).toBeDefined()
  })
})

describe('ThreadTranscript timestamp', () => {
  test('sub-minute reads "now"', () => {
    expect(transcriptTimestamp(Date.now() - 5_000)).toBe('now')
  })

  test('a past hour reads "1 hour ago"', () => {
    expect(transcriptTimestamp(Date.now() - HOUR)).toBe('1 hour ago')
  })
})

describe('NotificationCenter timestamp', () => {
  test('sub-minute reads "now"', () => {
    addErrorNotification(Date.now() - 5_000)
    render(withMantine(<NotificationCenter />))
    expect(screen.getByText('now')).toBeDefined()
  })

  test('a past hour reads in the short style', () => {
    addErrorNotification(Date.now() - HOUR)
    render(withMantine(<NotificationCenter />))
    expect(screen.getByText('1 hr. ago')).toBeDefined()
  })

  test('59.6 minutes promotes to "1 hr. ago"', () => {
    addErrorNotification(Date.now() - 59.6 * 60_000)
    render(withMantine(<NotificationCenter />))
    expect(screen.getByText('1 hr. ago')).toBeDefined()
  })

  test('a non-finite createdAt renders the dash instead of throwing', () => {
    addErrorNotification(Number.NaN)
    render(withMantine(<NotificationCenter />))
    expect(screen.getByText('—')).toBeDefined()
  })
})
