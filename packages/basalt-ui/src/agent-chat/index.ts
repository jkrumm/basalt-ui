/**
 * Mantine-styled thread-chat components over the headless `basalt-ui/agent` layer, capped by the
 * flagship `ThreadWorkspace` composite.
 *
 * This module is Mantine-coupled by design and ships its own `basalt-ui/agent-chat` subpath
 * (also re-exported from the root entry, unchanged for existing consumers) — unlike
 * `basalt-ui/agent`, which stays headless so it can be styled by any consumer.
 *
 * @example
 * import { ThreadWorkspace } from 'basalt-ui/agent-chat'
 * import { createThreadsStore, edenTransport, heuristicOutcome } from 'basalt-ui/agent'
 */

// ── ThreadWorkspace (flagship composite) ──────────────────────────────────────
export { ThreadWorkspace } from './thread-workspace'
export type { ThreadWorkspaceProps } from './thread-workspace'

// ── ThreadFeed ────────────────────────────────────────────────────────────────
export { ThreadFeed } from './thread-feed'
export type { ThreadFeedProps } from './thread-feed'

// ── ThreadFeedRow ─────────────────────────────────────────────────────────────
export { ThreadFeedRow } from './thread-feed-row'
export type { ThreadFeedRowProps } from './thread-feed-row'

// ── Shared transcript/row contracts ───────────────────────────────────────────
// Type-only. Both are named in the PUBLIC props of components exported above
// (`ThreadTranscriptProps.affordances`, `ThreadFeedRowProps`'s height union), so a consumer that
// wants to hold one in a typed variable needs to be able to name it. No runtime export here — the
// resolution/defaults live inside the components. `RowHeightProps` (B3) is `ThreadFeedRow`'s OWN
// height contract — a superset of `VirtualizeProps` that also allows `height` without
// `virtualize` — kept alongside it for the same reason.
export type { MessageAffordances } from './message-affordances'
export type { RowHeightProps, VirtualizeOptions, VirtualizeProps } from './virtualize'

// ── ThreadOutcomeCard ─────────────────────────────────────────────────────────
export { ThreadOutcomeCard } from './thread-outcome-card'
export type { ThreadOutcomeCardProps } from './thread-outcome-card'

// ── ThreadDetailPanel ─────────────────────────────────────────────────────────
export { ThreadDetailPanel } from './thread-detail-panel'
export type { ThreadDetailPanelProps } from './thread-detail-panel'

// ── Composer ──────────────────────────────────────────────────────────────────
export { Composer } from './composer'
export type { ComposerAttachment, ComposerHandle, ComposerProps, ComposerSubmit } from './composer'

// ── threadPartRenderers + ThreadTranscript ────────────────────────────────────
export { threadPartRenderers, ThreadTranscript } from './thread-message'
export type { ThreadTranscriptProps } from './thread-message'

// ── ToolChip ──────────────────────────────────────────────────────────────────
export { ToolChip } from './tool-chip'
export type { ToolChipProps } from './tool-chip'
