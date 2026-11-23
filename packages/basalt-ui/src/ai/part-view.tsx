/**
 * `partView`: the one safe renderer of a message's parts (docs/v3/concepts/ai-mdx.md section 3,
 * rows 1 and 6). Text goes through `Markdown` with `contentTrust` pinned to `'untrusted'`: no
 * `<img>`, no raw HTML, no way to pass a trusted arm from here. Reasoning and tool parts are the
 * steps of one `ReasoningTrace`, drawn where the first of them sits, each tool a `ToolView` row (or
 * the app's own renderer for that tool name). Everything else a model can send (sources, files,
 * `data-*`, step markers) gets a quiet one-line fallback, because the app renders those itself from
 * the recipes.
 *
 * It never throws on wire data: a part that is not an object, has no string `type`, or carries text
 * that is not a string is skipped or rendered empty, and nothing it prints is ever a link or an
 * image built from a part's URL. The `catalog` and `onBlockEvent` options belong to the catalog
 * Issue (v3-ai-i4) and are not read here.
 *
 * The trace folds into "N tools used · 42 s" once the message has settled and no tool is still
 * unresolved; while streaming, or while any tool is pending, running or awaiting approval, it stays
 * open and non-collapsing so the streaming steps and the call that needs the user are never hidden.
 * Hide a streaming `partView` with `Collapsible` or CSS if you must; never with `<Activity>`.
 */
import { Fragment } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { Markdown } from '../content/markdown'
import type { MessagePart, PartViewOptions } from './contract'
import { ReasoningTrace } from './reasoning-trace'
import type { TraceStep } from './reasoning-trace'
import { isToolPart, toolView } from './tool-view'
import type { ToolPart } from './tool-view'

type DataPart = Extract<MessagePart, { type: `data-${string}` }>

const LABEL_MAX = 120

function isDataPart(part: Exclude<MessagePart, ToolPart>): part is DataPart {
  return part.type.startsWith('data-')
}

/** Wire text bounded for display: a fallback line, never a block. */
function short(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined
  return value.length > LABEL_MAX ? `${value.slice(0, LABEL_MAX)}…` : value
}

function Fallback({ type, label }: { type: string; label?: string | undefined }): ReactElement {
  return (
    <div data-slot="ai-part" data-part={short(type)} className="text-xs text-muted-foreground">
      {label ?? short(type)}
    </div>
  )
}

function Text({ text, streaming }: { text: unknown; streaming: boolean }): ReactElement {
  return (
    <div data-slot="ai-text" className="basalt-prose">
      <Markdown contentTrust="untrusted" streaming={streaming}>
        {typeof text === 'string' ? text : ''}
      </Markdown>
    </div>
  )
}

/** The part is outside this version's union (a newer `ai` minor): the wire is data, not a type. */
function unknownPart(part: unknown): ReactElement {
  return <Fallback type={short((part as { type?: unknown }).type) ?? 'unknown'} />
}

function renderPart(part: Exclude<MessagePart, ToolPart>, streaming: boolean): ReactNode {
  if (isDataPart(part)) return <Fallback type={part.type} />
  switch (part.type) {
    case 'text':
      return <Text text={part.text} streaming={streaming && part.state !== 'done'} />
    case 'reasoning':
      return null
    case 'step-start':
      return null
    case 'file':
      return <Fallback type={part.type} label={short(part.filename) ?? short(part.mediaType)} />
    case 'source-url':
      return <Fallback type={part.type} label={short(part.title) ?? short(part.sourceId)} />
    case 'source-document':
      return <Fallback type={part.type} label={short(part.title) ?? short(part.filename)} />
    case 'reasoning-file':
    case 'custom':
    case 'steering-message':
      return <Fallback type={part.type} />
    default:
      return unknownPart(part satisfies never)
  }
}

/**
 * The parts of one message as React nodes. `settled` (default `true`) is false only for the message
 * still streaming; markdown there repairs its open tail and the tool rail stays open.
 *
 * @useWhen rendering the parts of a model message, from the AI SDK or a mapper of another runtime
 * @neverWhen the text is authored and trusted (use Markdown with contentTrust trusted) or the Chat itself is the question (it is not owned here)
 *
 * @example
 * const { messages } = useChat({ chat })
 * return messages.map((m, i) => (
 *   <div key={m.id}>{partView(m.parts, { settled: i < messages.length - 1 })}</div>
 * ))
 */
export function partView(parts: readonly MessagePart[], o: PartViewOptions = {}): ReactNode {
  if (!Array.isArray(parts)) return null
  const settled = o.settled !== false
  const body: ReactNode[] = []
  const steps: TraceStep[] = []
  let traceAt = -1

  parts.forEach((raw: unknown, index) => {
    if (typeof raw !== 'object' || raw === null) return
    if (typeof (raw as { type?: unknown }).type !== 'string') return
    const part = raw as MessagePart
    if (isToolPart(part)) {
      const id = (part as { toolCallId?: unknown }).toolCallId
      steps.push({
        kind: 'tool',
        key: typeof id === 'string' ? id : `i${index}`,
        view: toolView(part),
      })
    } else if (part.type === 'reasoning') {
      const text = (part as { text?: unknown }).text
      steps.push({
        kind: 'reasoning',
        key: `i${index}`,
        text: typeof text === 'string' ? text : '',
      })
    } else {
      body.push(<Fragment key={index}>{renderPart(part, !settled)}</Fragment>)
      return
    }
    if (traceAt < 0) traceAt = body.length
  })

  if (steps.length > 0) {
    body.splice(
      traceAt,
      0,
      <div key="trace" data-slot="ai-tools" className="my-2">
        <ReasoningTrace steps={steps} settled={settled} toolRenderers={o.toolRenderers} />
      </div>,
    )
  }
  return body.length === 0 ? null : body
}
