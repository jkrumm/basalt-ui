/**
 * `Message` and `MessageActions`: one turn of a conversation and what a person can do with it. A
 * user turn sits in a bubble at the end of the line, capped in width; an assistant turn takes the
 * full measure with no bubble, so long answers, tables and code read as the page. Actions are typed
 * data (copy, regenerate, feedback, edit), drawn as one toolbar of icon buttons: arrow keys move
 * between them, and they show on hover and on focus, always under a coarse pointer.
 */
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { ai } from '../core/messages/ai'
import { useMessages } from '../core/messages/use-messages'
import { CopyButton } from '../ui/copy-button'
import { Toolbar, ToolbarButton } from '../ui/toolbar'
import { BadGlyph, EditGlyph, GoodGlyph, RegenerateGlyph } from './glyphs'

/** A verdict on a reply; `null` is none. */
export type MessageFeedback = 'good' | 'bad' | null

/** One thing a person can do with a message: data, like a page action. */
export type MessageAction =
  | { kind: 'copy'; text: string }
  | { kind: 'regenerate'; onSelect: () => void; disabled?: boolean }
  | { kind: 'edit'; onSelect: () => void; disabled?: boolean }
  | { kind: 'feedback'; value: MessageFeedback; onChange: (value: MessageFeedback) => void }

export type MessageActionsProps = {
  actions: readonly MessageAction[]
  /** `hover` shows them on hover and focus of the message (default); `always` keeps them shown. */
  reveal?: 'hover' | 'always'
}

export type MessageProps = {
  /** Who wrote the turn: `user` gets the bubble. */
  from: 'user' | 'assistant'
  children: ReactNode
  actions?: readonly MessageAction[]
  /** Shown on hover and focus (default) or always: the latest reply often keeps them out. */
  reveal?: MessageActionsProps['reveal']
  /** True for the reply still streaming: `aria-busy`, and its actions wait until it settles. */
  streaming?: boolean
}

/** Every `data-slot` this module renders. */
export const messageParts = ['ai-message', 'ai-message-body', 'ai-message-actions'] as const

function Action({ action }: { action: MessageAction }): ReactNode {
  const t = useMessages(ai)
  switch (action.kind) {
    case 'copy':
      return (
        <ToolbarButton render={<CopyButton value={action.text} label={t('ai.actionCopy')} />} />
      )
    case 'regenerate':
      return (
        <ToolbarButton
          shape="icon"
          aria-label={t('ai.actionRegenerate')}
          disabled={action.disabled}
          onClick={action.onSelect}
        >
          <RegenerateGlyph />
        </ToolbarButton>
      )
    case 'edit':
      return (
        <ToolbarButton
          shape="icon"
          aria-label={t('ai.actionEdit')}
          disabled={action.disabled}
          onClick={action.onSelect}
        >
          <EditGlyph />
        </ToolbarButton>
      )
    case 'feedback':
      return (
        <>
          <ToolbarButton
            shape="icon"
            aria-label={t('ai.actionGood')}
            aria-pressed={action.value === 'good'}
            className={cn(action.value === 'good' && 'text-brand')}
            onClick={() => action.onChange(action.value === 'good' ? null : 'good')}
          >
            <GoodGlyph />
          </ToolbarButton>
          <ToolbarButton
            shape="icon"
            aria-label={t('ai.actionBad')}
            aria-pressed={action.value === 'bad'}
            className={cn(action.value === 'bad' && 'text-brand')}
            onClick={() => action.onChange(action.value === 'bad' ? null : 'bad')}
          >
            <BadGlyph />
          </ToolbarButton>
        </>
      )
    default:
      return action satisfies never
  }
}

/**
 * The actions of one message as a toolbar of icon buttons. Inside a `Message` they show on hover
 * and focus; alone they are always shown.
 *
 * @useWhen the copy, regenerate, feedback and edit buttons of a message the app draws itself
 * @neverWhen the message is a `Message`: give it `actions` instead
 *
 * @example
 * <MessageActions actions={[{ kind: 'copy', text }, { kind: 'regenerate', onSelect: regenerate }]} />
 */
export function MessageActions({
  actions,
  reveal = 'always',
}: MessageActionsProps): ReactElement | null {
  const t = useMessages(ai)
  if (actions.length === 0) return null
  return (
    <div
      data-slot="ai-message-actions"
      className={cn(
        reveal === 'hover' &&
          'opacity-0 transition-opacity duration-fast group-focus-within/message:opacity-100 group-hover/message:opacity-100 pointer-coarse:opacity-100',
      )}
    >
      <Toolbar aria-label={t('ai.actions')} className="min-h-0 gap-0.5">
        {actions.map((action, at) => (
          <Action key={`${action.kind}-${at}`} action={action} />
        ))}
      </Toolbar>
    </div>
  )
}

/**
 * One turn of a conversation: a capped bubble for the person, the full measure for the assistant,
 * and its actions under it. The body is yours: `partView(message.parts)` for a model's parts.
 *
 * @useWhen one turn of a chat thread, the person's or the assistant's
 * @neverWhen the text is not a conversation turn (use Prose, or a Card)
 *
 * @example
 * <Message from="assistant" actions={[{ kind: 'copy', text }]}>{partView(m.parts)}</Message>
 */
export function Message({
  from,
  children,
  actions = [],
  reveal = 'hover',
  streaming = false,
}: MessageProps): ReactElement {
  const own = from === 'user'
  return (
    <article
      data-slot="ai-message"
      data-from={from}
      aria-busy={streaming || undefined}
      className={cn('group/message flex min-w-0 flex-col gap-1', own ? 'items-end' : 'items-start')}
    >
      <div
        data-slot="ai-message-body"
        className={cn(
          'min-w-0',
          own
            ? 'max-w-[min(34.5rem,85%)] rounded-ctrl bg-inset px-3 py-2 text-sm leading-6 whitespace-pre-wrap text-foreground'
            : 'w-full',
        )}
      >
        {children}
      </div>
      {!streaming && <MessageActions actions={actions} reveal={reveal} />}
    </article>
  )
}
