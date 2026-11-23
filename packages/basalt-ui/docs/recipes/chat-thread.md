---
name: chat-thread
use-when: an AI chat thread: streamed replies through Message and partView, the Composer, one live region, a scroller that stays at the bottom
---

The parts ship in `basalt-ui/ai`: `Message` draws a turn (a capped bubble for the person, the full measure for the reply), `partView` its parts with the reasoning folded into one trace, `Composer` the box. This file wires them to the AI SDK; copy it and `chat-thread-scroll` beside each other.
`Thread` owns the `Chat` in `useState` (never module scope) and hands it to `useChat`; `status` and `stop` go to the `Composer` as they are, and `onSend` throws when the POST failed, so the draft comes back.
`data-state` and `aria-busy` mark the streaming turn, and one polite region speaks the settled reply once, never a delta. Hide streaming UI with CSS, never `<Activity>`. Mount `Thread` in a flex column of bounded height.
Seed `history` from the loader before the Chat exists. A refetch that lands mid-stream is held and reloaded when `status` is `ready`: its payload predates the reply and would drop it. Never assign `chat.messages` mid-stream.

```tsx
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
```
