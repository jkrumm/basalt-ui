---
name: ai-card
use-when: a card shows a model summary that streams in (a personalised or generated note), held at one height
file: apps/playground/src/recipes/ai-card.tsx
---

`useCompletion` streams into `Markdown` as untrusted text. The panel's `skeleton` height is the body box at every phase: `loading` until the first token, `ready` after, so the card never moves; a longer one scrolls inside it. Serve it with `streamText(...).toUIMessageStreamResponse()`.
`data-state` and `aria-busy` mark the live text. Trust stays `untrusted`: a generated summary is model text.

```tsx
import { useCompletion } from '@ai-sdk/react' // basalt-agent-allow: one completion, no thread
import { DataPanel } from 'basalt-ui/cards'
import { Markdown } from 'basalt-ui/content'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import { useEffect } from 'react'

export function AiCard({ api, prompt }: { api: string; prompt: string }) {
  const { completion, complete, isLoading, error } = useCompletion({ api })
  useEffect(() => {
    void complete(prompt)
  }, [complete, prompt])
  const phase = error
    ? { tag: 'error' as const, message: error.message }
    : completion
      ? 'ready'
      : 'loading'
  return (
    <DataPanel
      title="Summary"
      phase={phase}
      skeleton={{ height: 160 }}
      body={() => (
        <ScrollArea aria-label="Summary" className="h-full">
          <div
            data-state={isLoading ? 'streaming' : 'settled'}
            aria-busy={isLoading}
            className="px-(--card-edge)"
          >
            <Markdown contentTrust="untrusted" streaming={isLoading}>
              {completion}
            </Markdown>
          </div>
        </ScrollArea>
      )}
    />
  )
}
```
