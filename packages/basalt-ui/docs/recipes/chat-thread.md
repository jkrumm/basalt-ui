---
name: chat-thread
use-when: an AI chat thread: streamed replies without a bubble, a composer, one live region, a scroller that stays at the bottom
file: apps/playground/src/recipes/chat-thread.tsx
---

Copy this file, `chat-thread-composer` and `chat-thread-scroll` into `src/components/chat` under those names; nothing here is exported by basalt. `Thread` owns the `Chat` in `useState` (never module scope) and hands it to `useChat`; `partView` renders the reply with no bubble.
`data-state` and `aria-busy` mark the streaming block, and one polite region speaks the settled reply once, never a delta. Hide streaming UI with CSS, never `<Activity>`. Mount `Thread` in a flex column of bounded height.
Seed `history` from the loader before the Chat exists. A refetch that lands mid-stream is held and reloaded when `status` is `ready`: its payload predates the reply and would drop it. Never assign `chat.messages` mid-stream.

```tsx
import { Chat, useChat } from '@ai-sdk/react' // basalt-agent-allow: the Chat is owned here
import type { ChatTransport, UIMessage } from 'ai'
import { partView } from 'basalt-ui/ai'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import { useState } from 'react'
import { MessageBox } from './chat-thread-composer'
import { useStickToBottom } from './chat-thread-scroll'

type Props = { transport: ChatTransport<UIMessage>; history?: UIMessage[] }

export function Thread({ transport, history = [] }: Props) {
  const [chat] = useState(() => new Chat({ transport, messages: history }))
  const { messages, status, sendMessage } = useChat({ chat, experimental_throttle: 100 })
  const scroll = useStickToBottom()
  const busy = status === 'submitted' || status === 'streaming'
  const last = messages.at(-1)

  async function onSend(text: string) {
    await sendMessage({ text })
    if (chat.error && chat.lastMessage?.role === 'user') throw chat.error // the POST failed
  }

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-rows-1">
        <ScrollArea ref={scroll} aria-label="Conversation">
          <ol className="flex flex-col gap-4 p-4">
            {messages.map((m) => {
              const live = busy && m === last
              const state = live ? 'streaming' : 'settled'
              const own = m.role === 'user' ? 'self-end rounded-ctrl bg-surface px-3 py-2' : ''
              return (
                <li key={m.id} data-state={state} aria-busy={live} className={own}>
                  {partView(m.parts, { settled: !live })}
                </li>
              )
            })}
          </ol>
        </ScrollArea>
      </div>
      <output className="sr-only">
        {!busy && last?.role === 'assistant' && last.parts.map((p) => ('text' in p ? p.text : ''))}
      </output>
      <MessageBox busy={busy} onSend={onSend} />
    </>
  )
}
```
