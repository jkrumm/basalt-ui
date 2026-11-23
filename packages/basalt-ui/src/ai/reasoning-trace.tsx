/**
 * `ReasoningTrace`: how a reply was reached, as one line that opens to an ordered rail. Reasoning
 * text and tool calls are steps in the order the model made them. While the reply streams, or while
 * any tool waits (pending, running, awaiting approval), the rail stays open and cannot fold, so the
 * call that needs the person is never hidden; once settled it folds to "2 tools used · 14 s".
 * Reasoning is model text: it prints as plain text, never markup. A step rises in on
 * `animate-enter-item`, which holds still under reduced motion.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { ai } from '../core/messages/ai'
import { useMessages } from '../core/messages/use-messages'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { Status } from '../ui/status'
import type { ToolView } from './contract'
import { ChevronGlyph } from './glyphs'

/** One step of a trace: a run of reasoning text or one tool call. */
export type TraceStep =
  | { kind: 'reasoning'; text: string; key?: string }
  | { kind: 'tool'; view: ToolView; key?: string }

export type ReasoningTraceProps = {
  steps: readonly TraceStep[]
  /** False while the reply streams: the rail stays open. Default `true`. */
  settled?: boolean
  /** A tool's own row by tool name, as `partView`'s option of the same name. */
  toolRenderers?: Record<string, (view: ToolView) => ReactNode> | undefined
}

/** Every `data-slot` this module renders. */
export const reasoningTraceParts = ['ai-trace', 'ai-trace-step', 'ai-tool'] as const

const LABEL_MAX = 120
const UNRESOLVED: ReadonlySet<ToolView['state']> = new Set([
  'pending',
  'running',
  'awaiting-approval',
])
const STATUS_TONE = { running: 'info', 'awaiting-approval': 'warn', denied: 'neutral' } as const

const short = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value === '') return undefined
  return value.length > LABEL_MAX ? `${value.slice(0, LABEL_MAX)}…` : value
}

/** Whole seconds this client watched the trace run; undefined for a trace first seen settled. */
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

function Step({
  step,
  renderers,
}: {
  step: TraceStep
  renderers: ReasoningTraceProps['toolRenderers']
}): ReactElement {
  const dot = (
    <span
      aria-hidden="true"
      className={cn(
        'absolute left-0.5 size-1.5 rounded-full bg-muted-foreground',
        step.kind === 'reasoning' ? 'top-4' : 'top-2.5',
      )}
    />
  )
  if (step.kind === 'reasoning') {
    return (
      <li
        data-slot="ai-trace-step"
        data-kind="reasoning"
        className="relative animate-enter-item pl-4"
      >
        {dot}
        <p className="m-0 rounded-ctrl bg-inset px-3 py-1.5 text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
          {typeof step.text === 'string' ? step.text : ''}
        </p>
      </li>
    )
  }
  const { view } = step
  // `hasOwn`: a tool named `constructor` or `toString` must not resolve to an inherited member.
  const custom = renderers !== undefined && Object.hasOwn(renderers, view.name)
  return (
    <li
      data-slot="ai-tool"
      data-state={view.state}
      className="relative flex min-h-6 animate-enter-item flex-wrap items-center gap-2 pl-4"
    >
      {dot}
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

/**
 * The steps behind a reply, folded to one line once it has settled. `partView` draws a message's
 * reasoning and tool parts through it; draw it yourself for steps another runtime reports.
 *
 * @useWhen the reasoning and tool calls behind a model reply, from another runtime than partView reads
 * @neverWhen the steps are a process the person drives (use a StepRail or a Stepper)
 *
 * @example
 * <ReasoningTrace steps={[{ kind: 'reasoning', text: 'Checking stock' }, { kind: 'tool', view }]} settled />
 */
export function ReasoningTrace({
  steps,
  settled = true,
  toolRenderers,
}: ReasoningTraceProps): ReactElement {
  const t = useMessages(ai)
  const seconds = useWatchedSeconds(settled)
  const [expanded, setExpanded] = useState(false)
  const tools = steps.filter((step) => step.kind === 'tool').length
  const open =
    !settled || steps.some((step) => step.kind === 'tool' && UNRESOLVED.has(step.view.state))
  const rail = (
    <ol className="relative m-0 flex list-none flex-col gap-1.5 p-0 before:absolute before:inset-y-2 before:left-1 before:w-px before:bg-border">
      {steps.map((step, at) => (
        <Step key={step.key ?? at} step={step} renderers={toolRenderers} />
      ))}
    </ol>
  )
  const waiting = steps.some(
    (step) => step.kind === 'tool' && step.view.state === 'awaiting-approval',
  )
  const summary = tools > 0 ? t('ai.steps', tools, seconds) : t('ai.reasoned', seconds)
  if (open) {
    return (
      <div data-slot="ai-trace" data-state="open" className="flex flex-col gap-1.5">
        <span className="text-sm text-muted-foreground">
          {waiting ? t('ai.toolAwaitingApproval') : settled ? summary : t('ai.thinking')}
        </span>
        {rail}
      </div>
    )
  }
  return (
    <Collapsible
      data-slot="ai-trace"
      data-state="folded"
      open={expanded}
      onOpenChange={setExpanded}
    >
      <CollapsibleTrigger className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        {summary}
        <ChevronGlyph open={expanded} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1.5">{rail}</CollapsibleContent>
    </Collapsible>
  )
}
