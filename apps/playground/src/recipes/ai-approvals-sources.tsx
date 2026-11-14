// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:ai-approvals-sources
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
// #endregion
