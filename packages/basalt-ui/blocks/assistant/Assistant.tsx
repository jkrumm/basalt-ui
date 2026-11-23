import { Composer, Message, partView } from 'basalt-ui/ai'
import type {
  ComposerMessage,
  ComposerProps,
  ComposerStatus,
  MessageAction,
  ToolView,
} from 'basalt-ui/ai'
import { Page, PageBar } from 'basalt-ui/page'
import { Button } from 'basalt-ui/ui/button'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import { ClipboardList, FileSpreadsheet, SquarePen } from 'lucide-react'
import { useState } from 'react'
import type { ReactElement } from 'react'
import type { Decision, MentionTarget, Turn } from './model'

type Feedback = Extract<MessageAction, { kind: 'feedback' }>['value']
type Mentions = NonNullable<ComposerProps<MentionTarget>['mentions']>['source']
type Models = NonNullable<ComposerProps['model']>['options']

export type AssistantProps = {
  /** The conversation so far, oldest first; the last assistant turn may still stream. */
  turns: readonly Turn[]
  /** The chat's status, from `useChat`. */
  status: ComposerStatus
  /** Sends the text with its mentions and files; a rejection gives the draft back. */
  onSend: (message: ComposerMessage<MentionTarget>) => unknown
  /** Stops the reply that streams, `useChat`'s `stop`. */
  onStop: () => void
  /** Asks for the reply to a turn again. */
  onRegenerate: (turnId: string) => void
  /** Answers a tool call that waits for approval. */
  onDecide: (decision: Decision) => void
  /** Starts an empty conversation. */
  onNew: () => void
  /** What `@` lists: suppliers and parts, grouped, or a loader. */
  mentions: Mentions
  /** The models the picker offers, grouped. */
  models: Models
  /** The draft the composer opens with. */
  draft?: string
}

const textOf = (turn: Turn): string =>
  turn.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n\n')

/**
 * An assistant over the inventory: the conversation as turns, each answer with its folded
 * reasoning, and the composer at the foot with mentions, attachments and a model picker.
 */
export function Assistant({
  turns,
  status,
  onSend,
  onStop,
  onRegenerate,
  onDecide,
  onNew,
  mentions,
  models,
  draft,
}: AssistantProps): ReactElement {
  const [feedback, setFeedback] = useState<Readonly<Record<string, Feedback>>>({})
  const [chosen, setChosen] = useState<string[]>(['atlas-4', 'swift-2'])
  const busy = status === 'submitted' || status === 'streaming'
  const last = turns.at(-1)
  const approvals = {
    place_order: (view: ToolView) =>
      view.state === 'awaiting-approval' ? (
        <span className="flex items-center gap-2">
          <span className="font-mono text-sm">place_order</span>
          <Button
            size="sm"
            variant="primary"
            onClick={() => onDecide({ tool: view.name, approved: true })}
          >
            Approve
          </Button>
          <Button size="sm" onClick={() => onDecide({ tool: view.name, approved: false })}>
            Deny
          </Button>
        </span>
      ) : (
        <span className="font-mono text-sm">place_order</span>
      ),
  }

  const actionsOf = (turn: Turn): MessageAction[] =>
    turn.from === 'user'
      ? [{ kind: 'copy', text: textOf(turn) }]
      : [
          { kind: 'copy', text: textOf(turn) },
          {
            kind: 'feedback',
            value: feedback[turn.id] ?? null,
            onChange: (value) => setFeedback((before) => ({ ...before, [turn.id]: value })),
          },
          { kind: 'regenerate', onSelect: () => onRegenerate(turn.id), disabled: busy },
        ]

  return (
    <Page area="ref-assistant" fill>
      <PageBar actions={[{ id: 'new', label: 'New chat', icon: SquarePen, onClick: onNew }]} />
      <div data-shot="assistant" className="flex min-h-0 flex-1 flex-col">
        <div className="grid min-h-0 flex-1 grid-rows-1 p-1">
          <ScrollArea aria-label="Conversation">
            <ol className="flex flex-col items-center gap-6 py-6">
              {turns.map((turn) => {
                const live = busy && turn === last && turn.from === 'assistant'
                return (
                  <li key={turn.id} className="flex w-full max-w-3xl flex-col px-4">
                    <Message from={turn.from} streaming={live} actions={actionsOf(turn)}>
                      {turn.from === 'user'
                        ? textOf(turn)
                        : partView(turn.parts, { settled: !live, toolRenderers: approvals })}
                    </Message>
                  </li>
                )
              })}
            </ol>
          </ScrollArea>
        </div>
        <div className="flex justify-center px-4 pb-4">
          <Composer<MentionTarget>
            aria-label="Message"
            placeholder="Ask about stock, suppliers or orders. Type @ to mention one."
            className="w-full max-w-3xl"
            {...(draft !== undefined && { defaultValue: draft })}
            status={status}
            onStop={onStop}
            onSend={onSend}
            mentions={{ source: mentions }}
            add={[
              {
                id: 'report',
                label: 'Stock report',
                icon: FileSpreadsheet,
                onSelect: () => undefined,
              },
              {
                id: 'order',
                label: 'Purchase order',
                icon: ClipboardList,
                onSelect: () => undefined,
              },
            ]}
            files={{ accept: 'image/*,.pdf,.csv', maxSize: 10_000_000, maxFiles: 4 }}
            model={{
              'aria-label': 'Models',
              multiple: true,
              options: models,
              value: chosen,
              onValueChange: setChosen,
            }}
          />
        </div>
      </div>
    </Page>
  )
}
