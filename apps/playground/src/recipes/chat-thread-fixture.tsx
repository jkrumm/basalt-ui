/**
 * The chat-thread recipe, mounted as the playground file exports it: `Thread` over the seeded
 * `threadFixture` and a mock stream. The layout test tunes the stream through `window.chatMock`
 * (the transport reads it on every send).
 */
import { createRoot } from 'react-dom/client'
import { Thread, mockTransport, threadFixture } from './chat-thread'
import type { MockOptions } from './chat-thread'

const options: MockOptions = {}
;(window as unknown as { chatMock: MockOptions }).chatMock = options
const transport = mockTransport(options)

createRoot(document.getElementById('root')!).render(
  <div className="flex h-dvh flex-col bg-background text-foreground">
    <Thread transport={transport} history={threadFixture} />
  </div>,
)
