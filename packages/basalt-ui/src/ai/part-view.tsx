/**
 * `partView`: the one safe renderer of a message's parts (docs/v3/concepts/ai-mdx.md section 3,
 * rows 1 and 6). Text goes through `Markdown` with `contentTrust` pinned to `'untrusted'`: no
 * `<img>`, no raw HTML, no way to pass a trusted arm from here. Tool parts are gathered into one
 * rail under the answer, each row a `ToolView` (or the app's own renderer for that tool name).
 * Everything else a model can send (reasoning, sources, files, `data-*`, step markers) gets a quiet
 * one-line fallback, because the app renders those itself from the recipes.
 *
 * It never throws on wire data: a part that is not an object, has no string `type`, or carries text
 * that is not a string is skipped or rendered empty, and nothing it prints is ever a link or an
 * image built from a part's URL. The `catalog` and `onBlockEvent` options belong to the catalog
 * Issue (v3-ai-i4) and are not read here.
 *
 * The rail folds into "N steps · 42 s" once the message has settled and no tool is still
 * unresolved; while streaming, or while any tool is pending, running or awaiting approval, it stays
 * open and non-collapsing so the streaming text and the call that needs the user are never hidden.
 * Hide a streaming `partView` with `Collapsible` or CSS if you must; never with `<Activity>`.
 */
import { Fragment, useEffect, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { ai } from '../core/messages/ai'
import { useMessages } from '../core/messages/use-messages'
import { Markdown } from '../content/markdown'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { Status } from '../ui/status'
import type { MessagePart, PartViewOptions, ToolView } from './contract'
import { isToolPart, toolView } from './tool-view'
import type { ToolPart } from './tool-view'

type DataPart = Extract<MessagePart, { type: `data-${string}` }>
type ToolRenderers = NonNullable<PartViewOptions['toolRenderers']>

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
    <div data-slot="ai-text" className="vx-prose">
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
      return <Fallback type={part.type} />
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

const STATUS_TONE = { running: 'info', 'awaiting-approval': 'warn', denied: 'neutral' } as const

function ToolStatus({ view }: { view: ToolView }): ReactNode {
  const t = useMessages(ai)
  switch (view.state) {
    case 'pending':
    case 'running':
      return <Status tone={STATUS_TONE.running}>{t('ai.toolRunning')}</Status>
    case 'awaiting-approval':
      return <Status tone={STATUS_TONE['awaiting-approval']}>{t('ai.toolAwaitingApproval')}</Status>
    case 'denied':
      return <Status tone={STATUS_TONE.denied}>{t('ai.toolDenied')}</Status>
    case 'error':
      return <Status tone="bad">{short(view.error) ?? view.name}</Status>
    case 'done':
      return null
    default:
      return view.state satisfies never
  }
}

function ToolRow({ view, renderers }: { view: ToolView; renderers: ToolRenderers | undefined }) {
  // `hasOwn`: a tool named `constructor` or `toString` must not resolve to an inherited member.
  const custom = renderers !== undefined && Object.hasOwn(renderers, view.name)
  return (
    <li data-slot="ai-tool" data-state={view.state} className="flex flex-wrap items-center gap-2">
      {custom ? (
        renderers[view.name]?.(view)
      ) : (
        <>
          <span className="font-mono text-sm text-foreground">{short(view.name)}</span>
          <ToolStatus view={view} />
        </>
      )}
    </li>
  )
}

const UNRESOLVED: ReadonlySet<ToolView['state']> = new Set([
  'pending',
  'running',
  'awaiting-approval',
])

/** Whole seconds this client watched the rail run; undefined for a rail first seen settled. */
function useWatchedSeconds(settled: boolean): number | undefined {
  const startedAt = useRef<number | null>(null)
  const [seconds, setSeconds] = useState<number | undefined>()
  useEffect(() => {
    if (!settled) startedAt.current ??= Date.now()
    else if (startedAt.current !== null)
      setSeconds(
        (prev) => prev ?? Math.max(1, Math.round((Date.now() - startedAt.current!) / 1000)),
      )
  }, [settled])
  return seconds
}

function ToolRail({
  views,
  settled,
  renderers,
}: {
  views: readonly { key: string; view: ToolView }[]
  settled: boolean
  renderers: ToolRenderers | undefined
}): ReactElement {
  const t = useMessages(ai)
  const seconds = useWatchedSeconds(settled)
  const list = (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {views.map(({ key, view }) => (
        <ToolRow key={key} view={view} renderers={renderers} />
      ))}
    </ul>
  )
  const open = !settled || views.some(({ view }) => UNRESOLVED.has(view.state))
  return (
    <div data-slot="ai-tools" className="mt-2">
      {open ? (
        list
      ) : (
        <Collapsible>
          <CollapsibleTrigger className="text-sm text-muted-foreground">
            {t('ai.steps', views.length, seconds)}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1.5">{list}</CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
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
  const tools: { key: string; view: ToolView }[] = []

  parts.forEach((raw: unknown, index) => {
    if (typeof raw !== 'object' || raw === null) return
    if (typeof (raw as { type?: unknown }).type !== 'string') return
    const part = raw as MessagePart
    if (isToolPart(part)) {
      const id = (part as { toolCallId?: unknown }).toolCallId
      tools.push({ key: typeof id === 'string' ? id : `i${index}`, view: toolView(part) })
      return
    }
    body.push(<Fragment key={index}>{renderPart(part, !settled)}</Fragment>)
  })

  if (tools.length > 0) {
    body.push(<ToolRail key="tools" views={tools} settled={settled} renderers={o.toolRenderers} />)
  }
  return body.length === 0 ? null : body
}
