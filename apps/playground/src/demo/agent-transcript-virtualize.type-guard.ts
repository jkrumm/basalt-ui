// PROVES (consumer-facing, not just package-internal): ThreadTranscriptProps and ThreadFeedRowProps
// both inherit VirtualizeProps' virtualize-implies-height guard through the PUBLIC
// `basalt-ui/agent-chat` subpath a real app imports — reproduces the "virtualize: true with no
// height" tsc error the release notes ask for, from the public prop types rather than re-deriving
// the internal `VirtualizeProps` union already proven at its definition by
// packages/basalt-ui/src/agent-chat/virtualize.type-guard.test.ts.
import type { AgentThread } from 'basalt-ui/agent'
import type { ThreadFeedRowProps, ThreadTranscriptProps } from 'basalt-ui/agent-chat'

function acceptTranscript(props: ThreadTranscriptProps): ThreadTranscriptProps {
  return props
}

function acceptRow(props: ThreadFeedRowProps): ThreadFeedRowProps {
  return props
}

const messages: ThreadTranscriptProps['messages'] = []

const thread: AgentThread = {
  id: 'fixture-thread',
  messages: [],
  outcome: null,
  status: 'pending',
  read: false,
  createdAt: 0,
  updatedAt: 0,
}

function noopToggle(_id: string): void {
  // fixture-only no-op
}

function noopSend(): void {
  // fixture-only no-op
}

// ── Valid combinations — must type-check with no error ────────────────────────

acceptTranscript({ messages })
acceptTranscript({ messages, virtualize: true, height: 400 })
acceptRow({ thread, expanded: false, onToggle: noopToggle, onSend: noopSend })
acceptRow({
  thread,
  expanded: false,
  onToggle: noopToggle,
  onSend: noopSend,
  virtualize: true,
  height: 300,
})

// ── Invalid combinations — each MUST be a tsc error ───────────────────────────

// @ts-expect-error `height` is required when `virtualize: true` (ThreadTranscriptProps)
acceptTranscript({ messages, virtualize: true })

// @ts-expect-error `height` is forbidden when `virtualize` is omitted/false (ThreadTranscriptProps)
acceptTranscript({ messages, height: 400 })

// @ts-expect-error `height` is required when `virtualize: true` (ThreadFeedRowProps)
acceptRow({ thread, expanded: false, onToggle: noopToggle, onSend: noopSend, virtualize: true })

// @ts-expect-error `height` is forbidden when `virtualize` is omitted/false (ThreadFeedRowProps)
acceptRow({ thread, expanded: false, onToggle: noopToggle, onSend: noopSend, height: 400 })

// PROVES: the virtualize/height union guard (packages/basalt-ui/src/agent-chat/virtualize.ts) holds
// on the actual public prop types a consumer imports (ThreadTranscriptProps, ThreadFeedRowProps),
// not only on the internal VirtualizeProps type it's built from.
