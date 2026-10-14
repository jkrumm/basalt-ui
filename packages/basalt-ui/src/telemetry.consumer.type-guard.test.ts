/**
 * Compile-time proof that the `Telemetry` `@example` (V2-SPEC § 7, argo `lib/telemetry.ts`) type-checks
 * against the package ENTRY barrels, not a deep import: every type it names comes from `src/index.ts` and
 * `src/agent/index.ts`. Checked by `tsc --noEmit`.
 */
import { expect, test } from 'bun:test'
import type { ChatTurnEnd, ChatTurnTrace, Telemetry, TraceHeaders } from './index'
import type { AgentStreamContext } from './agent/index'

const onEvent = (): void => {}

export const telemetry: Telemetry = Object.assign(onEvent, {
  startChatTurn({ threadId }: { threadId: string }): ChatTurnTrace {
    const headers: TraceHeaders = { traceparent: `00-${threadId}`, tracestate: undefined }
    return {
      headers,
      settle(end: ChatTurnEnd) {
        void end
      },
    }
  },
})

export const ctx: AgentStreamContext = { messageId: 'm', headers: { traceparent: 'x' } }

test('the consumer pattern compiles from the package entry', () => {
  expect(typeof telemetry.startChatTurn).toBe('function')
})
