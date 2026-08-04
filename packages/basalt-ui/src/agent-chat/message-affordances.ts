/**
 * MessageAffordances — the per-message hover-row/action contract shared by `ThreadTranscript` and
 * a virtualized `ThreadFeedRow` (both render `MessageBlock`, so the affordance surface lives here
 * rather than being redeclared on each consumer).
 *
 * Type-only module — the rendering (the actual hover row, copy button, regenerate button) lives in
 * `thread-message.tsx`. `MessageAffordances` itself IS public (re-exported, type-only, from the
 * agent-chat barrel and the root): it is named in `ThreadTranscriptProps.affordances` and
 * `ThreadFeedRowProps.affordances`, so a consumer has to be able to name it. `DEFAULT_AFFORDANCES`
 * stays internal — resolving unset fields is the components' job, not the consumer's.
 */
import type { ReactNode } from 'react'
import type { ChatMessage, TranscriptPart } from '../agent'

export type MessageAffordances = {
  /**
   * How the per-message timestamp renders.
   * @default 'relative'
   */
  readonly timestamp?: 'relative' | 'absolute' | 'none'
  /**
   * Whether a copy action is offered on the hover row. Copies the message's COALESCED text (the
   * same merged/de-duplicated text `coalesceParts` produces for display), not the raw `parts`
   * array — a message can accumulate multiple adjacent/by-id text parts while streaming, and
   * copying the raw parts would either duplicate text or copy fragments the user never saw
   * assembled.
   * @default true
   */
  readonly copy?: boolean
  /**
   * Regenerate action, shown on the LAST ASSISTANT message only (never on earlier turns, never on
   * user messages). Receives that message's `id`. `useAgentThreadRuns`'s `retry` is
   * THREAD-keyed (`retry: (threadId: string) => void`), replaying the last user input for the
   * whole thread — the consumer bridges this messageId-keyed callback to that thread-keyed retry;
   * the framework only ever hands back the messageId, it does not know about threads.
   */
  readonly onRegenerate?: (messageId: string) => void
  /**
   * Extra actions appended to the hover row, after the built-in copy/regenerate actions.
   *
   * This is a RENDER prop, not an event handler — it is called during render, once per message,
   * and its return value is rendered. That means it is treated differently from `onRegenerate`:
   * `onRegenerate` is identity-stabilized internally (a fresh inline literal every render costs
   * nothing), while `actions` is compared by REFERENCE, because its reference is the only signal
   * that its output may have changed. A fresh inline `actions={() => …}` literal therefore
   * re-renders every message block on every render of the transcript. That is correct — an action
   * whose output depends on consumer state (a pin/star toggle) must be allowed to update — but on
   * a long thread it is worth avoiding: wrap `actions` in the consumer's own `useCallback`, keyed
   * on whatever state it actually reads.
   */
  readonly actions?: (ctx: { readonly message: ChatMessage<TranscriptPart> }) => ReactNode
}

/**
 * Resolved defaults for the optional {@link MessageAffordances} fields — one place, so
 * `ThreadTranscript` and a virtualized `ThreadFeedRow` cannot drift on what "unset" means.
 */
export const DEFAULT_AFFORDANCES: Required<Pick<MessageAffordances, 'timestamp' | 'copy'>> = {
  timestamp: 'relative',
  copy: true,
}
