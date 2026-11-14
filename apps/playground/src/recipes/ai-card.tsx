// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:ai-card
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
// #endregion
