// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:chat-thread
import { Chat, useChat } from '@ai-sdk/react' // basalt-agent-allow: the Chat is owned here
import type { ChatTransport, UIMessage } from 'ai'
import { Composer, Message, partView } from 'basalt-ui/ai'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import { useState } from 'react'
import { useStickToBottom } from './chat-thread-scroll'

type Props = { transport: ChatTransport<UIMessage>; history?: UIMessage[] }
const textOf = (m: UIMessage): string =>
  m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('')

export function Thread({ transport, history = [] }: Props) {
  const [chat] = useState(() => new Chat({ transport, messages: history }))
  const { messages, status, sendMessage, stop } = useChat({ chat, experimental_throttle: 100 })
  const scroll = useStickToBottom()
  const busy = status === 'submitted' || status === 'streaming'
  const last = messages.at(-1)

  async function onSend({ text }: { text: string }) {
    await sendMessage({ text })
    if (chat.error && chat.lastMessage?.role === 'user') throw chat.error // the POST failed
  }

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-rows-1">
        <ScrollArea ref={scroll} aria-label="Conversation">
          <ol className="flex flex-col gap-6 p-4">
            {messages.map((m) => {
              const live = busy && m === last
              return (
                <li key={m.id} data-state={live ? 'streaming' : 'settled'} aria-busy={live}>
                  <Message from={m.role === 'user' ? 'user' : 'assistant'} streaming={live}>
                    {partView(m.parts, { settled: !live })}
                  </Message>
                </li>
              )
            })}
          </ol>
        </ScrollArea>
      </div>
      <output className="sr-only">{!busy && last?.role === 'assistant' && textOf(last)}</output>
      <div className="p-3">
        <Composer aria-label="Message" status={status} onStop={() => void stop()} onSend={onSend} />
      </div>
    </>
  )
}
// #endregion

// ── The thread fixture (layout test and one-look; not part of the recipe) ─────────────────────

const turn = (id: string, role: UIMessage['role'], text: string): UIMessage => ({
  id,
  role,
  parts: [{ type: 'text', text }],
})

/** Five seeded messages: markdown, a code fence and a list, so the fixture is not one line. */
export const threadFixture: UIMessage[] = [
  turn('h1', 'user', 'What changed in the last release?'),
  turn(
    'h2',
    'assistant',
    '## Release notes\n\nThree things changed:\n\n- the **scroller** pins during a stream\n- the composer keeps your draft on a failed send\n- one live region announces the settled reply',
  ),
  turn('h3', 'user', 'Show the config.'),
  turn('h4', 'assistant', 'Here it is:\n\n```ts\nexport const config = { throttle: 100 }\n```'),
  turn('h5', 'user', 'Thanks. Now stream a long answer.'),
]

const PLAN = [
  '## Heading',
  'A paragraph of words that wraps over a few lines on a phone and keeps growing.',
  '- first item\n- second item\n- third item',
  'Another paragraph with `inline code` and **bold** words in it.',
  '```ts\nconst a = 1\nconst b = 2\n```',
]
// Word by word, spaces kept, so each tick is one small delta of valid markdown.
const WORDS = PLAN.join('\n\n').split(/(?<= )/)

/** `pauseAfter`: hold the stream still once that many words went out, until the test clears it (read each tick). */
export type MockOptions = { tickMs?: number; ticks?: number; fail?: boolean; pauseAfter?: number }

/** A transport that streams synthetic markdown, one word per tick; read lazily, so a test can tune it. */
export function mockTransport(opts: MockOptions = {}): ChatTransport<UIMessage> {
  return {
    sendMessages: async ({ abortSignal }) => {
      const { tickMs = 100, ticks = 900, fail = false } = opts
      if (fail) throw new Error('the POST failed')
      return new ReadableStream<import('ai').UIMessageChunk>({
        start(controller) {
          let i = 0
          controller.enqueue({ type: 'start', messageId: `a-${Date.now()}` })
          controller.enqueue({ type: 'text-start', id: 't' })
          const timer = setInterval(() => {
            if (opts.pauseAfter !== undefined && i >= opts.pauseAfter) return
            if (abortSignal?.aborted || i >= ticks) {
              clearInterval(timer)
              controller.enqueue({ type: 'text-end', id: 't' })
              controller.enqueue({ type: 'finish' })
              controller.close()
              return
            }
            const wrap = i > 0 && i % WORDS.length === 0 ? '\n\n' : ''
            controller.enqueue({
              type: 'text-delta',
              id: 't',
              delta: wrap + WORDS[i % WORDS.length],
            })
            i++
          }, tickMs)
        },
      })
    },
    reconnectToStream: async () => null,
  }
}
