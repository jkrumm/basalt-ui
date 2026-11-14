---
name: ai-approvals-sources
use-when: a chat asks before a tool runs, shows reasoning and cites sources, which `partView` leaves to the app
file: apps/playground/src/recipes/ai-approvals-sources.tsx
---

`partView` renders text and tools; reasoning and `source-*` parts get a quiet line, so the app draws them.
An approval is a `toolRenderers` entry per tool name: Approve and Deny call `chat.addToolApprovalResponse({ id, approved })`.
Nothing resolves without a click; `denied` is its own state, not an error. `ToolView` has no ids, so the renderer finds the request by `args`.
Sources dedupe by url, link only `http(s)`, show the hostname and fetch no favicon. Inline citations are `[1](#src-1)` links.

```tsx
import { partView } from 'basalt-ui/ai'
import type { MessagePart, ToolView } from 'basalt-ui/ai'
import { Button } from 'basalt-ui/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'basalt-ui/ui/collapsible'

type Part = MessagePart & { approval?: { id: string } }
type Respond = (r: { id: string; approved: boolean }) => void // addToolApprovalResponse
// `ToolView` has no ids: find the request by its args, which `partView` passes through untouched.
const approval = (parts: readonly Part[], respond: Respond) => (v: ToolView) => {
  const id = parts.find((p) => 'input' in p && p.input === v.args)?.approval?.id
  if (v.state !== 'awaiting-approval' || !id) return `${v.name}: ${v.state}`
  return (
    <span role="group" aria-label={v.name}>
      <Button onClick={() => respond({ id, approved: true })}>Approve</Button>
      <Button onClick={() => respond({ id, approved: false })}>Deny</Button>
    </span>
  )
}
const host = (url: string) => (/^https?:\/\//i.test(url) ? URL.parse(url)?.hostname : undefined)

export function Message(p: { parts: readonly Part[]; tools: string[]; respond: Respond }) {
  const thoughts = p.parts.flatMap((x) => (x.type === 'reasoning' ? x.text : []))
  const urls = new Set(
    p.parts.flatMap((x) => (x.type === 'source-url' && host(x.url) ? x.url : [])),
  )
  const toolRenderers = Object.fromEntries(p.tools.map((t) => [t, approval(p.parts, p.respond)]))
  return (
    <>
      {thoughts.map((t, i) => (
        <Collapsible key={i}>
          <CollapsibleTrigger>Reasoning</CollapsibleTrigger>
          <CollapsibleContent>{t}</CollapsibleContent>
        </Collapsible>
      ))}
      {partView(p.parts, { toolRenderers })}
      <ol aria-label="Sources">
        {[...urls].map((u, i) => (
          <li key={u} id={`src-${i + 1}`}>
            <a href={u} rel="noreferrer noopener">
              {host(u)}
            </a>
          </li>
        ))}
      </ol>
    </>
  )
}
```
